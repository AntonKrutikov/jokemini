import { GoogleGenAI } from "@google/genai"
import classifierTemplate from "./prompts/classifier.md"
import prefixTemplate from "./prompts/prefix.md"

export interface ChatTurn {
	role: "user" | "model"
	text: string
}

export interface PromptConfig {
	history: ChatTurn[]
	apiKey: string
	model: string
	systemPrompt: string
	refusalText: string
	guardEnabled: boolean
	classifier?: { enabled: boolean; model: string }
	// Buffer the first N chars so an ornamented refusal can be normalized to refusalText.
	refusalNormalizeBuffer?: number
}

export interface PromptChunk {
	text?: string
	usage?: unknown
}

export class Prompt {
	classifierRan = false
	classifierMs: number | null = null

	constructor(
		private readonly message: string,
		private readonly config: PromptConfig,
	) {}

	// Runs the classifier and the Gemini call eagerly so pre-stream errors throw here
	// (callers can map them to a clean HTTP response before opening an SSE stream).
	async stream(): Promise<AsyncIterable<PromptChunk>> {
		if (await this.shouldRefuse()) {
			console.log("[prompt] guardrail classifier flagged extraction — refusing")
			return singleChunk({ text: this.config.refusalText })
		}

		const ai = new GoogleGenAI({ apiKey: this.config.apiKey })
		const upstream = await ai.models.generateContentStream({
			model: this.config.model,
			contents: this.buildContents(),
			config: { systemInstruction: this.buildSystemInstruction(), thinkingConfig: { includeThoughts: false } },
		})

		return this.normalizeRefusals(upstream)
	}

	private async shouldRefuse(): Promise<boolean> {
		const c = this.config.classifier
		if (!c?.enabled || !c.model) return false
		this.classifierRan = true
		const t0 = Date.now()
		try {
			return await this.classify(c.model)
		} finally {
			this.classifierMs = Date.now() - t0
		}
	}

	// Separate Gemini call that judges whether the user is trying to extract instructions.
	private async classify(model: string): Promise<boolean> {
		const classifierPrompt = classifierTemplate.replaceAll("{{MESSAGE}}", this.message)
		try {
			const ai = new GoogleGenAI({ apiKey: this.config.apiKey })
			const result = await ai.models.generateContent({
				model,
				contents: [{ role: "user", parts: [{ text: classifierPrompt }] }],
				config: { temperature: 0, thinkingConfig: { includeThoughts: false } },
			})
			console.log(`[prompt] classifier result: ${JSON.stringify(result)}`)
			const verdict = (result.text ?? "").toString().trim().toUpperCase()
			return verdict.startsWith("Y")
		} catch (err) {
			console.log(`[prompt] guardrail classifier error: ${err instanceof Error ? err.message : err}`)
			return false
		}
	}

	private buildContents() {
		return [
			...this.config.history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
			{ role: "user", parts: [{ text: this.message }] },
		]
	}

	private buildSystemInstruction(): string {
		const { guardEnabled, refusalText, systemPrompt } = this.config
		if (!guardEnabled) return systemPrompt
		return `${prefixTemplate.replaceAll("{{REFUSAL}}", refusalText)}\n${systemPrompt}`
	}

	private async *normalizeRefusals(
		stream: AsyncGenerator<{ text?: string; usageMetadata?: unknown }>,
	): AsyncGenerator<PromptChunk> {
		const { refusalText } = this.config
		const bufferLimit = this.config.refusalNormalizeBuffer ?? 200
		let buffer = ""
		let buffering = true
		let lastUsage: unknown = null

		for await (const chunk of stream) {
			if (chunk.text) {
				if (buffering) {
					buffer += chunk.text
					if (buffer.includes(refusalText)) {
						console.log("[prompt] refusal detected mid-stream — normalizing output")
						yield { text: refusalText }
						return
					}
					if (buffer.length >= bufferLimit) {
						yield { text: buffer }
						buffer = ""
						buffering = false
					}
				} else {
					yield { text: chunk.text }
				}
			}
			if (chunk.usageMetadata) lastUsage = chunk.usageMetadata
		}

		if (buffer.length > 0) {
			if (buffer.includes(refusalText)) {
				console.log("[prompt] refusal detected at stream end — normalizing output")
				yield { text: refusalText }
				return
			}
			yield { text: buffer }
		}

		if (lastUsage) yield { usage: lastUsage }
	}
}

async function* singleChunk(chunk: PromptChunk): AsyncGenerator<PromptChunk> {
	yield chunk
}
