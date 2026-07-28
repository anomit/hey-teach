# Lesson plugins

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
| `evaluate` | no | Optional grader; CLI `/evaluate` calls it and writes session outcome (`green`/`red`) |

The **core never hardcodes** Dijkstra, BFS, or any lesson body. It only loads plugins from the registry.

## How a lesson attaches

1. Plugin registered in `src/lessons/registry.ts`.
2. User runs `/lesson stub-bfs` (or starts with a default lesson).
3. Session stores `activeLessonId`.
4. `buildSystemPrompt` concatenates base instructions + `systemPromptAddon`.
5. Optional `starterFiles` are written into the workspace (missing paths only — existing files are left alone).

The turn loop and tools stay unchanged.

## Example: `stub-bfs`

`src/lessons/stub-bfs.ts` contributes:

- Metadata (`id`, `title`, `topics`)
- A short system-prompt addon that frames the exercise
- A tiny starter file map (e.g. `lessons/bfs/graph.ts` skeleton)

`stub-bfs` ships an `evaluate()` that runs `npx vitest run lessons/bfs/graph.test.ts`. See [EXPORT.md](./EXPORT.md).

## Adding a Dijkstra lesson (no core edits)

1. Create `src/lessons/dijkstra.ts` exporting a `LessonPlugin`.
2. Register it in `src/lessons/registry.ts` (`lessons.set(plugin.id, plugin)`).
3. Optionally add `starterFiles` and an `evaluate` stub.
4. Run `/lesson dijkstra`.

Do **not** edit `turn-loop.ts`, `cli.ts` (beyond slash-command listing which reads the registry), or tool implementations.

## Why plugins

Free NIM context is scarce. Lessons inject only the prompt text needed for the current exercise instead of shipping a giant curriculum blob into every turn.
