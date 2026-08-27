# Usage (operator playbook)

This is the **do-this-next** guide. Concept docs live in [README.md](./README.md) in this folder. Incoming coding agents: start at [../AGENTS.md](../AGENTS.md) and [AGENT_HANDOFF.md](./AGENT_HANDOFF.md).

Cwd is always the **workspace** (usually the repo root). Sessions and exports land in `.hey-teach/` (gitignored).

## 0. Install

```bash
node -v          # need 20+
npm install
npm run typecheck
npm test
```

`npm test` runs Vitest: harness unit tests under `src/**/*.test.ts` **and** `lessons/bfs/graph.test.ts`.

## 1. First REPL (mock — no API key)

```bash
npm run start -- --new --model mock
```

You should see the Hey Teach banner, `model mock`, `lesson stub-bfs`, `new session`, then `>`.

Type a normal sentence (not a slash command), e.g. `hello`. MockClient’s first turn **always** calls `read_file` on `README.md`, then replies. You should see:

```
→ read_file {"path":"README.md"}
← ok …
Mock model: I read the file via the tool. …
```

Then `/history`. Indices are **0-based JSONL lines**:

```
  0  user      hello
  1  assistant tool_calls: read_file
  2  tool      read_file  ok  …
  3  assistant Mock model: …
```

`/quit` to exit. Default next start **resumes** this session and **reprints that history** after the banner.

| Flag | When |
|------|------|
| (none) | Resume most-recent session in this cwd |
| `--new` | Fresh empty session id |
| `--session <id>` | That id or error |
| `--model mock` | Scripted client (default) |
| `--model nim` | NVIDIA NIM; needs `NVIDIA_API_KEY` |

## 2. Piped smoke (no TTY)

Readline is `for-await`, so pipes work:

```bash
printf 'hello\n/history\n/sessions\n/quit\n' | npm run start -- --new --model mock
```

`/history` must print numbered lines. `/sessions` must show `*` on the active id.

## 3. Lesson: stub-bfs

Default lesson is `stub-bfs`. Starter file is `lessons/bfs/graph.ts` (written only if missing). Tests are `lessons/bfs/graph.test.ts`.

```text
> /lesson
* stub-bfs — Stub: Breadth-First Search [graphs, bfs, algorithms]
> /evaluate
```

`/evaluate` runs `npx vitest run lessons/bfs/graph.test.ts` and sets outcome `green` or `red` (`outcomeSource: lesson_evaluate`). An empty `bfs` implementation is **red**. A correct implementation is **green**.

Manual override (wins until you change it again):

```text
> /outcome abandoned skipping-for-now
```

`bash_infer` will not clobber `manual`, `abandoned`, or `error`.

## 4. Fork a prefix (do not truncate)

1. `/history` — pick an index `n`.
2. `/fork 1` — if `1` is an assistant `tool_calls` with no tool results yet, expect `snapped 1 → 0`.
3. REPL switches to the **child**. Parent JSONL bytes stay the same.
4. `/sessions` — parent with indented children, `fork@n`, `*` on the child.
5. Child outcome is `unlabeled` even if the parent is `green`.

`/fork` with no args copies through HEAD (after snap).

**Disk files are not rolled back.** If the parent already edited `graph.ts`, the child transcript may disagree with the workspace. Say so; do not invent a file snapshot.

`/clear` wipes the **current** id in place. That is not rewind.

## 5. Export trajectories

In the REPL:

```text
> /export
> /export all
> /export green
```

Headless (no REPL):

```bash
npm run export -- --all
npm run export -- --outcome green --out ./data/train.jsonl
```

Default output: `.hey-teach/exports/trajectories-<stamp>.jsonl`. Each line is one session. Forked sessions include `parentId` and `forkedAtIndex`. Tool contents have `<system-reminder>` stripped.

See [EXPORT.md](./EXPORT.md) for the schema.

## 6. NIM (optional)

```bash
cp .env.example .env
# set NVIDIA_API_KEY
# optionally NIM_MODEL and NIM_TIMEOUT_MS

npm run start -- --model nim
```

Inside the REPL:

```text
> /doctor
```

`GET /v1/models` succeeding does **not** mean chat works. If catalog lists the id but chat hangs, switch `NIM_MODEL`. Details: [NIM_CONSTRAINTS.md](./NIM_CONSTRAINTS.md).

## 7. Slash cheat sheet

| Command | Use it when |
|---------|-------------|
| `/help` | You forgot the table |
| `/lesson [id]` | Switch curriculum; writes **missing** starter files only |
| `/tools` | Confirm the four tools |
| `/history` | Need an index for `/fork` |
| `/fork [n]` | Branch the thread; keep the parent |
| `/sessions` | See the tree + outcomes |
| `/outcome <label> [note]` | Force a label |
| `/evaluate` | Run the lesson grader |
| `/export [filter]` | Write JSONL |
| `/new` | Empty sibling session (not a fork) |
| `/clear` | Wipe this id’s messages |
| `/doctor` | NIM auth vs chat |
| `/quit` | Exit |

## 8. What “a good BFS session” looks like

1. `--new`, lesson `stub-bfs`.
2. Model reads `lessons/bfs/graph.ts` and `graph.test.ts` via tools.
3. `/evaluate` or `bash` + vitest → **red** (empty or broken `bfs`).
4. Implement `bfs` via `edit_file` / `write_file`.
5. Re-run tests via `bash` or `/evaluate` → **green**.
6. `/export green`.

If the model tells the student to run `npm test` without having run `bash` itself, that is a harness miss — see [VERIFY.md](./VERIFY.md).

## 9. Common failures

| Symptom | Likely cause |
|---------|----------------|
| Resume shows banner only, no thread | Old binary; history reprint is in current `src/cli.ts` |
| `/fork 12` with no idea what 12 is | Run `/history` first |
| Child thinks files were never written | Workspace is not forked |
| NIM “Connection error” after models.list ok | Bad/hung `NIM_MODEL`; `/doctor` |
| `Session not found` | `--session` id typo; ids are directory names under `.hey-teach/sessions/` |
| `/evaluate` red after you implemented BFS | Tests run against **cwd** `lessons/bfs/graph.ts` — confirm you edited the file on disk |
