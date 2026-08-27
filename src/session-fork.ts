/**
 * Fork-index snap: only copy a prefix that is a valid OpenAI tool-call sequence.
 * See: docs/SESSIONS.md
 */

import type { Message } from "./model/types.js";

/** True when every assistant tool_calls group has matching tool results. */
export function isValidChatPrefix(messages: Message[]): boolean {
  const pending = new Set<string>();
  for (const m of messages) {
    if (m.role === "assistant") {
      if (pending.size > 0) return false;
      if (m.tool_calls?.length) {
        for (const tc of m.tool_calls) pending.add(tc.id);
      }
      continue;
    }
    if (m.role === "tool") {
      if (!m.tool_call_id || !pending.has(m.tool_call_id)) return false;
      pending.delete(m.tool_call_id);
      continue;
    }
    if (pending.size > 0) return false;
  }
  return pending.size === 0;
}

/**
 * Inclusive index of the last message that leaves a valid prefix.
 * Walks back from `n` when `n` lands mid tool-round.
 */
export function snapForkIndex(messages: Message[], n: number): number {
  if (messages.length === 0) {
    throw new Error("Cannot fork an empty session.");
  }
  if (!Number.isInteger(n) || n < 0 || n >= messages.length) {
    throw new Error(`Fork index out of range: ${n} (0..${messages.length - 1})`);
  }
  for (let i = n; i >= 0; i--) {
    if (isValidChatPrefix(messages.slice(0, i + 1))) return i;
  }
  throw new Error("Cannot fork: no valid OpenAI prefix through that index.");
}
