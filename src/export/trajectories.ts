/**
 * Export labeled sessions as fine-tune-ready JSONL trajectories.
 * See: docs/EXPORT.md
 */

import fsp from "node:fs/promises";
import path from "node:path";
import type { Message } from "../model/types.js";
import type { Outcome } from "../session-outcome.js";
import { isOutcome } from "../session-outcome.js";
import {
  exportsRoot,
  listSessionSummaries,
  SessionStore,
  type SessionSummary,
} from "../session-store.js";

export interface TrajectoryRecord {
  id: string;
  lessonId: string;
  outcome: Outcome;
  outcomeSource?: string;
  teacherModel?: string;
  exportedAt: string;
  messageCount: number;
  messages: Message[];
}

export interface ExportOptions {
  workspaceRoot: string;
  /** Active session id when exporting only that session */
  activeSessionId?: string;
  /** "all" | outcome label | undefined = active only */
  filter?: string;
  outPath?: string;
}

export interface ExportResult {
  path: string;
  count: number;
  outcomes: Record<string, number>;
}

const REMINDER_RE = /\n?<system-reminder>[\s\S]*?<\/system-reminder>/g;

export function stripSystemReminders(content: string | null): string | null {
  if (content == null) return content;
  return content.replace(REMINDER_RE, "").trimEnd();
}

export function sanitizeMessages(messages: Message[]): Message[] {
  return messages.map((m) => {
    if (m.role !== "tool") return m;
    return { ...m, content: stripSystemReminders(m.content) };
  });
}

export async function collectTrajectories(
  opts: ExportOptions,
): Promise<TrajectoryRecord[]> {
  const all = await listSessionSummaries(opts.workspaceRoot);
  const selected = filterSummaries(all, opts);
  const exportedAt = new Date().toISOString();
  const records: TrajectoryRecord[] = [];

  for (const summary of selected) {
    const store = new SessionStore(opts.workspaceRoot, summary.id);
    const messages = sanitizeMessages(await store.loadMessages());
    records.push({
      id: summary.id,
      lessonId: summary.lessonId,
      outcome: summary.outcome ?? "unlabeled",
      outcomeSource: summary.outcomeSource,
      teacherModel: summary.teacherModel,
      exportedAt,
      messageCount: messages.length,
      messages,
    });
  }
  return records;
}

export async function exportTrajectories(
  opts: ExportOptions,
): Promise<ExportResult> {
  const records = await collectTrajectories(opts);
  const outDir = exportsRoot(opts.workspaceRoot);
  await fsp.mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath =
    opts.outPath ?? path.join(outDir, `trajectories-${stamp}.jsonl`);
  const body = records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : "");
  await fsp.writeFile(outPath, body, "utf8");

  const outcomes: Record<string, number> = {};
  for (const r of records) {
    outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
  }
  return { path: outPath, count: records.length, outcomes };
}

function filterSummaries(
  all: SessionSummary[],
  opts: ExportOptions,
): SessionSummary[] {
  const f = opts.filter?.trim().toLowerCase();
  if (!f || f === "active") {
    if (!opts.activeSessionId) return [];
    return all.filter((s) => s.id === opts.activeSessionId);
  }
  if (f === "all") return all;
  if (isOutcome(f)) {
    return all.filter((s) => (s.outcome ?? "unlabeled") === f);
  }
  // treat as session id prefix/exact
  const hit = all.filter((s) => s.id === f || s.id.startsWith(f));
  return hit;
}
