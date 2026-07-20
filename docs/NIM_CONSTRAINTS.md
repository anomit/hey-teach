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
| `503 ResourceExhausted` (worker slots full) | Clear error; wait / retry / switch `NIM_MODEL` — capacity is on NVIDIA’s side |

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

## What we intentionally do not do

- Retry storms that burn free credits
- Huge few-shot tool examples in the system prompt
- Keeping full transcripts forever
- Fighting models that ignore tools with a second custom protocol

Keep the loop small so students can read every line.
