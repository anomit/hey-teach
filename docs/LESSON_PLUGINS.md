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
| `evaluate` | no | Optional function. `/evaluate` calls it and maps `passed` → session `green`/`red`. Not a required test runner — each stub lesson hardcodes vitest on its own `lessons/<algo>/graph.test.ts` |

The **core never hardcodes** Dijkstra, BFS, or any lesson body. It only loads plugins from the registry.

## How a lesson attaches

1. Plugin registered in `src/lessons/registry.ts`.
2. User runs `/lesson stub-bfs`, `/lesson stub-dfs`, or `/lesson stub-dijkstra` (or starts a session — new sessions get the registry default, currently `stub-bfs`).
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

## Example: `stub-dijkstra`

Same shape. `src/lessons/stub-dijkstra.ts` frames weighted shortest paths, writes `lessons/dijkstra/graph.ts` if missing, and grades with `npx vitest run lessons/dijkstra/graph.test.ts`. Student files on disk are **not** a lesson — without this plugin, `/lesson` will not list Dijkstra.

## Hot reload

The REPL loads plugins once at process start. Writing `lessons/dijkstra/graph.ts` in an open session does not register a lesson. After you add `src/lessons/stub-<id>.ts` (exporting a `LessonPlugin`), run `/lesson reload` (alias: `/lessons`). That cache-busts `src/lessons/*.ts` into the in-memory map. If import fails, restart the process.

## Adding another lesson (no core loop edits)

1. Create `src/lessons/<id>.ts` exporting a `LessonPlugin`.
2. Register it in `src/lessons/registry.ts` so a fresh start sees it (`/lesson reload` also scans the directory).
3. Optionally add `starterFiles` and an `evaluate` function.
4. `/lesson reload` in an open REPL, then `/lesson <id>`.

Do **not** edit `turn-loop.ts` or tool implementations.

## Why plugins

Free NIM context is scarce. Lessons inject only the prompt text needed for the current exercise instead of shipping a giant curriculum blob into every turn.
