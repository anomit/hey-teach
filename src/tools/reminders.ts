/**
 * Post-tool system-reminders — harness intelligence without a second model.
 * Pattern: append soft instructions into the tool result the model will read next.
 * See: docs/VERIFY.md
 */

import fs from "node:fs";
import path from "node:path";
import type { ToolResult } from "./types.js";

const REMINDER_OPEN = "<system-reminder>";
const REMINDER_CLOSE = "</system-reminder>";

/** Append any reminders to the tool output string. */
export function withReminders(
  toolName: string,
  args: Record<string, unknown>,
  result: ToolResult,
  workspaceRoot: string,
): string {
  const notes = buildReminders(toolName, args, result, workspaceRoot);
  if (notes.length === 0) return result.output;
  const block = [
    "",
    REMINDER_OPEN,
    ...notes.map((n) => `- ${n}`),
    REMINDER_CLOSE,
  ].join("\n");
  return `${result.output}${block}`;
}

function buildReminders(
  toolName: string,
  args: Record<string, unknown>,
  result: ToolResult,
  workspaceRoot: string,
): string[] {
  const notes: string[] = [];

  if (
    (toolName === "write_file" || toolName === "edit_file") &&
    result.ok &&
    typeof args.path === "string" &&
    looksLikeTestPath(args.path)
  ) {
    const probe = probeNodeProject(workspaceRoot);
    notes.push(
      `You wrote/edited a test file (${args.path}). Do not tell the user to run tests yet.`,
    );
    notes.push(
      "Close the loop with bash: inspect the project config, install a runner if missing, then run the tests yourself and read the exit code / output.",
    );
    if (probe.kind === "node") {
      notes.push(
        `package.json scripts: ${probe.scriptsLabel}. deps mentioning test runners: ${probe.runnerDepsLabel}.`,
      );
      if (!probe.hasTestScript && !probe.hasRunnerDep) {
        notes.push(
          'No test script/runner detected. Add one (e.g. vitest or node:test) via bash before claiming "npm test" works.',
        );
      } else if (!probe.hasTestScript && probe.hasRunnerDep) {
        notes.push(
          'A test runner is in dependencies but there is no "test" script — add one to package.json, then run it.',
        );
      }
    } else if (probe.kind === "none") {
      notes.push(
        "No package.json at workspace root — do not invent npm test. Choose a runner that fits this repo or add minimal config first.",
      );
    }
  }

  if (toolName === "bash" && !result.ok) {
    const out = result.output.toLowerCase();
    if (
      out.includes("missing script") ||
      out.includes("npm error missing script") ||
      (out.includes("vitest") && out.includes("not found")) ||
      out.includes("cannot find module")
    ) {
      notes.push(
        "That bash failure is evidence. Fix the toolchain (package.json scripts / install deps) with tools, then re-run. Do not hand the same broken command to the user.",
      );
    }
    if (
      out.includes("assertionerror") ||
      out.includes("failed tests") ||
      /\bfail\b/.test(out) && out.includes("tests")
    ) {
      notes.push(
        "Tests ran but failed (red). If the implementation is still a stub/TODO, that is expected for TDD — implement the code next, then re-run bash. Give the student a short status; do not stop after only printing failures.",
      );
    }
  }

  if (
    (toolName === "write_file" || toolName === "edit_file") &&
    result.ok &&
    typeof args.path === "string" &&
    /(^|\/)package\.json$/.test(args.path.replace(/\\/g, "/"))
  ) {
    notes.push(
      "package.json changed. If you added a test script or dependency, run the relevant bash command next to verify.",
    );
  }

  return notes;
}

export function looksLikeTestPath(relPath: string): boolean {
  const base = path.basename(relPath);
  return (
    /\.(test|spec)\.[cm]?[jt]sx?$/i.test(base) ||
    /_test\.go$/i.test(base) ||
    /^test_.*\.py$/i.test(base) ||
    /\.test\.py$/i.test(base)
  );
}

interface NodeProbe {
  kind: "node" | "none";
  scriptsLabel: string;
  runnerDepsLabel: string;
  hasTestScript: boolean;
  hasRunnerDep: boolean;
}

function probeNodeProject(workspaceRoot: string): NodeProbe {
  const pkgPath = path.join(workspaceRoot, "package.json");
  let raw: string;
  try {
    raw = fs.readFileSync(pkgPath, "utf8");
  } catch {
    return {
      kind: "none",
      scriptsLabel: "(none)",
      runnerDepsLabel: "(none)",
      hasTestScript: false,
      hasRunnerDep: false,
    };
  }
  try {
    const pkg = JSON.parse(raw) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};
    const scriptNames = Object.keys(scripts);
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    const runners = ["vitest", "jest", "mocha", "ava", "tap", "node:test"];
    const foundRunners = Object.keys(deps).filter(
      (d) =>
        runners.includes(d) ||
        d === "vitest" ||
        d.includes("jest"),
    );
    // node:test is built-in — detect via script body
    const scriptBodies = Object.values(scripts).join(" ");
    const hasNodeTest = /\bnode\b.*--test\b/.test(scriptBodies);
    const hasTestScript = Boolean(
      scripts.test || scripts["test:unit"] || scripts["test:ci"],
    );
    return {
      kind: "node",
      scriptsLabel:
        scriptNames.length > 0 ? scriptNames.join(", ") : "(no scripts)",
      runnerDepsLabel:
        foundRunners.length > 0
          ? foundRunners.join(", ")
          : hasNodeTest
            ? "node --test (via scripts)"
            : "(none detected)",
      hasTestScript,
      hasRunnerDep: foundRunners.length > 0 || hasNodeTest,
    };
  } catch {
    return {
      kind: "node",
      scriptsLabel: "(unreadable package.json)",
      runnerDepsLabel: "(unknown)",
      hasTestScript: false,
      hasRunnerDep: false,
    };
  }
}
