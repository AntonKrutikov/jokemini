// Reveals streamed text into `target` at a steady pace so a small response
// still feels like an AI typing. If the network outpaces us (long response),
// the typer auto-speeds-up to keep the buffer bounded.
export function createTypewriter(target, { charsPerSec = 160, onTick } = {}) {
	let pending = ""
	let displayed = ""
	let timer = null
	let ended = false
	let resolveDone
	const done = new Promise((r) => (resolveDone = r))
	const intervalMs = 16
	const baseChars = Math.max(1, Math.round((charsPerSec * intervalMs) / 1000))

	function tick() {
		if (!pending.length) {
			if (ended) {
				clearInterval(timer)
				timer = null
				resolveDone()
			}
			return
		}
		// If the model dumps a lot of text at once, drain proportionally faster.
		const speedup = pending.length > 200 ? Math.min(8, Math.ceil(pending.length / 100)) : 1
		const take = Math.min(baseChars * speedup, pending.length)
		displayed += pending.slice(0, take)
		pending = pending.slice(take)
		target.textContent = displayed
		if (onTick) onTick()
	}

	function ensureTimer() {
		if (!timer) timer = setInterval(tick, intervalMs)
	}

	return {
		push(text) {
			if (!text) return
			pending += text
			ensureTimer()
		},
		end() {
			ended = true
			ensureTimer()
			return done
		},
	}
}
