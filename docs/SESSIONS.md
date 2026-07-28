# Sessions (conversation persistence)

Why this exists: without a thread, every turn is amnesia — the model forgets it already wrote `graph.test.ts`. Persistence turns tool calls into a project.

Pattern borrowed conceptually from mature agents (e.g. grok-build’s JSONL session dirs): **append-only message log + small summary**, resume by id or “most recent.”

## On-disk layout (workspace-local, educational)

```
.hey-teach/sessions/<session-id>/
  summary.json      # id, lessonId, timestamps, messageCount
  messages.jsonl    # one Message per line (user / assistant / tool)
```

`.hey-teach/` is gitignored — local state, not curriculum.

| File | Role |
|------|------|
| `messages.jsonl` | Source of truth for the model-facing thread |
| `summary.json` | Index + **outcome labels** + teacherModel (see [EXPORT.md](./EXPORT.md)) |

Atomic rewrite for `summary.json` (temp + rename). Append-only for JSONL.

## CLI

| Flag / command | Behavior |
|----------------|----------|
| (default) | Resume most recent session in this workspace, or create one |
| `--new` | Always start a fresh session |
| `--session <id>` | Resume that id (error if missing) |
| `/sessions` | List sessions (newest first); `*` = active; shows outcome |
| `/outcome <label>` | Manual outcome label (`green` / `red` / …) |
| `/evaluate` | Run lesson grader; set outcome |
| `/export [filter]` | Write trajectories JSONL ([EXPORT.md](./EXPORT.md)) |
| `/clear` | Wipe in-memory + on-disk messages; **keep** the same session id |
| `/new` | Start a new session id mid-REPL (old one stays on disk) |

## What is stored

Full OpenAI-shaped `Message` objects: user text, assistant text, `tool_calls`, and `tool` results. That pairing is what lets the next process continue mid-loop (e.g. after a `read_file`).

System prompts are **not** stored — rebuilt each turn from the active lesson (see `build-system-prompt.ts`).

## Related code

| Piece | Path |
|-------|------|
| In-memory session | `src/session.ts` |
| Disk store | `src/session-store.ts` |
| Resume wiring | `src/cli.ts` |

## Not yet (on purpose)

- Compaction / summarization of long threads
- Cloud sync
- Rewind checkpoints
- Separate “UI event log” vs chat history (grok-build splits these; we keep one JSONL for clarity)
- Training / GGUF conversion (export only — [EXPORT.md](./EXPORT.md))
