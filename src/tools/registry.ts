/**
 * Tool registry — ships read/write/edit/bash.
 * See: docs/ARCHITECTURE.md (Extending), docs/TURN_LOOP.md
 */

import type { ToolSchema } from "../model/types.js";
import type { ToolContext, ToolDefinition, ToolResult } from "./types.js";
import { readFileTool } from "./read-file.js";
import { writeFileTool } from "./write-file.js";
import { editFileTool } from "./edit-file.js";
import { bashTool } from "./bash.js";

const tools: ToolDefinition[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  bashTool,
];

export class ToolRegistry {
  private readonly byName = new Map<string, ToolDefinition>();

  constructor(defs: ToolDefinition[] = tools) {
    for (const t of defs) {
      this.byName.set(t.name, t);
    }
  }

  list(): ToolDefinition[] {
    return [...this.byName.values()];
  }

  schemas(): ToolSchema[] {
    return this.list().map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    const tool = this.byName.get(name);
    if (!tool) {
      return { ok: false, output: `Unknown tool: ${name}` };
    }
    return tool.execute(args, ctx);
  }
}

export function createDefaultToolRegistry(): ToolRegistry {
  return new ToolRegistry();
}
