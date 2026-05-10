import { getCurrentDialog, persist, deriveTitle } from "./dialogs-store.js"
import { appendMessage, attachStats, scrollToBottom, clearEmptyState, renderSidebar } from "./conversation-view.js"
import { createTypewriter } from "./typewriter.js"
import { getDebugFlags } from "./debug-flags.js"

const form = document.getElementById("chat-form")
const input = document.getElementById("message")
const button = document.getElementById("submit")

export function initChat() {
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
			e.preventDefault()
			if (!button.disabled) form.requestSubmit()
		}
	})

	input.addEventListener("blur", (e) => {
		setTimeout(() => {
			window.scrollTo(0, window.scrollY - 1)
		}, 1)
	})

	form.addEventListener("submit", handleSubmit)
}

async function handleSubmit(e) {
	e.preventDefault()
	const message = input.value.trim()
	if (!message) return

	const dialog = getCurrentDialog()
	if (!dialog) return

	clearEmptyState()

	appendMessage("user", message)
	input.value = ""
	const reply = appendMessage("assistant", "")
	reply.classList.add("thinking")
	scrollToBottom()
	const stopThinking = () => {
		if (reply.classList.contains("thinking")) {
			reply.classList.remove("thinking")
		}
	}
	const typer = createTypewriter(reply, {
		charsPerSec: 80,
		onTick: scrollToBottom,
	})

	button.disabled = true

	const history = dialog.messages.map((m) => ({ role: m.role, text: m.text }))
	let assistantText = ""
	let usage = null
	let totalMs = null
	let guardEnabled = null
	let classifierEnabled = null
	let classifierRan = null
	let classifierMs = null
	let titleWasDefault = !dialog.messages.length

	try {
		const flags = getDebugFlags()
		const res = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message, history, ...flags }),
		})

		if (!res.ok) {
			const { error } = await res.json().catch(() => ({ error: res.statusText }))
			throw new Error(error || "Request failed")
		}

		const reader = res.body.getReader()
		const decoder = new TextDecoder()
		let buffer = ""
		let streamError = null

		outer: while (true) {
			const { value, done } = await reader.read()
			if (done) break
			buffer += decoder.decode(value, { stream: true })

			let boundary
			while ((boundary = buffer.indexOf("\n\n")) !== -1) {
				const rawEvent = buffer.slice(0, boundary)
				buffer = buffer.slice(boundary + 2)

				let eventType = "message"
				const dataLines = []
				for (const line of rawEvent.split("\n")) {
					if (line.startsWith("event:")) eventType = line.slice(6).trim()
					else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""))
				}
				if (!dataLines.length) continue

				let payload
				try {
					payload = JSON.parse(dataLines.join("\n"))
				} catch {
					continue
				}

				if (eventType === "done") {
					break outer
				} else if (eventType === "error") {
					streamError = payload.message || "Stream error"
					break outer
				} else if (eventType === "usage") {
					const {
						totalMs: ms,
						guardEnabled: ge,
						classifierEnabled: ce,
						classifierRan: cr,
						classifierMs: cms,
						...rest
					} = payload
					usage = rest
					totalMs = typeof ms === "number" ? ms : null
					guardEnabled = typeof ge === "boolean" ? ge : null
					classifierEnabled = typeof ce === "boolean" ? ce : null
					classifierRan = typeof cr === "boolean" ? cr : null
					classifierMs = typeof cms === "number" ? cms : null
				} else if (payload.text) {
					stopThinking()
					assistantText += payload.text
					typer.push(payload.text)
				}
			}
		}

		if (streamError) {
			stopThinking()
			const errText = (assistantText ? "\n\n" : "") + `[error: ${streamError}]`
			assistantText += errText
			typer.push(errText)
			reply.classList.add("error")
		}

		await typer.end()

		const hasUsage = usage && Object.keys(usage).length > 0
		const stats =
			hasUsage || totalMs != null || guardEnabled != null || classifierEnabled != null
				? { usage: hasUsage ? usage : null, totalMs, guardEnabled, classifierEnabled, classifierRan, classifierMs }
				: null
		if (stats) attachStats(reply, stats)

		dialog.messages.push({ role: "user", text: message })
		dialog.messages.push({ role: "model", text: assistantText, stats })
		if (titleWasDefault) {
			dialog.title = deriveTitle(message)
			renderSidebar()
		}
		persist()
	} catch (err) {
		stopThinking()
		reply.classList.add("error")
		typer.push(`Error: ${err.message}`)
		await typer.end()
	} finally {
		button.disabled = false
		input.focus()
	}
}
