/**
 * On-disk session persistence (JSONL) — grok-build pattern, kept tiny.
 * Layout: .hey-teach/sessions/<id>/{summary.json,messages.jsonl}
 * See: docs/SESSIONS.md
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { Message } from "./model/types.js";

export const SESSIONS_DIRNAME = ".hey-teach";

export interface SessionSummary {
  id: string;
  lessonId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export function sessionsRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, SESSIONS_DIRNAME, "sessions");
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

  async init(lessonId: string): Promise<SessionSummary> {
    await fsp.mkdir(this.dir, { recursive: true });
    const now = new Date().toISOString();
    const summary: SessionSummary = {
      id: this.id,
      lessonId,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
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
    try {
      const raw = await fsp.readFile(this.summaryPath, "utf8");
      return JSON.parse(raw) as SessionSummary;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw err;
    }
  }

  /** Append one message (sync flush — small educational scale). */
  appendMessage(message: Message, lessonId: string): void {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.appendFileSync(this.messagesPath, `${JSON.stringify(message)}\n`, "utf8");
    const prev = readSummarySync(this.summaryPath);
    const now = new Date().toISOString();
    const summary: SessionSummary = {
      id: this.id,
      lessonId,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      messageCount: (prev?.messageCount ?? 0) + 1,
    };
    writeJsonAtomicSync(this.summaryPath, summary);
  }

  clearMessages(lessonId: string): void {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.messagesPath, "", "utf8");
    const prev = readSummarySync(this.summaryPath);
    const now = new Date().toISOString();
    const summary: SessionSummary = {
      id: this.id,
      lessonId,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      messageCount: 0,
    };
    writeJsonAtomicSync(this.summaryPath, summary);
  }

  updateLessonId(lessonId: string): void {
    const prev = readSummarySync(this.summaryPath);
    if (!prev) return;
    writeJsonAtomicSync(this.summaryPath, {
      ...prev,
      lessonId,
      updatedAt: new Date().toISOString(),
    });
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
): Promise<{ store: SessionStore; messages: Message[]; resumed: boolean }> {
  if (mode.kind === "new") {
    const store = new SessionStore(workspaceRoot, createSessionId());
    await store.init(lessonId);
    return { store, messages: [], resumed: false };
  }

  if (mode.kind === "id") {
    const store = new SessionStore(workspaceRoot, mode.id);
    const summary = await store.readSummary();
    if (!summary) {
      throw new Error(`Session not found: ${mode.id}`);
    }
    const messages = await store.loadMessages();
    return { store, messages, resumed: true };
  }

  // continue: most recent, or create
  const all = await listSessionSummaries(workspaceRoot);
  if (all[0]) {
    const store = new SessionStore(workspaceRoot, all[0].id);
    const messages = await store.loadMessages();
    return { store, messages, resumed: true };
  }
  const store = new SessionStore(workspaceRoot, createSessionId());
  await store.init(lessonId);
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
