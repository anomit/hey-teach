/**
 * read_file tool — read a UTF-8 file under the workspace.
 * See: docs/ARCHITECTURE.md (Tools)
 */

import fs from "node:fs/promises";
import type { ToolDefinition, ToolResult } from "./types.js";
import { resolveWorkspacePath } from "./path-guard.js";

export const readFileTool: ToolDefinition = {
  name: "read_file",
  description: "Read the contents of a text file relative to the workspace root.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Relative path from the workspace root",
      },
    },
    required: ["path"],
  },
  async execute(args, ctx): Promise<ToolResult> {
    const rel = String(args.path ?? "");
    try {
      const abs = resolveWorkspacePath(ctx.workspaceRoot, rel);
      const content = await fs.readFile(abs, "utf8");
      return { ok: true, output: content };
    } catch (err) {
      return { ok: false, output: formatErr(err) };
    }
  },
};

function formatErr(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
