# Architecture

Source of truth for the harness layout. Read it alongside `src/turn-loop.ts` and `src/cli.ts`.

How to run the REPL: [USAGE.md](./USAGE.md). Doc index: [README.md](./README.md). Next coding agent: [../AGENTS.md](../AGENTS.md).

## Intent

A **minimal turn-based coding harness** that teaches how agent loops work under free NIM constraints. Lessons are plugins; the harness itself is the teaching object. Not a full agent product.

## Module map

```
CLI REPL  →  Session  →  TurnLoop  →  ModelClient (Mock | NIM)
                              ↓              ↓
                         ToolRegistry   LessonPlugin (system prompt)
                              ↓
                     Workspace FS / Shell
```

| Module | Path | Role |
|--------|------|------|
| CLI | `src/cli.ts` | Readline REPL, slash commands, tool-call tracing |
| Session | `src/session.ts` + `src/session-store.ts` | Conversation history + JSONL persistence + outcomes + optional fork lineage (`parentId` / `forkedAtIndex` — trees are summary fields, not a new store; see [SESSIONS.md](./SESSIONS.md), [EXPORT.md](./EXPORT.md)) |
| Export | `src/export/` | Labeled trajectory JSONL for later SFT |
| TurnLoop | `src/turn-loop.ts` | One turn: model → tools → model… until a reply |
| ModelClient | `src/model/` | `chat({ messages, tools })` contract; Mock + NIM |
| Tools | `src/tools/` | `read_file`, `write_file`, `edit_file`, `bash` (edits return unified diffs) |
| Lessons | `src/lessons/` | Plugin registry; ships `stub-bfs` as the example lesson |
| Prompt | `src/prompt/build-system-prompt.ts` | Base instructions + lesson addon |

## Data flow (one user message)

1. User types at the `>` prompt (or a slash command).
2. CLI appends a user message to `Session` and calls `TurnLoop.runTurn`.
3. TurnLoop builds messages (system + trimmed history), calls `ModelClient.chat` with tool schemas.
4. If the assistant returns `tool_calls`, each tool runs via `ToolRegistry`; results append as tool messages; loop continues.
5. If the assistant returns plain text, that is the final reply for the turn.
6. CLI prints the reply and any tool traces.

See [TURN_LOOP.md](./TURN_LOOP.md) for a step-by-step walkthrough that maps 1:1 to code.

**Tools are local; the model only proposes.** We advertise schemas (name + description + JSON params) on each chat call; NIM returns `tool_calls`; the harness executes on disk/shell and sends results back. That propose → execute → observe split — and how it foreshadows MCP — is documented in [TOOLS.md](./TOOLS.md). After writes/failed bash, the harness may append `<system-reminder>` hints so the model verifies instead of inventing scripts ([VERIFY.md](./VERIFY.md)).

## Core contracts (tiny on purpose)

- **Tool** — name, description, JSON-schema params, `execute(args, ctx) → ToolResult`.
- **LessonPlugin** — `id`, `title`, `topics[]`, `systemPromptAddon`, optional `starterFiles`, optional `evaluate` stub. Core never hardcodes curriculum content.
- **ModelClient** — `chat({ messages, tools }) → assistant message` (content and/or tool_calls).

## Design constraints from NIM

Free-tier rate/credit limits force **small prompts, few tools, short histories**. The turn loop keeps only message history between turns and trims with a hard window. Details: [NIM_CONSTRAINTS.md](./NIM_CONSTRAINTS.md).

## Not in this prototype

- Graders / automated assessment beyond an optional `evaluate` stub
- IDE UI, web UI, rich TUI (ink/blessed)
- Persistence, auth, streaming UX polish
- Multi-agent orchestration
- Full Claude Code parity
- Monorepo packaging / production hardening

## Extending without touching the loop

- **New tool** — add a file under `src/tools/`, register in `src/tools/registry.ts`.
- **New lesson** — add a file under `src/lessons/`, register in `src/lessons/registry.ts`. No edits to `turn-loop.ts`.

See [LESSON_PLUGINS.md](./LESSON_PLUGINS.md).
