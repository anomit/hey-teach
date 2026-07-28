# Export and outcome labeling

Sessions are not only for resume — they are a **labeled trajectory store** for later fine-tuning (SFT / QLoRA). Capture LLM ↔ harness interactions on CS lessons, label how they ended, export JSONL.

## Flywheel

```
lesson session  →  messages.jsonl  →  outcome label  →  export JSONL  →  (later) train local model
```

Hey Teach stops at export. Training scripts and GGUF conversion are out of scope here; the harness’s job is clean, structured data.

## Outcomes

Stored on `summary.json`:

| Field | Meaning |
|-------|---------|
| `outcome` | `unlabeled` \| `green` \| `red` \| `abandoned` \| `error` |
| `outcomeSource` | `manual` \| `bash_infer` \| `lesson_evaluate` |
| `outcomeNote` | Optional short note / grader snippet |
| `outcomeAt` | ISO timestamp |
| `teacherModel` | `mock` or `NIM_MODEL` at session open |

### How labels get set

1. **`bash_infer`** — after a `bash` tool result that looks like a test run (vitest / jest / npm test), the harness sets `green` or `red`. Does **not** overwrite `manual`, `abandoned`, or `error`.
2. **`lesson_evaluate`** — `/evaluate` runs the active lesson’s `evaluate()` (stub-bfs runs `npx vitest run lessons/bfs/graph.test.ts`).
3. **`manual`** — `/outcome green|red|abandoned|error|unlabeled [note]` always wins until you change it again.

## Export format

One JSON object per session, JSONL file:

```json
{
  "id": "2026-07-20T19-11-57-8fe293",
  "lessonId": "stub-bfs",
  "outcome": "red",
  "outcomeSource": "bash_infer",
  "teacherModel": "mistralai/mistral-medium-3.5-128b",
  "exportedAt": "...",
  "messageCount": 29,
  "messages": [ /* OpenAI-shaped roles; system-reminder blocks stripped */ ]
}
```

Default path: `.hey-teach/exports/trajectories-<stamp>.jsonl` (gitignored).

`<system-reminder>` blocks are stripped from tool messages so training data teaches **behavior**, not dependence on harness nags.

## Commands

| Command | Behavior |
|---------|----------|
| `/outcome <label> [note]` | Manual label |
| `/evaluate` | Lesson grader → green/red |
| `/export` | Active session only |
| `/export all` | Every session |
| `/export green` | Filter by outcome |
| `/sessions` | Lists outcome column |

Headless:

```bash
npm run export -- --all
npm run export -- --outcome green --out ./data/train.jsonl
```

## Code

| Piece | Path |
|-------|------|
| Outcome types | `src/session-outcome.ts` |
| Summary + patch | `src/session-store.ts` |
| bash_infer | `src/outcome/bash-infer.ts` |
| Export | `src/export/trajectories.ts` |
| CLI export | `src/export-cli.ts` |

## Toward local weights

Exported trajectories are the input to a later Labonne-style loop (QLoRA SFT → optional DPO → merge → GGUF). Prefer **green** (or carefully curated red→green arcs) over dumping every abandoned chat. Quality beats volume.
