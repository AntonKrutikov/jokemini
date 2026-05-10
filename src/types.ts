interface Env {
	ASSETS: Fetcher
	GEMINI_API_KEY: string
	SYSTEM_PROMPT: string
	GEMINI_MODEL: string
	GUARDRAIL_CLASSIFIER_MODEL?: string
	// Default to enabled when unset.
	GUARD_PROMPT_ENABLED?: boolean
	GUARDRAIL_CLASSIFIER_ENABLED?: boolean
	// When true, the chat handler honors per-request guardPrompt/classifier overrides
	// from the request body. Configured in wrangler.toml [vars]; flip to false for prod.
	DEBUG_CLIENT_OVERRIDES?: boolean
}
