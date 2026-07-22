/**
 * Conversation history, workspace root, active lesson, optional disk store.
 * See: docs/SESSIONS.md, docs/TURN_LOOP.md
 */

import type { Message } from "./model/types.js";
import type { SessionStore } from "./session-store.js";

export interface SessionOptions {
  workspaceRoot: string;
  activeLessonId: string;
  /** Durable session id (shown in banner / --session) */
  id?: string;
  store?: SessionStore;
  messages?: Message[];
}

export class Session {
  readonly id: string;
  readonly workspaceRoot: string;
  activeLessonId: string;
  messages: Message[] = [];
  private readonly store: SessionStore | undefined;

  constructor(opts: SessionOptions) {
    this.workspaceRoot = opts.workspaceRoot;
    this.activeLessonId = opts.activeLessonId;
    this.id = opts.id ?? "ephemeral";
    this.store = opts.store;
    if (opts.messages) this.messages = opts.messages;
  }

  append(message: Message): void {
    this.messages.push(message);
    this.store?.appendMessage(message, this.activeLessonId);
  }

  clear(): void {
    this.messages = [];
    this.store?.clearMessages(this.activeLessonId);
  }

  setLessonId(lessonId: string): void {
    this.activeLessonId = lessonId;
    this.store?.updateLessonId(lessonId);
  }
}
