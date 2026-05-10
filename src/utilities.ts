const SSE_HEADERS = {
	"Content-Type": "text/event-stream; charset=utf-8",
	"Cache-Control": "no-cache, no-store, no-transform",
	"X-Accel-Buffering": "no",
	"X-Content-Type-Options": "nosniff",
}

type SseSend = (event: string | null, data: unknown) => Promise<void>

// Warmup byte flushes headers so the browser opens the stream before the first model token.
export function sseResponse(producer: (send: SseSend) => Promise<void>): Response {
	const encoder = new TextEncoder()
	const { readable, writable } = new TransformStream()
	const writer = writable.getWriter()
	const send: SseSend = (event, data) => {
		const prefix = event ? `event: ${event}\n` : ""
		return writer.write(encoder.encode(`${prefix}data: ${JSON.stringify(data)}\n\n`))
	}
	;(async () => {
		try {
			await writer.write(encoder.encode(": warmup\n\n"))
			await producer(send)
		} finally {
			await writer.close()
		}
	})()
	return new Response(readable, { headers: SSE_HEADERS })
}

export function jsonError(status: number, message: string): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { "Content-Type": "application/json" },
	})
}
