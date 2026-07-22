# Verify-after-write

The failure mode you hit with BFS tests: the model **wrote** a Vitest file, then told you to run `npm test` — but this repo had no `vitest` and no `test` script. Advice without evidence.

Mature harnesses don’t wait for the user to notice. They **close the loop**: write → inspect project → install/configure if needed → run → read exit code → continue.

## What Hey Teach does

### 1. Prompt policy

`build-system-prompt.ts` tells the model:

- Never tell the student to run a command you haven’t successfully run via `bash` in this session.
- Read project config before inventing `npm test` / `pytest` / `go test`.
- Treat bash failures as evidence to act on.

### 2. Soft reminders (harness intelligence)

After certain tools, the harness appends a `<system-reminder>` block onto the **tool result** (model-facing, not always dumped in the CLI summary):

| Trigger | Reminder gist |
|---------|----------------|
| `write_file` / `edit_file` on `*.test.ts` etc. | Don’t hand tests to the user; probe `package.json`; install/run yourself |
| Node project with no test script/runner | Call that out explicitly from a local probe |
| `bash` fails with missing script / missing module | Fix toolchain, don’t forward the broken command |
| `package.json` edited | Re-run to verify |

Implementation: `src/tools/reminders.ts`, wired in `src/turn-loop.ts` via `withReminders`.

This is the same *idea* as grok-build’s post-tool reminders — without LSP or a second agent.

### 3. Bash as the verifier

`bash` returns structured-ish output:

```text
exit_code: 1
stdout:
…
stderr:
…
```

Timeout default is 60s so `npm install` / test runs can finish. cwd is always the workspace root.

## Budget: max tool rounds

`MAX_TOOL_ROUNDS` (see `turn-loop.ts`) caps how many model↔tool cycles happen in **one user message**. A realistic “make tests runnable” turn can burn rounds on find/read/install/edit/test before implementing. If you see `(stopped: max tool rounds reached)`, the session JSONL still has the last `npm test` output — send another user message (“continue: implement bfs until green”).

## What this is *not* (yet)

- A dedicated `run_tests` tool with a language matrix (TS/Python/Go) — coming later as optional harness affordances / lesson `testCommand`.
- Hard blocking the model from ending a turn without verification (soft reminders + prompt only).
- Auto-installing vitest without the model choosing to.

Students should still see the model *decide* to run bash — the harness only nudges.

## Ideal BFS follow-up (what “good” looks like)

1. Write `lessons/bfs/graph.test.ts`
2. Reminder fires → model `read_file package.json`
3. Sees no `test` script → `bash` to add vitest + script (or use `node --test` if rewriting tests)
4. `bash` runs tests → red (empty `bfs`)
5. Implement `bfs` → re-run → green
6. Only then summarize for the student

## Related

- [TOOLS.md](./TOOLS.md) — propose vs execute
- [SESSIONS.md](./SESSIONS.md) — why the thread must remember step 1 when doing step 4
- [TURN_LOOP.md](./TURN_LOOP.md) — where reminders attach
