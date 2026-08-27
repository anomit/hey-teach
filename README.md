# Hey Teach

Proto-framework to learn about harnesses and other AI meta for programmers.

Minimal TypeScript/Node turn-based coding harness. Lessons are plugins; the harness teaches how agent loops work under free NVIDIA NIM constraints.

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

## Sessions and export

Conversation threads persist under `.hey-teach/sessions/` (gitignored). Default: resume the most recent session **and reprint numbered history**. `--new` starts fresh; `--session <id>` resumes a specific one. `/fork [n]` copies a prefix into a new session id (workspace files are not rolled back).

Label outcomes (`/outcome`, `/evaluate`, or automatic bash test inference) and export fine-tune-ready JSONL:

```bash
npm run export -- --all
```

Step-by-step: [USAGE.md](docs/USAGE.md). Semantics: [SESSIONS.md](docs/SESSIONS.md), [EXPORT.md](docs/EXPORT.md).

## Slash commands

| Command | Action |
|---------|--------|
| `/lesson [id]` | List lessons, or activate one (writes missing starter files) |
| `/tools` | List tools |
| `/sessions` | Session tree (* = active, outcome, fork@n) |
| `/history` | Numbered thread (0-based; pick `n` for `/fork`) |
| `/fork [n]` | Branch from index `n` (or HEAD); switch to the child |
| `/outcome <label>` | Manual outcome: green / red / abandoned / error / unlabeled |
| `/evaluate` | Run lesson grader; set outcome |
| `/export [filter]` | Export trajectories (active, all, or by outcome) |
| `/new` | Start a fresh session |
| `/doctor` | Probe NIM endpoint + model (auth vs chat hang) |
| `/clear` | Clear conversation history (same session id) |
| `/help` | Show help |
| `/quit` | Exit |

## What this teaches

- One turn = model ↔ tools until a final reply ([TURN_LOOP.md](docs/TURN_LOOP.md))
- Tools are schemas + local executors (why MCP exists) ([TOOLS.md](docs/TOOLS.md))
- Session persistence — the conversation thread ([SESSIONS.md](docs/SESSIONS.md))
- Verify-after-write — don’t invent `npm test` ([VERIFY.md](docs/VERIFY.md))
- Capture → label → export for later local fine-tunes ([EXPORT.md](docs/EXPORT.md))
- Curriculum as plugins ([LESSON_PLUGINS.md](docs/LESSON_PLUGINS.md))
- Why free NIM forces a small harness ([NIM_CONSTRAINTS.md](docs/NIM_CONSTRAINTS.md))

## Not in this prototype

IDE UI, multi-agent, rich TUI, LoRA/GGUF training scripts, production hardening.
