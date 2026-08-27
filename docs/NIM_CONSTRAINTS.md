# NIM constraints

Free-tier realities that shape this harness. Documented, not fought.

## Endpoint

- OpenAI Chat Completions API shape
- Base URL: `https://integrate.api.nvidia.com/v1` (POST `/chat/completions`, GET `/models`)
- Auth: `NVIDIA_API_KEY` as Bearer token (via OpenAI SDK `apiKey`)
- Model id: env `NIM_MODEL` (catalog id, e.g. a coding-capable instruct model)

Client: `src/model/nim-client.ts` — thin wrapper around the official `openai` package.

**Important:** `GET /v1/models` succeeding does **not** mean chat will work for every id. Some catalog models hang (TCP open, **0 bytes** for 45s+) and the OpenAI SDK surfaces that as `Connection error` or `Request timed out`. Run `/doctor` in the REPL to separate “auth/endpoint ok” from “this model’s chat is dead”.

## Free-tier limits → design choices

| Reality | Harness response |
|---------|------------------|
| Rate / credit limits | Small system prompts; four tools only; short histories |
| Context window pressure | Hard message-window trim in `turn-loop.ts` |
| Tool-calling quality varies by model | Prefer structured `tool_calls`; if absent, treat content as final reply (no free-form parser) |
| Latency / flaky tool JSON | Tool args parse failures return error `ToolResult` strings; loop continues |
| Rate / 429 / HTTP 500 (free tier often 500s instead of 429) | Pace chat calls (`NIM_PACE_MS`, default 2s). Retry 429/5xx/connection drops up to `NIM_MAX_RETRIES` (default 3) with 2s/4s/8s backoff. Honor `Retry-After`. Do not retry 401/404 or timeouts |
| `503 ResourceExhausted` (worker slots full) | Same backoff; then a clear error — switch `NIM_MODEL` if it keeps happening |

## Modes

| Mode | Flag / default | Needs key? |
|------|----------------|------------|
| Mock | default (`--model mock` or omit) | No — scripted turns for classroom demos |
| NIM | `--model nim` | Yes — `NVIDIA_API_KEY` in env or `.env` |

Smoke path for NIM may fail or skip tool calls depending on the chosen model. That is expected and documented; MockClient is the reliable offline demo path.

## Timeouts and empty replies

- Default request timeout: **60s** (`NIM_TIMEOUT_MS` to override). Hung calls surface as a clear error instead of freezing forever.
- Empty `choices` or null content (no `tool_calls`) returns a diagnostic string with `finish_reason` / model id — often a cold model, bad id, or a model that declined to answer.
- Prefer a coding-capable catalog model if you see empty replies often.
- The CLI shows a spinner on stderr while waiting (`Calling NIM … 3.2s`).

## Pacing and retries (`src/model/nim-retry.ts`)

A user turn can fire many chat completions (one per tool round). Free NIM dies if those go out back-to-back.

- After each chat response, wait `NIM_PACE_MS` (2s) before the next call. Mock is unchanged.
- On 429, 500, 502, 503, 504, or a connection drop: wait 2s / 4s / 8s (capped 20s, plus jitter) and retry. `Retry-After` wins when present.
- SDK `maxRetries` is 0 so we do not double-retry under the hood.
- Timeouts and 401/404 fail immediately — backing off a 60s hang is worse.

Spinner phases (each resets the elapsed timer):

- `Pacing NIM 2s (our gap, not the API)…` — only the local sleep
- `Waiting on NIM chat… 24.1s` — the HTTP call; free NIM is often this slow
- `NIM 500 — retry 1/3 in 2s…` — backoff after a transient error

After each chat, a durable line stays in the scrollback:

```text
nim  paced 1.8s  http 24.1s  ok
nim  paced 2.0s  http 8.2s+21.4s  ok  retries 1 (500)
```

If you saw “pacing 2s” climb to 20–30s, that was the spinner never switching off the pace label. The wait was the API.

## What we intentionally do not do

- Retry storms (more than a few paced attempts)
- Huge few-shot tool examples in the system prompt
- Keeping full transcripts forever
- Fighting models that ignore tools with a second custom protocol

Keep the loop small so students can read every line.
