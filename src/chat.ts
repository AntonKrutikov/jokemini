import { Prompt, type ChatTurn } from "./prompt"
import { jsonError, sseResponse } from "./utilities"

const REFUSAL = "I can't share my instructions."
const MAX_MESSAGE_LENGTH = 4000
const MAX_HISTORY_TURNS = 40

interface ChatRequest {
	message: string
	history?: ChatTurn[]
	// Debug overrides — only honored when env.DEBUG_CLIENT_OVERRIDES is on.
	guardPrompt?: boolean
	classifier?: boolean
}

export async function handleChat(req: Request, env: Env): Promise<Response> {
	const startedAt = Date.now()
	let body: ChatRequest
	try {
		body = await req.json()
	} catch {
		return jsonError(400, "Invalid JSON body")
	}

	const message = body.message?.trim()
	if (!message) return jsonError(400, "Message is required")
	if (message.length > MAX_MESSAGE_LENGTH) {
		return jsonError(400, `Message exceeds ${MAX_MESSAGE_LENGTH} characters`)
	}

	const history = sanitizeHistory(body.history)
	if (history === null) return jsonError(400, "Invalid history format")

	const debugOverrides = !!env.DEBUG_CLIENT_OVERRIDES
	const guardEnabled =
		debugOverrides && typeof body.guardPrompt === "boolean"
			? body.guardPrompt
			: (env.GUARD_PROMPT_ENABLED ?? true)
	const classifierEnabled =
		debugOverrides && typeof body.classifier === "boolean"
			? body.classifier
			: (env.GUARDRAIL_CLASSIFIER_ENABLED ?? true)
	console.log(
		`[chat] debugOverrides=${debugOverrides} body.guardPrompt=${body.guardPrompt} body.classifier=${body.classifier} → guardEnabled=${guardEnabled} classifierEnabled=${classifierEnabled}`,
	)

	const prompt = new Prompt(message, {
		history,
		apiKey: env.GEMINI_API_KEY,
		model: env.GEMINI_MODEL,
		systemPrompt: env.SYSTEM_PROMPT,
		refusalText: REFUSAL,
		guardEnabled,
		classifier: env.GUARDRAIL_CLASSIFIER_MODEL
			? { enabled: classifierEnabled, model: env.GUARDRAIL_CLASSIFIER_MODEL }
			: undefined,
	})

	let stream: AsyncIterable<{ text?: string; usage?: unknown }>
	try {
		stream = await prompt.stream()
	} catch (err) {
		return geminiError(err)
	}

	return sseResponse(async (send) => {
		let chunkCount = 0
		let lastUsage: Record<string, unknown> | null = null
		try {
			for await (const chunk of stream) {
				if (chunk.text) {
					chunkCount++
					await send(null, { text: chunk.text })
				}
				if (chunk.usage) {
					lastUsage = chunk.usage as Record<string, unknown>
				}
			}
			await send("usage", {
				...(lastUsage ?? {}),
				totalMs: Date.now() - startedAt,
				guardEnabled,
				classifierEnabled,
				classifierRan: prompt.classifierRan,
				classifierMs: prompt.classifierMs,
			})
			console.log(`[chat] done chunks=${chunkCount} total=${Date.now() - startedAt}ms`)
			await send("done", {})
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Stream error"
			console.log(`[chat] error: ${msg}`)
			await send("error", { message: msg })
		}
	})
}

function sanitizeHistory(history: unknown): ChatTurn[] | null {
	if (history === undefined) return []
	if (!Array.isArray(history)) return null
	const turns: ChatTurn[] = []
	for (const item of history) {
		if (!isChatTurn(item)) return null
		turns.push({ role: item.role, text: item.text })
	}
	return turns.slice(-MAX_HISTORY_TURNS)
}

function isChatTurn(value: unknown): value is ChatTurn {
	if (!value || typeof value !== "object") return false
	const v = value as Record<string, unknown>
	return (v.role === "user" || v.role === "model") && typeof v.text === "string"
}

function geminiError(err: unknown): Response {
	const raw = err instanceof Error ? err.message : String(err)
	const match = raw.match(/status:\s*(\d{3})/)
	const upstream = match ? Number(match[1]) : 502
	const status = upstream === 429 ? 429 : upstream >= 400 && upstream < 500 ? upstream : 502
	const friendly =
		upstream === 429
			? "Gemini API rate limit hit. Check your quota in Google AI Studio."
			: upstream === 401 || upstream === 403
				? "Gemini API rejected the API key."
				: `Gemini API error (${upstream}).`
	return jsonError(status, friendly)
}
