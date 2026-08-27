# Agent instructions (Hey Teach)

Read this before editing. Human walkthrough: [docs/USAGE.md](docs/USAGE.md). Full pickup brief: [docs/AGENT_HANDOFF.md](docs/AGENT_HANDOFF.md). Concept map: [docs/README.md](docs/README.md).

## What this repo is

A **tiny educational coding harness** (TypeScript / Node 20+). The product is the loop, not a polished agent. Lessons are plugins. Default model is **MockClient** (no API key). NIM is optional (`--model nim`).

Workspace root = `process.cwd()`. Session state is gitignored under `.hey-teach/`.

## Non-negotiables

- Do **not** grow the tool set, add a TUI, or add a second model protocol.
- Do **not** edit `src/turn-loop.ts` to add curriculum. Lessons go in `src/lessons/` + `registry.ts`.
- Do **not** treat `/clear` as rewind. Branch with `/fork`; parent `messages.jsonl` is append-only.
- Do **not** snapshot or roll back workspace files on fork. Document that if you touch fork UX.
- Do **not** change `trimMessages` to a prefix-stable window unless that is the task. Forks copy prefixes on disk; the loop still keeps last-N.
- Do **not** add LoRA/QLoRA/GGUF training scripts. Stop at labeled JSONL export.
- Do **not** parse free-form “tool calls” from assistant text. Structured `tool_calls` only.
- Keep the JSONL store. No new session file format.

## Default starting branch

Repo default (`main`) may lag feature work. **Inspect `git log` / current branch before assuming sessions, outcomes, fork, or export exist.** Cloud “implement the plan” often checks out `main` even if an environment was built on a feature branch. Those are different layers (VM snapshot vs git ref).

## Verify before you claim done

```bash
npm install          # if node_modules missing
npm run typecheck
npm test
```

Piped mock smoke (no TTY, no API key):

```bash
printf '/help\n/quit\n' | npm run start -- --new --model mock
```

Lesson grader (uses current `lessons/bfs/graph.ts` on disk):

```bash
printf '/evaluate\n/quit\n' | npm run start -- --new --model mock
```

Headless export:

```bash
npm run export -- --all
```

## Where to edit

| Task | Files |
|------|--------|
| Slash command / REPL | `src/cli.ts` |
| History reprint | `src/cli/history.ts` |
| `/sessions` tree | `src/cli/session-tree.ts` |
| Disk sessions / fork | `src/session-store.ts`, `src/session-fork.ts` |
| Outcomes | `src/session-outcome.ts`, `src/outcome/bash-infer.ts` |
| Export JSONL | `src/export/trajectories.ts`, `src/export-cli.ts` |
| New lesson | `src/lessons/<id>.ts` + register in `src/lessons/registry.ts` |
| New tool | `src/tools/<name>.ts` + register in `src/tools/registry.ts` |
| System prompt policy | `src/prompt/build-system-prompt.ts` |
| Reminders | `src/tools/reminders.ts` |

Tests: `src/**/*.test.ts` (excluded from `tsc`). Lesson tests: `lessons/bfs/graph.test.ts`, `lessons/dfs/graph.test.ts`.

## Docs to update when you change behavior

Match the surface you touched: [docs/USAGE.md](docs/USAGE.md) (commands), [docs/SESSIONS.md](docs/SESSIONS.md) / [docs/EXPORT.md](docs/EXPORT.md), [docs/AGENT_HANDOFF.md](docs/AGENT_HANDOFF.md) (invariants), [README.md](README.md) slash table.
