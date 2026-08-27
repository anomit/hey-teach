/**
 * Infer session outcome from bash tool output (test runs).
 * See: docs/EXPORT.md
 */

import type { Outcome } from "../session-outcome.js";
import { bashInferMayUpdate } from "../session-outcome.js";
import type { SessionStore } from "../session-store.js";

/** True if this bash output looks like a unit-test runner. */
export function looksLikeTestRun(output: string): boolean {
  const o = output.toLowerCase();
  return (
    o.includes("vitest") ||
    o.includes("jest") ||
    /\bnpm (?:run )?test\b/.test(o) ||
    (o.includes("exit_code:") &&
      (o.includes("tests ") ||
        o.includes("test files") ||
        o.includes("failed tests") ||
        o.includes(" passed")))
  );
}

/**
 * Parse green vs red from test runner output.
 * Returns undefined if not a test run or inconclusive.
 */
export function inferOutcomeFromBash(output: string): Outcome | undefined {
  if (!looksLikeTestRun(output)) return undefined;

  const o = output.toLowerCase();
  const exitMatch = output.match(/^exit_code:\s*(\S+)/m);
  const exitCode = exitMatch?.[1];

  const failedCount = o.match(/(\d+)\s+failed/);
  const failedN = failedCount ? Number(failedCount[1]) : null;

  if (failedN != null && failedN > 0) return "red";

  if (
    o.includes("assertionerror") ||
    o.includes("failed tests") ||
    (exitCode && exitCode !== "0" && looksLikeTestRun(output))
  ) {
    return "red";
  }

  if (exitCode === "0") {
    return "green";
  }

  return undefined;
}

/**
 * Apply bash_infer to summary if allowed.
 * Does not overwrite manual / abandoned / error.
 * green only when current is unlabeled or red.
 */
export function applyBashInfer(
  store: SessionStore | undefined,
  bashOutput: string,
): Outcome | undefined {
  if (!store) return undefined;
  const inferred = inferOutcomeFromBash(bashOutput);
  if (!inferred) return undefined;

  const prev = store.getSummarySync();
  const current = prev?.outcome ?? "unlabeled";
  if (!bashInferMayUpdate(current)) return undefined;

  if (inferred === "green" && current !== "unlabeled" && current !== "red") {
    return undefined;
  }

  store.setOutcome(inferred, "bash_infer");
  return inferred;
}
