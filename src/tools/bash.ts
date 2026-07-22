/**
 * bash tool — guarded shell; cwd = workspace root.
 * See: docs/ARCHITECTURE.md (Tools), docs/VERIFY.md
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition, ToolResult } from "./types.js";

const execFileAsync = promisify(execFile);

const MAX_BUFFER = 256 * 1024;
/** Default; npm install / test runs often need longer */
const TIMEOUT_MS = 60_000;

export const bashTool: ToolDefinition = {
  name: "bash",
  description:
    "Run a shell command with cwd = workspace root. Use this to verify work (tests, installs, typecheck). Prefer non-interactive commands. Read package.json / project config before inventing scripts like npm test.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "Shell command to run (non-interactive)",
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
      return {
        ok: true,
        output: formatBashOutput({
          exitCode: 0,
          stdout: stdout ?? "",
          stderr: stderr ?? "",
        }),
      };
    } catch (err) {
      const e = err as {
        message?: string;
        stdout?: string;
        stderr?: string;
        code?: number | string;
        killed?: boolean;
        signal?: string;
      };
      const exitCode =
        typeof e.code === "number"
          ? e.code
          : e.killed
            ? `timeout_or_signal:${e.signal ?? "killed"}`
            : e.code ?? "error";
      return {
        ok: false,
        output: formatBashOutput({
          exitCode,
          stdout: e.stdout ?? "",
          stderr: e.stderr ?? "",
          extra: e.message,
        }),
      };
    }
  },
};

function formatBashOutput(opts: {
  exitCode: number | string;
  stdout: string;
  stderr: string;
  extra?: string;
}): string {
  const parts = [`exit_code: ${opts.exitCode}`];
  const out = opts.stdout.trim();
  const err = opts.stderr.trim();
  if (out) parts.push(`stdout:\n${out}`);
  if (err) parts.push(`stderr:\n${err}`);
  if (opts.extra && !err.includes(opts.extra) && !out.includes(opts.extra)) {
    parts.push(`detail:\n${opts.extra}`);
  }
  if (parts.length === 1) parts.push("(no output)");
  return parts.join("\n");
}
