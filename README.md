# Hey Teach

Proto-framework to learn about harnesses and other AI meta for programmers.

Minimal TypeScript/Node turn-based coding harness. A **session is bound to one lesson**. The chat is the trajectory; the lesson’s optional `evaluate()` (or `/outcome`, or a test run via `bash`) stamps how that attempt ended. Export those labeled threads as JSONL — the input for later SFT of a **small, specialized local model**. This repo stops at export; it does not train.

```
lesson plugin  →  session (messages.jsonl + lessonId)
               →  outcome (green / red / …)
               →  export JSONL
               →  (later, elsewhere) light SFT / QLoRA
```

**Run it:** [docs/USAGE.md](docs/USAGE.md) — first REPL, stub-bfs, fork, export.

**Incoming agents:** [AGENTS.md](AGENTS.md) then [docs/AGENT_HANDOFF.md](docs/AGENT_HANDOFF.md).

**Concepts:** [docs/README.md](docs/README.md) indexes architecture, turn loop, tools, sessions, export.

## Requirements

- Node.js 20+
- Optional: `NVIDIA_API_KEY` for real NIM calls

## Install & run (mock — default)

```bash
npm install
npm run start
```

Opens a Claude Code–shaped REPL in the current working directory (workspace root). Uses `MockClient` so no API key is required.

```bash
npm run typecheck
```

## NIM mode

```bash
cp .env.example .env
# set NVIDIA_API_KEY and optionally NIM_MODEL

npm run start -- --model nim
```

Hits `https://integrate.api.nvidia.com/v1` via the OpenAI SDK. Tool-calling quality depends on the model; see [docs/NIM_CONSTRAINTS.md](docs/NIM_CONSTRAINTS.md).

## Session, lesson, outcome, export

This is the product loop. The REPL exists to produce **one labeled trajectory per lesson attempt**.

| Piece | What it is |
|-------|------------|
| **Lesson** | A plugin (`src/lessons/<id>.ts` + register in `registry.ts`). Prompt addon, optional starter files, optional `evaluate()`. New sessions default to `stub-bfs`; `stub-dfs` is also registered. `/lesson <id>` switches **this** session. The id is not inferred from the chat. |
| **Session** | `.hey-teach/sessions/<id>/{summary.json,messages.jsonl}`. `summary.json` stores `lessonId` and the outcome. Resume reprints the thread; `--new` / `/new` starts empty; `/fork [n]` copies a prefix (workspace files are not rolled back). |
| **Outcome** | A label on **this** session for export, not a score of the transcript. `/evaluate` calls that lesson’s `evaluate()` if it exists (`stub-bfs` / `stub-dfs` hardcode vitest on their `graph.test.ts`) and writes `green`/`red`. `/outcome` is manual. A `bash` test run may infer green/red. Unlabeled sessions are not training-ready. |
| **Export** | One JSON object per session: `lessonId`, `outcome`, `teacherModel`, messages. Filter `/export green` when you want successful attempts at a skill. |

```bash
npm run export -- --all
npm run export -- --outcome green --out ./data/train.jsonl
```

A later small-model loop (QLoRA SFT on green BFS traces, then maybe DFS, and so on) is **out of this repo**. Prefer curated green (or red→green forks) over dumping every chat. Details: [USAGE.md](docs/USAGE.md) §3, [SESSIONS.md](docs/SESSIONS.md), [EXPORT.md](docs/EXPORT.md), [LESSON_PLUGINS.md](docs/LESSON_PLUGINS.md).

## Slash commands

| Command | Action |
|---------|--------|
| `/lesson [id]` | List, switch this session, or `/lesson reload` (new plugins) |
| `/tools` | List tools |
| `/sessions` | Session tree (* = active, outcome/source, fork@n) |
| `/history` | Replay thread with diffs (0-based; pick `n` for `/fork`) |
| `/fork [n]` | Branch from index `n` (or HEAD); switch to the child |
| `/outcome <label>` | Manual export label: green / red / abandoned / error / unlabeled |
| `/evaluate` | Run this lesson’s `evaluate()`; stamp this session green/red |
| `/export [filter]` | Export trajectories (active, all, or by outcome) |
| `/new` | Start a fresh session |
| `/doctor` | Probe NIM endpoint + model (auth vs chat hang) |
| `/clear` | Wipe this id’s messages; reset outcome to unlabeled |
| `/help` | Show help |
| `/quit` | Exit |

## What this teaches

- One turn = model ↔ tools until a final reply ([TURN_LOOP.md](docs/TURN_LOOP.md))
- Tools are schemas + local executors (why MCP exists) ([TOOLS.md](docs/TOOLS.md))
- Session persistence — the conversation thread ([SESSIONS.md](docs/SESSIONS.md))
- Verify-after-write — don’t invent `npm test` ([VERIFY.md](docs/VERIFY.md))
- Session bound to a lesson, then an outcome, then JSONL for a small specialist model ([EXPORT.md](docs/EXPORT.md))
- Curriculum as plugins — one file + registry; `evaluate()` is optional ([LESSON_PLUGINS.md](docs/LESSON_PLUGINS.md))
- Why free NIM forces a small harness ([NIM_CONSTRAINTS.md](docs/NIM_CONSTRAINTS.md))

## Not in this prototype

IDE UI, multi-agent, rich TUI, LoRA/GGUF training scripts, production hardening.
