/**
 * On-disk session persistence (JSONL) — grok-build pattern, kept tiny.
 * Layout: .hey-teach/sessions/<id>/{summary.json,messages.jsonl}
 * See: docs/SESSIONS.md, docs/EXPORT.md
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { Message } from "./model/types.js";
import type { Outcome, OutcomeSource } from "./session-outcome.js";
import { snapForkIndex } from "./session-fork.js";

export const SESSIONS_DIRNAME = ".hey-teach";

export interface SessionSummary {
  id: string;
  lessonId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  outcome?: Outcome;
  outcomeSource?: OutcomeSource;
  outcomeNote?: string;
  outcomeAt?: string;
  teacherModel?: string;
  parentId?: string;
  /** Inclusive end of the copied prefix (0-based JSONL index). */
  forkedAtIndex?: number;
}

export interface ForkResult {
  store: SessionStore;
  messages: Message[];
  requestedIndex: number;
  forkedAtIndex: number;
  snapped: boolean;
}

export function sessionsRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, SESSIONS_DIRNAME, "sessions");
}

export function exportsRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, SESSIONS_DIRNAME, "exports");
}

export function createSessionId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${stamp}-${randomBytes(3).toString("hex")}`;
}

export class SessionStore {
  readonly dir: string;
  readonly summaryPath: string;
  readonly messagesPath: string;

  constructor(
    readonly workspaceRoot: string,
    readonly id: string,
  ) {
    this.dir = path.join(sessionsRoot(workspaceRoot), id);
    this.summaryPath = path.join(this.dir, "summary.json");
    this.messagesPath = path.join(this.dir, "messages.jsonl");
  }

  async init(
    lessonId: string,
    opts?: { teacherModel?: string },
  ): Promise<SessionSummary> {
    await fsp.mkdir(this.dir, { recursive: true });
    const now = new Date().toISOString();
    const summary: SessionSummary = {
      id: this.id,
      lessonId,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      outcome: "unlabeled",
      ...(opts?.teacherModel ? { teacherModel: opts.teacherModel } : {}),
    };
    await writeJsonAtomic(this.summaryPath, summary);
    await fsp.writeFile(this.messagesPath, "", "utf8");
    return summary;
  }

  async loadMessages(): Promise<Message[]> {
    let raw: string;
    try {
      raw = await fsp.readFile(this.messagesPath, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    const messages: Message[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      messages.push(JSON.parse(trimmed) as Message);
    }
    return messages;
  }

  async readSummary(): Promise<SessionSummary | undefined> {
    return this.getSummarySync();
  }

  getSummarySync(): SessionSummary | undefined {
    return readSummarySync(this.summaryPath);
  }

  /** Merge fields into summary.json without clobbering unrelated keys. */
  patchSummary(partial: Partial<SessionSummary>): SessionSummary {
    fs.mkdirSync(this.dir, { recursive: true });
    const prev = readSummarySync(this.summaryPath);
    const now = new Date().toISOString();
    const { id: _ignoreId, updatedAt: _ignoreUpdated, ...rest } = partial;
    const summary: SessionSummary = {
      id: this.id,
      lessonId: prev?.lessonId ?? "unknown",
      createdAt: prev?.createdAt ?? now,
      messageCount: prev?.messageCount ?? 0,
      outcome: prev?.outcome ?? "unlabeled",
      outcomeSource: prev?.outcomeSource,
      outcomeNote: prev?.outcomeNote,
      outcomeAt: prev?.outcomeAt,
      teacherModel: prev?.teacherModel,
      parentId: prev?.parentId,
      forkedAtIndex: prev?.forkedAtIndex,
      ...rest,
      updatedAt: now,
    };
    writeJsonAtomicSync(this.summaryPath, summary);
    return summary;
  }

  /** Append one message (sync flush — small educational scale). */
  appendMessage(message: Message, lessonId: string): void {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.appendFileSync(this.messagesPath, `${JSON.stringify(message)}\n`, "utf8");
    const prev = readSummarySync(this.summaryPath);
    const now = new Date().toISOString();
    const summary: SessionSummary = {
      ...prev,
      id: this.id,
      lessonId,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      messageCount: (prev?.messageCount ?? 0) + 1,
      outcome: prev?.outcome ?? "unlabeled",
    };
    writeJsonAtomicSync(this.summaryPath, summary);
  }

  clearMessages(lessonId: string): void {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.messagesPath, "", "utf8");
    const prev = readSummarySync(this.summaryPath);
    const now = new Date().toISOString();
    const summary: SessionSummary = {
      ...prev,
      id: this.id,
      lessonId,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      messageCount: 0,
      outcome: "unlabeled",
      outcomeSource: undefined,
      outcomeNote: undefined,
      outcomeAt: undefined,
    };
    writeJsonAtomicSync(this.summaryPath, summary);
  }

  updateLessonId(lessonId: string): void {
    this.patchSummary({ lessonId });
  }

  setOutcome(
    outcome: Outcome,
    source: OutcomeSource,
    note?: string,
  ): SessionSummary {
    return this.patchSummary({
      outcome,
      outcomeSource: source,
      outcomeNote: note,
      outcomeAt: new Date().toISOString(),
    });
  }

  /**
   * Copy prefix 0..n into a new session. Does not mutate this store.
   * `fromIndex` omitted = HEAD. Snaps back from an incomplete tool round.
   */
  async fork(fromIndex?: number): Promise<ForkResult> {
    const messages = await this.loadMessages();
    const requested =
      fromIndex === undefined ? messages.length - 1 : fromIndex;
    const snapped = snapForkIndex(messages, requested);
    const prefix = messages.slice(0, snapped + 1);
    const parent = this.getSummarySync();
    const child = new SessionStore(this.workspaceRoot, createSessionId());
    await child.init(parent?.lessonId ?? "unknown", {
      teacherModel: parent?.teacherModel,
    });
    const body = prefix.map((m) => JSON.stringify(m)).join("\n") + "\n";
    fs.writeFileSync(child.messagesPath, body, "utf8");
    child.patchSummary({
      parentId: this.id,
      forkedAtIndex: snapped,
      messageCount: prefix.length,
      outcome: "unlabeled",
    });
    return {
      store: child,
      messages: prefix,
      requestedIndex: requested,
      forkedAtIndex: snapped,
      snapped: snapped !== requested,
    };
  }
}

export async function listSessionSummaries(
  workspaceRoot: string,
): Promise<SessionSummary[]> {
  const root = sessionsRoot(workspaceRoot);
  let entries: string[];
  try {
    entries = await fsp.readdir(root);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const summaries: SessionSummary[] = [];
  for (const id of entries) {
    const store = new SessionStore(workspaceRoot, id);
    const s = await store.readSummary();
    if (s) summaries.push(s);
  }
  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return summaries;
}

export type SessionOpenMode =
  | { kind: "new" }
  | { kind: "id"; id: string }
  | { kind: "continue" };

export async function openSessionStore(
  workspaceRoot: string,
  lessonId: string,
  mode: SessionOpenMode,
  opts?: { teacherModel?: string },
): Promise<{ store: SessionStore; messages: Message[]; resumed: boolean }> {
  if (mode.kind === "new") {
    const store = new SessionStore(workspaceRoot, createSessionId());
    await store.init(lessonId, { teacherModel: opts?.teacherModel });
    return { store, messages: [], resumed: false };
  }

  if (mode.kind === "id") {
    const store = new SessionStore(workspaceRoot, mode.id);
    const summary = await store.readSummary();
    if (!summary) {
      throw new Error(`Session not found: ${mode.id}`);
    }
    if (opts?.teacherModel && !summary.teacherModel) {
      store.patchSummary({ teacherModel: opts.teacherModel });
    }
    const messages = await store.loadMessages();
    return { store, messages, resumed: true };
  }

  const all = await listSessionSummaries(workspaceRoot);
  if (all[0]) {
    const store = new SessionStore(workspaceRoot, all[0].id);
    if (opts?.teacherModel && !all[0].teacherModel) {
      store.patchSummary({ teacherModel: opts.teacherModel });
    }
    const messages = await store.loadMessages();
    return { store, messages, resumed: true };
  }
  const store = new SessionStore(workspaceRoot, createSessionId());
  await store.init(lessonId, { teacherModel: opts?.teacherModel });
  return { store, messages: [], resumed: false };
}

function readSummarySync(summaryPath: string): SessionSummary | undefined {
  try {
    return JSON.parse(fs.readFileSync(summaryPath, "utf8")) as SessionSummary;
  } catch {
    return undefined;
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fsp.rename(tmp, filePath);
}

function writeJsonAtomicSync(filePath: string, value: unknown): void {
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, filePath);
}
