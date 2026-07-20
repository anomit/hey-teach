/**
 * edit_file tool — replace an exact string occurrence; returns a unified diff.
 * See: docs/ARCHITECTURE.md (Tools)
 */

import fs from "node:fs/promises";
import type { ToolDefinition, ToolResult } from "./types.js";
import { resolveWorkspacePath } from "./path-guard.js";
import { unifiedDiff } from "./diff.js";

export const editFileTool: ToolDefinition = {
  name: "edit_file",
  description:
    "Replace old_string with new_string in a file. old_string must appear exactly once. Returns a unified diff.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Relative path from the workspace root",
      },
      old_string: {
        type: "string",
        description: "Exact text to find (must be unique in the file)",
      },
      new_string: {
        type: "string",
        description: "Replacement text",
      },
    },
    required: ["path", "old_string", "new_string"],
  },
  async execute(args, ctx): Promise<ToolResult> {
    const rel = String(args.path ?? "");
    const oldString = String(args.old_string ?? "");
    const newString = String(args.new_string ?? "");
    try {
      const abs = resolveWorkspacePath(ctx.workspaceRoot, rel);
      const before = await fs.readFile(abs, "utf8");
      const count = before.split(oldString).length - 1;
      if (count === 0) {
        return { ok: false, output: "old_string not found in file" };
      }
      if (count > 1) {
        return {
          ok: false,
          output: `old_string found ${count} times; must be unique`,
        };
      }
      const after = before.replace(oldString, newString);
      await fs.writeFile(abs, after, "utf8");
      return { ok: true, output: unifiedDiff(rel, before, after) };
    } catch (err) {
      return { ok: false, output: err instanceof Error ? err.message : String(err) };
    }
  },
};
