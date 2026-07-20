/**
 * write_file tool — create/overwrite a UTF-8 file; returns a unified diff.
 * See: docs/ARCHITECTURE.md (Tools)
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition, ToolResult } from "./types.js";
import { resolveWorkspacePath } from "./path-guard.js";
import { unifiedDiff } from "./diff.js";

export const writeFileTool: ToolDefinition = {
  name: "write_file",
  description:
    "Write (create or overwrite) a text file relative to the workspace root. Returns a unified diff.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Relative path from the workspace root",
      },
      content: {
        type: "string",
        description: "Full file contents to write",
      },
    },
    required: ["path", "content"],
  },
  async execute(args, ctx): Promise<ToolResult> {
    const rel = String(args.path ?? "");
    const content = String(args.content ?? "");
    try {
      const abs = resolveWorkspacePath(ctx.workspaceRoot, rel);
      let before = "";
      try {
        before = await fs.readFile(abs, "utf8");
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") throw err;
      }
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, "utf8");
      return { ok: true, output: unifiedDiff(rel, before, content) };
    } catch (err) {
      return { ok: false, output: err instanceof Error ? err.message : String(err) };
    }
  },
};
