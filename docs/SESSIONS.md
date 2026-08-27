# Sessions (conversation persistence)

Operator steps (resume, `/history`, `/fork`): [USAGE.md](./USAGE.md). Agent invariants: [AGENT_HANDOFF.md](./AGENT_HANDOFF.md).

Why this exists: without a thread, every turn is amnesia — the model forgets it already wrote `graph.test.ts`. Persistence turns tool calls into a project.

Pattern borrowed conceptually from mature agents (e.g. grok-build’s JSONL session dirs): **append-only message log + small summary**, resume by id or “most recent.”

## On-disk layout (workspace-local, educational)

```
.hey-teach/sessions/<session-id>/
  summary.json      # id, lessonId, timestamps, messageCount, lineage
  messages.jsonl    # one Message per line (user / assistant / tool)
```

`.hey-teach/` is gitignored — local state, not curriculum.

| File | Role |
|------|------|
| `messages.jsonl` | Source of truth for the model-facing thread |
| `summary.json` | Index + **outcome labels** + teacherModel + optional `parentId` / `forkedAtIndex` (see [EXPORT.md](./EXPORT.md)) |

Atomic rewrite for `summary.json` (temp + rename). Append-only for JSONL. A fork **copies** a prefix into a new id; the parent log is never truncated.

## CLI

| Flag / command | Behavior |
|----------------|----------|
| (default) | Resume most recent session in this workspace, or create one. **Reprints the thread** (colorized blocks, diffs expanded) after the banner when the log is non-empty. |
| `--new` | Always start a fresh session |
| `--session <id>` | Resume that id (error if missing); same history reprint |
| `/history` | Print the numbered thread (0-based JSONL indices; same expanded reprint as resume) |
| `/fork [n]` | Copy prefix through index `n` (or HEAD) into a new session id; switch the REPL to the child |
| `/sessions` | Tree: parent → children; `*` = active; `outcome/source` (e.g. `green/evaluate`, `unlabeled`); `fork@n` on children |
| `/outcome <label>` | Manual export label on this session (`green` / `red` / …) |
| `/evaluate` | Call this lesson’s `evaluate()` (if any); stamp this session green/red |
| `/export [filter]` | Write trajectories JSONL ([EXPORT.md](./EXPORT.md)) |
| `/clear` | Wipe in-memory + on-disk messages; **keep** the same session id; reset outcome to `unlabeled` (not rewind) |
| `/new` | Start a new **empty** session id mid-REPL (old one stays on disk) |

`/fork` is a branch, not an in-place truncate. `/clear` stays a wipe of the current id (outcome reset).

**Lesson id** is stamped at session create with the registry default (`stub-bfs` today). `/lesson <id>` updates the current session only. It is not inferred from the transcript. See [USAGE.md](./USAGE.md) §3.

### Fork details

- Child `summary.json` gets `parentId` and `forkedAtIndex` (inclusive, 0-based).
- Child **outcome** starts `unlabeled` — it does not inherit the parent’s green/red.
- If `n` lands mid tool-round (assistant `tool_calls` without matching `tool` results), the index **snaps back** to the last valid OpenAI prefix. The CLI prints `snapped n → n'`.
- **Workspace files are not copied or rolled back.** The child’s transcript is a prefix; the disk is still the parent’s latest tree.

The turn loop still trims with a hard **last-N** window (`trimMessages` in `turn-loop.ts`). Forks copy prefixes on disk; the in-flight prompt may still slide. Prefix-stable caching is a follow-up.

## What is stored

Full OpenAI-shaped `Message` objects: user text, assistant text, `tool_calls`, and `tool` results. That pairing is what lets the next process continue mid-loop (e.g. after a `read_file`).

System prompts are **not** stored — rebuilt each turn from the active lesson (see `build-system-prompt.ts`).

## Related code

| Piece | Path |
|-------|------|
| In-memory session | `src/session.ts` |
| Disk store + `fork()` | `src/session-store.ts` |
| Snap incomplete tool pairs | `src/session-fork.ts` |
| History printer | `src/cli/history.ts` |
| `/sessions` tree | `src/cli/session-tree.ts` |
| Resume wiring | `src/cli.ts` |

## Not yet (on purpose)

- Compaction / summarization of long threads
- Cloud sync
- In-place rewind / truncate billed as rewind (use `/fork`, not `/clear`)
- Prefix-stable turn-loop window (trees are on disk; trim is still last-N)
- Workspace / git snapshots on fork
- Separate “UI event log” vs chat history (grok-build splits these; we keep one JSONL for clarity)
- Training / GGUF conversion (export only — [EXPORT.md](./EXPORT.md))
