# Turn loop

Maps 1:1 to `src/turn-loop.ts`. One turn is the whole product.

## Definition

**One turn** = user message → model call (with tools) → tool execution → model continues or yields a final text reply.

The loop is **stateless between turns except message history**. A hard message-window trim keeps free-tier models from drowning in context.

## Annotated walkthrough

```
runTurn(userText)
  │
  ├─ 1. Append user message to session.messages
  │
  ├─ 2. Build request:
  │      system = buildSystemPrompt(lesson)
  │      history = trimMessages(session.messages, MAX_MESSAGES)
  │      tools  = toolRegistry.definitions()
  │
  ├─ 3. Loop (until final reply or max iterations):
  │      │
  │      ├─ response = model.chat({ messages: [system, ...history], tools })
  │      ├─ append assistant message to session
  │      │
  │      ├─ if tool_calls present:
  │      │     for each call:
  │      │       result = tools.execute(name, args, { workspaceRoot })
  │      │       append tool message (tool_call_id + output)
  │      │       emit trace event for CLI
  │      │     continue loop
  │      │
  │      └─ else:
  │            finalReply = assistant.content
  │            break
  │
  └─ 4. Return { reply, traces }
```

### Step notes

1. **User message** — plain text from the REPL. Slash commands never enter this path.
2. **System prompt** — base harness instructions + active lesson's `systemPromptAddon` (see `src/prompt/build-system-prompt.ts`).
3. **Trim** — keep the last `MAX_MESSAGES` non-system messages so NIM free tier stays usable.
4. **Tool calls** — OpenAI-shaped: `id`, `function.name`, `function.arguments` (JSON string). Invalid JSON or unknown tools return an error `ToolResult` instead of crashing. Schemas go to the model; execution stays local — see [TOOLS.md](./TOOLS.md).
5. **Graceful degrade** — if the model returns text that looks like a tool request but no structured `tool_calls`, the harness does not parse free-form tool syntax; it treats the text as the final reply (documented NIM reality).
6. **Max iterations** — caps runaway tool loops (`MAX_TOOL_ROUNDS`).

## Events for the CLI

`TurnLoop` yields trace records the CLI prints in a Claude Code–ish style:

```
→ read_file {"path":"src/main.ts"}
← ok (120 chars)
```

`edit_file` and `write_file` return a **unified diff** (familiar `---` / `+++` / `+/-` hunks). The CLI prints the full diff under the `← ok diff +N -M` summary line, with ANSI colors when stdout is a TTY (`+` green, `-` red, hunk headers cyan). Diff construction: `src/tools/diff.ts`. Coloring: `src/cli/ansi.ts`. Set `NO_COLOR=1` to disable.

### Live status

`TurnLoop` emits `onEvent` callbacks:

| Event | Meaning |
|-------|---------|
| `status` | Spinner text — e.g. `Calling NIM …`, `Running read_file…` |
| `status_clear` | Hide spinner |
| `trace` | Tool finished — CLI prints the trace immediately |

Spinner: `src/cli/status-line.ts` (stderr, with elapsed seconds).

## Related code

| Concern | File |
|---------|------|
| Loop | `src/turn-loop.ts` |
| History + workspace | `src/session.ts` |
| Model contract | `src/model/types.ts` |
| Mock scripted turns | `src/model/mock-client.ts` |
| Tool execution | `src/tools/registry.ts` |
