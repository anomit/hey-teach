# Lesson plugins

Checklist for adding a lesson: [AGENT_HANDOFF.md](./AGENT_HANDOFF.md). How to run `stub-bfs`: [USAGE.md](./USAGE.md) §3.

Curriculum plugs into the harness without touching the turn loop.

## Contract

Defined in `src/lessons/types.ts`:

| Field | Required | Purpose |
|-------|----------|---------|
| `id` | yes | Stable slug (e.g. `stub-bfs`) |
| `title` | yes | Human-readable name for the CLI banner |
| `topics` | yes | Tags for discovery (`/lesson` listing) |
| `systemPromptAddon` | yes | Text appended to the system prompt when active |
| `starterFiles` | no | Map of relative path → file contents written on lesson select |
| `evaluate` | no | Optional function. `/evaluate` calls it and maps `passed` → session `green`/`red`. Not a required test runner — `stub-bfs` / `stub-dfs` spawn vitest on their own `lessons/<algo>/graph.test.ts` |

The **core never hardcodes** Dijkstra, BFS, or any lesson body. It only loads plugins from the registry.

## How a lesson attaches

1. Plugin registered in `src/lessons/registry.ts`.
2. User runs `/lesson stub-bfs` or `/lesson stub-dfs` (or starts a session — new sessions get the registry default, currently `stub-bfs`).
3. Session stores `lessonId` on `summary.json`. It is not inferred from the transcript.
4. `buildSystemPrompt` concatenates base instructions + `systemPromptAddon`.
5. Optional `starterFiles` are written into the workspace (missing paths only — existing files are left alone).

The turn loop and tools stay unchanged.

## Example: `stub-bfs`

`src/lessons/stub-bfs.ts` contributes:

- Metadata (`id`, `title`, `topics`)
- A short system-prompt addon that frames the exercise
- A tiny starter file map (e.g. `lessons/bfs/graph.ts` skeleton)

`stub-bfs`’s `evaluate()` is a hardcoded `npx vitest run lessons/bfs/graph.test.ts` (that path lives in `src/lessons/stub-bfs.ts`, next to the student file `lessons/bfs/graph.ts`). See [EXPORT.md](./EXPORT.md).

## Example: `stub-dfs`

Same shape, different paths. `src/lessons/stub-dfs.ts` frames DFS, writes `lessons/dfs/graph.ts` if missing, and grades with `npx vitest run lessons/dfs/graph.test.ts`. Visit order is recursive DFS / adjacency-list order (not BFS). New sessions still default to `stub-bfs`; switch with `/lesson stub-dfs`.

## Adding a Dijkstra lesson (no core edits)

1. Create `src/lessons/dijkstra.ts` exporting a `LessonPlugin`.
2. Register it in `src/lessons/registry.ts` (`lessons.set(plugin.id, plugin)`).
3. Optionally add `starterFiles` and an `evaluate` stub.
4. Run `/lesson dijkstra`.

Do **not** edit `turn-loop.ts`, `cli.ts` (beyond slash-command listing which reads the registry), or tool implementations.

## Why plugins

Free NIM context is scarce. Lessons inject only the prompt text needed for the current exercise instead of shipping a giant curriculum blob into every turn.
