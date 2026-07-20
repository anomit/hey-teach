# Tools (and how this foreshadows MCP)

This is the concept doc. Mechanics of one turn live in [TURN_LOOP.md](./TURN_LOOP.md); code is under `src/tools/`.

## The split you must not blur

| Side | Who | What |
|------|-----|------|
| **Propose** | Remote model (NIM) | Chooses a tool name + JSON arguments (`tool_calls`) |
| **Execute** | Local harness | Runs `execute()` on your machine (filesystem / shell) |
| **Observe** | Remote model again | Reads the tool result message you send back |

NIM never opens `lessons/bfs/graph.ts`. It only *asks*. Your process runs `read_file`, then ships the text back in the next chat request.

```
  ┌─────────────┐         tool schemas + messages          ┌─────────┐
  │   Harness   │ ───────────────────────────────────────► │   NIM   │
  │  (local)    │ ◄─────────────────────────────────────── │ (remote)│
  └──────┬──────┘         tool_calls  or  final text       └─────────┘
         │
         │ execute(read_file, …)
         ▼
   Workspace disk / shell
```

## What “telling the model about tools” actually means

On each `chat` call we send **schemas**, not implementations:

- `name` — short id (`read_file`)
- `description` — natural-language purpose (this is what the LLM leans on)
- `parameters` — JSON Schema for arguments

The model is not magically wired to your laptop. It is an LLM that was trained to follow tool-calling formats and to map *descriptions* → *when to call*. Clear names + descriptions matter more than clever code on the model side.

We do **not** dump huge few-shot “here is how to call read_file” essays into the system prompt (see [NIM_CONSTRAINTS.md](./NIM_CONSTRAINTS.md)). The schema *is* the advertisement.

## Worked example (your first BFS turn)

User: *Read `lessons/bfs/graph.ts` and explain…*

1. Harness → NIM: history + schemas for `read_file` / `write_file` / `edit_file` / `bash`.
2. NIM → harness: `tool_calls: [{ name: "read_file", arguments: "{\"path\":\"lessons/bfs/graph.ts\"}" }]`.
3. Local: `read_file` returns file text (~243 chars).
4. CLI: `→ read_file …` / `← ok …`.
5. Harness → NIM: a `role: "tool"` message with that text.
6. NIM → harness: plain-language explanation (no more tool calls) → turn ends.

Same pattern for “write a test file”: expect `write_file` or `edit_file` locally, then a final reply.

## Why this is the MCP idea (without MCP yet)

**MCP (Model Context Protocol)** standardizes what this harness does by hand:

| This prototype | MCP world |
|----------------|-----------|
| Hardcoded tools in `src/tools/` | Tools (and resources) exposed by an MCP server |
| Schemas built in `ToolRegistry.schemas()` | Client lists tools from the server |
| Harness executes locally | Host/client invokes the server’s tool |
| Results appended as chat `tool` messages | Results returned to the model in the same propose → execute → observe loop |

So: **agent loop + tool schemas + local (or server-side) execution** is the skill. MCP is a portable way to *plug in* more tools without growing a giant in-process registry. We deliberately ship four built-in tools first so you can see the whole path in one repo before adding a protocol layer.

## What students should take away

1. Coding assistants are not “the model editing your disk.” They are a **loop** around a model that can request tools.
2. Trust and safety live in the **executor** (path guards, cwd, what you allow) — not in the LLM’s good intentions.
3. Adding capability = new schema + new `execute`, or later an MCP server — not a bigger system prompt.
4. Free NIM makes the loop stay small: few tools, short histories, honest failure when the model skips structured `tool_calls`.

## Related code

| Piece | Path |
|-------|------|
| Tool contract | `src/tools/types.ts` |
| Registry / schemas | `src/tools/registry.ts` |
| Implementations | `src/tools/read-file.ts`, `write-file.ts`, `edit-file.ts`, `bash.ts` |
| Loop that calls them | `src/turn-loop.ts` |
