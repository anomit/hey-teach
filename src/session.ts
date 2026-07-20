/**
 * Conversation history, workspace root, and active lesson id.
 * See: docs/ARCHITECTURE.md (Module map), docs/TURN_LOOP.md
 */

import type { Message } from "./model/types.js";

export interface SessionOptions {
  workspaceRoot: string;
  activeLessonId: string;
}

export class Session {
  readonly workspaceRoot: string;
  activeLessonId: string;
  messages: Message[] = [];

  constructor(opts: SessionOptions) {
    this.workspaceRoot = opts.workspaceRoot;
    this.activeLessonId = opts.activeLessonId;
  }

  append(message: Message): void {
    this.messages.push(message);
  }

  clear(): void {
    this.messages = [];
  }
}
