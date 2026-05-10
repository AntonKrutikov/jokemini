# Jokemini

Minimal Cloudflare Worker web application that proxies a chat UI to the Gemini API while keeping the system prompt server-side and try to prevent prompt leaks through a combination of guardrails.

## System-prompt confidentiality

The proprietary `SYSTEM_PROMPT` is treated as a server-side secret. It is stored as a Cloudflare secret, read fresh from `env` on each request, attached only as Gemini's `systemInstruction`, and never echoed back, logged, or referenced from any file under `public/`. The browser only sees the user's message and the model's reply — the prompt itself never crosses the wire to the client.

Keeping the prompt out of the response body is necessary but not sufficient: a sufficiently clever user can still try to coax the model into reproducing it in its own output. The guardrails below address that second risk.

## Prompt-leak protection

Several layers of protection can be applied to keep the system prompt out of model output:

| Approach               | What it does                                                                                                                            | Strengths                                                           | Weaknesses                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Guard prefix           | Prepends a confidentiality directive to the system prompt telling the model never to reveal, paraphrase, or translate its instructions. | Free; language-agnostic; no extra latency.                          | Model-mediated, so soft against creative jailbreaks.              |
| Input regex filter     | Scores incoming messages against patterns matching known extraction phrasings and refuses locally before calling the model.             | Instant; deterministic; no API cost.                                | Language-bound to the patterns; trivially bypassed by rephrasing. |
| Output n-gram detector | Builds n-grams from the system prompt and scans the streaming response for a verbatim substring match, cutting the stream on hit.       | Catches naive verbatim emission with low overhead.                  | Defeated by translation, paraphrase, summary, or encoding tricks. |
| Guardrail classifier   | Routes each incoming message through a small auxiliary LLM that decides whether it's an extraction attempt before the main call.        | Multilingual; handles paraphrase; generalizes beyond pattern lists. | Adds one extra LLM round-trip per request.                        |

Only the **guard prefix** and the **guardrail classifier** are actually applied. The prefix is a free, language-agnostic baseline; the classifier is the only layer that meaningfully covers non-English input and paraphrased attempts. The regex filter and the n-gram detector both fail along the same axes the classifier already covers — non-English phrasing and non-verbatim leaks — so they would add code, latency, and false-positive risk without buying real additional coverage.

## Architecture

- **Static frontend** (`public/`) — vanilla ES modules organized by feature, served by the Workers Assets binding.
- **Worker** (`src/worker.ts`) — proxies chat requests to Gemini, injecting the system prompt server-side and streaming the reply back.
- **Secrets** — `GEMINI_API_KEY` and `SYSTEM_PROMPT` live as Cloudflare secrets and never reach the browser.

## Local development

1. Install deps:
   ```
   npm install
   ```
2. Copy `.dev.vars.example` to `.dev.vars` and fill in your values.
3. Run the dev server:
   ```
   npm run dev
   ```
4. Open the URL printed by `wrangler` (usually http://localhost:8787).

## Deploy

1. Authenticate `wrangler` once: `npx wrangler login`.
2. Set production secrets:
   ```
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put SYSTEM_PROMPT
   ```
3. Ship it:
   ```
   npm run deploy
   ```

## Configuration

Non-secret config lives in `wrangler.toml` under `[vars]`:

- `GEMINI_MODEL` — model used for the main chat reply. Default: `gemini-3.1-flash-lite`.
- `GUARDRAIL_CLASSIFIER_MODEL` — model used by the guardrail classifier. Keep it small and fast — it only emits `YES`/`NO`. Default: `gemini-3.1-flash-lite`.
- `GUARD_PROMPT_ENABLED` — toggles the guard prefix prepended to `SYSTEM_PROMPT`. Default: `true`.
- `GUARDRAIL_CLASSIFIER_ENABLED` — toggles the auxiliary classifier that screens incoming messages for extraction attempts. Default: `true`.

The two `*_ENABLED` flags exist so each protection layer can be disabled individually for testing. Leave them on in production.
