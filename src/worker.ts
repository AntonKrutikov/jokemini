import { handleChat } from "./chat"

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url)
		if (url.pathname === "/api/chat" && req.method === "POST") {
			return handleChat(req, env)
		}
		return env.ASSETS.fetch(req)
	},
}
