/**
 * Session outcome labels for trajectory capture / later SFT.
 * See: docs/EXPORT.md, docs/SESSIONS.md
 */

export const OUTCOMES = [
  "unlabeled",
  "green",
  "red",
  "abandoned",
  "error",
] as const;

export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_SOURCES = [
  "manual",
  "bash_infer",
  "lesson_evaluate",
] as const;

export type OutcomeSource = (typeof OUTCOME_SOURCES)[number];

export function isOutcome(s: string): s is Outcome {
  return (OUTCOMES as readonly string[]).includes(s);
}

/** bash_infer must not clobber manual / abandoned / error */
export function bashInferMayUpdate(current: Outcome | undefined): boolean {
  const o = current ?? "unlabeled";
  return o === "unlabeled" || o === "red" || o === "green";
}

export function formatOutcomeColumn(outcome: Outcome | undefined): string {
  if (!outcome || outcome === "unlabeled") return "-";
  return outcome;
}
