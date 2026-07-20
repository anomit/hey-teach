/**
 * bash tool — guarded shell; cwd = workspace root.
 * See: docs/ARCHITECTURE.md (Tools)
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition, ToolResult } from "./types.js";

const execFileAsync = promisify(execFile);

const MAX_BUFFER = 256 * 1024;
const TIMEOUT_MS = 15_000;

export const bashTool: ToolDefinition = {
  name: "bash",
  description:
    "Run a shell command with cwd set to the workspace root. Prefer simple, non-interactive commands.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "Shell command to run",
      },
    },
    required: ["command"],
  },
  async execute(args, ctx): Promise<ToolResult> {
    const command = String(args.command ?? "").trim();
    if (!command) {
      return { ok: false, output: "command is required" };
    }
    try {
      const { stdout, stderr } = await execFileAsync("/bin/sh", ["-c", command], {
        cwd: ctx.workspaceRoot,
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        env: process.env,
      });
      const parts = [
        stdout?.trim() ? stdout.trim() : "",
        stderr?.trim() ? `stderr:\n${stderr.trim()}` : "",
      ].filter(Boolean);
      return { ok: true, output: parts.join("\n") || "(no output)" };
    } catch (err) {
      const e = err as {
        message?: string;
        stdout?: string;
        stderr?: string;
        code?: number | string;
      };
      const bits = [
        e.message ?? String(err),
        e.stdout?.trim(),
        e.stderr?.trim(),
      ].filter(Boolean);
      return { ok: false, output: bits.join("\n") };
    }
  },
};
