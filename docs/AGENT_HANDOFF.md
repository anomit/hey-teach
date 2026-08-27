# Agent handoff

Machine-oriented brief so another coding agent can continue this repo without a human walkthrough. Humans: [USAGE.md](./USAGE.md). Short rules: [../AGENTS.md](../AGENTS.md).

## Mission

Hey Teach is a **readable** turn-based coding harness for teaching agent loops under free NVIDIA NIM. Ship the smallest loop that is honest about propose → execute → observe. Capture labeled trajectories for later SFT. Do not become a product agent.

## Current surface (do not rediscover)

| Piece | Truth |
|-------|--------|
| REPL | `src/cli.ts` — readline `for-await` (pipes work) |
| Mock | `src/model/mock-client.ts` — first user turn → `read_file README.md`, then text |
| NIM | `src/model/nim-client.ts` — OpenAI SDK → `https://integrate.api.nvidia.com/v1`. Pace + bounded 429/5xx retries in `src/model/nim-retry.ts` |
| Tools | Exactly four: `read_file`, `write_file`, `edit_file`, `bash`. Path escape rejected in `src/tools/path-guard.ts` |
| Lesson | `stub-bfs` default; also `stub-dfs`, `stub-dijkstra`. `/lesson reload` re-imports `src/lessons/*.ts`. Student files under `lessons/<algo>/` are not plugins |
| Sessions | `.hey-teach/sessions/<id>/{summary.json,messages.jsonl}` |
| Fork | `SessionStore.fork` copies prefix; `parentId` + `forkedAtIndex`; snap via `src/session-fork.ts` |
| Outcomes | `unlabeled \| green \| red \| abandoned \| error`. Sources: `manual`, `bash_infer`, `lesson_evaluate` |
| Export | `npm run export -- --all` → JSONL, reminders stripped |

System prompts are **not** stored. They are rebuilt each turn from `build-system-prompt.ts` + lesson addon.

## Invariants (break these = wrong)

1. **Parent JSONL is never truncated by `/fork`.** Copy into a new id.
2. **Fork index is 0-based** and matches `/history` / `messages.jsonl` line order.
3. **Incomplete tool rounds snap back** to a valid OpenAI prefix (pending `tool_call_id`s must be empty). Print `snapped n → n'`.
4. **Child outcome is `unlabeled`.** Do not copy parent green/red.
5. **Workspace is not a tree.** Fork conversation only.
6. **`/clear` ≠ rewind.** Same id, empty log, outcome reset to `unlabeled`.
7. **`trimMessages` is last-N** (`MAX_MESSAGES` in `turn-loop.ts`). Do not “fix” that as a drive-by.
8. **Starter files never overwrite.** `applyStarterFiles` skips existing paths.
9. **`bash_infer` must not clobber** `manual`, `abandoned`, or `error` (`bashInferMayUpdate`).
10. **Export one object per session id.** Include `parentId` / `forkedAtIndex` when set.

## Task checklists

### Add a lesson (no loop edits)

1. Create `src/lessons/<id>.ts` exporting a `LessonPlugin` (`id`, `title`, `topics`, `systemPromptAddon`, optional `starterFiles`, optional `evaluate`).
2. `register(...)` in `src/lessons/registry.ts`.
3. If you add starter files, put curriculum-owned sources under `lessons/` (not `.hey-teach/`).
4. If you add `evaluate`, map exit 0 → `{ passed: true }` so `/evaluate` can write `green`/`red`.
5. Update [LESSON_PLUGINS.md](./LESSON_PLUGINS.md) and [USAGE.md](./USAGE.md) §3.
6. Do not touch `turn-loop.ts`.

### Add a tool (rare — justify it)

1. Implement `ToolDefinition` in `src/tools/<name>.ts`.
2. Register in `src/tools/registry.ts`.
3. Paths through `resolveWorkspacePath`. Shell cwd = workspace root.
4. Document in [TOOLS.md](./TOOLS.md). NIM free tier wants **few** tools — default answer is no.

### Change session / fork / export

1. Persist via existing `summary.json` + `messages.jsonl` only.
2. Extend `SessionSummary` + `patchSummary` so new fields survive `appendMessage`.
3. Add/adjust `src/**/*.test.ts` (already used for snap, history, tree, fork, export lineage).
4. Exclude new tests from `tsc` (`tsconfig` already excludes `src/**/*.test.ts`).
5. Update [SESSIONS.md](./SESSIONS.md) / [EXPORT.md](./EXPORT.md) / [USAGE.md](./USAGE.md).

## Verification matrix

| Change | Command / probe |
|--------|------------------|
| Any TS | `npm run typecheck` |
| Session/fork/history/export | `npm test` |
| CLI slash / resume | `printf '…\n/quit\n' \| npm run start -- --model mock` |
| Resume history | Create a session with a turn, then start **without** `--new`; banner must be followed by numbered history blocks |
| Fork | `/fork 1` on a 4-message mock turn (user, tool_calls, tool, text) must snap to `0` if you fork at the tool_calls assistant; parent `wc -l messages.jsonl` unchanged |
| Evaluate | `/evaluate` after editing `lessons/bfs/graph.ts` |
| Export | `npm run export -- --all` then `python3 -c "import json,sys; [json.loads(l) for l in open(sys.argv[1])]"` on the printed path |
| NIM | `/doctor` — do not claim chat works from models.list alone |

## Layout (only the files that matter)

```
src/cli.ts                 REPL
src/cli/history.ts         resume + /history
src/cli/session-tree.ts    /sessions tree
src/turn-loop.ts           one turn
src/session.ts             in-memory + store hook
src/session-store.ts       JSONL + fork()
src/session-fork.ts        snapForkIndex
src/session-outcome.ts     labels
src/outcome/bash-infer.ts  test-output → green/red
src/export/trajectories.ts JSONL writer
src/export-cli.ts          npm run export
src/lessons/               plugins
src/tools/                 four tools + reminders + path-guard
src/model/                 Mock + NIM
src/prompt/                system prompt
lessons/bfs/               stub-bfs student files + tests
lessons/dfs/               stub-dfs student files + tests
.hey-teach/                local state (do not commit)
```

## Out of scope unless the user names it

- Compaction / summarization
- In-place rewind
- Workspace or git snapshots on fork
- Prefix-stable KV-cache window
- DPO pair mining (lineage fields are enough)
- MCP server
- Training / GGUF
- Rich TUI

## Voice

Docs and comments teach. Prefer a concrete path and command over a metaphor. Do not add marketing. When you add a command, put it in the README slash table **and** [USAGE.md](./USAGE.md).
