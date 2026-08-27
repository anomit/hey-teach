# Docs index

Two kinds of writing in this folder. Do not mix them.

## Start here (how to run it)

| Doc | Audience | What it is |
|-----|----------|------------|
| [USAGE.md](./USAGE.md) | You, at a keyboard | First REPL, stub-bfs, fork, export, NIM, failure table |
| [../AGENTS.md](../AGENTS.md) | Any coding agent | Hard rules + verify commands (read first) |
| [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) | Next agent on this repo | Invariants, checklists, file map, out of scope |

## Concept (why it is shaped this way)

| Doc | What it teaches |
|-----|-----------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Module map and data flow |
| [TURN_LOOP.md](./TURN_LOOP.md) | One turn, 1:1 with `turn-loop.ts` |
| [TOOLS.md](./TOOLS.md) | Propose vs execute (MCP foreshadow) |
| [SESSIONS.md](./SESSIONS.md) | JSONL store, trees, fork semantics |
| [EXPORT.md](./EXPORT.md) | Outcomes + trajectory JSONL |
| [VERIFY.md](./VERIFY.md) | Reminders; don’t invent `npm test` |
| [LESSON_PLUGINS.md](./LESSON_PLUGINS.md) | How curriculum plugs in |
| [NIM_CONSTRAINTS.md](./NIM_CONSTRAINTS.md) | Free-tier limits that cap the design |

If you are about to change code, update the matching **usage** doc (commands, flags, invariants) and only then the concept doc if the idea changed.
