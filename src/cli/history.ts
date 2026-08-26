/**
 * Compact numbered history for resume replay and /history.
 * Indices are 0-based (JSONL line / forkedAtIndex).
 * See: docs/SESSIONS.md
 */

import type { Message } from "../model/types.js";

const CONTENT_LIMIT = 120;
const REMINDER_RE = /\n?<system-reminder>[\s\S]*?<\/system-reminder>/g;

export function formatHistory(messages: Message[]): string {
  if (messages.length === 0) return "No messages yet.";
  const lines = messages.map((m, i) => formatHistoryLine(i, m));
  lines.push("");
  lines.push(
    `${messages.length} messages. /fork [n] branches from an index; omit n for HEAD.`,
  );
  return lines.join("\n");
}

export function formatHistoryLine(index: number, message: Message): string {
  const idx = String(index).padStart(3, " ");
  const role = message.role.padEnd(10, " ");
  return `${idx}  ${role}${summarizeMessage(message)}`;
}

function summarizeMessage(message: Message): string {
  if (message.role === "assistant" && message.tool_calls?.length) {
    const names = message.tool_calls.map((c) => c.function.name).join(", ");
    return `tool_calls: ${names}`;
  }
  if (message.role === "tool") {
    const name = message.name ?? "tool";
    const body = stripReminders(message.content);
    const status = inferToolStatus(body);
    const extra = compactToolBody(body);
    return extra ? `${name}  ${status}  ${extra}` : `${name}  ${status}`;
  }
  return truncate(oneLine(message.content), CONTENT_LIMIT);
}

function inferToolStatus(body: string): string {
  if (
    /^invalid\b/i.test(body) ||
    /^error\b/i.test(body) ||
    /^exit_code:\s*(?!0\b)/m.test(body)
  ) {
    return "err";
  }
  return "ok";
}

function compactToolBody(body: string): string {
  const lines = body.split("\n").filter((l) => l.length > 0);
  if (body.startsWith("--- ") || /^--- /m.test(body.slice(0, 80))) {
    const plus = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
    const minus = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
    return `diff +${plus} -${minus}`;
  }
  if (lines.length > 1) return `${lines.length} lines`;
  return truncate(oneLine(body), 80);
}

function stripReminders(content: string | null): string {
  if (!content) return "";
  return content.replace(REMINDER_RE, "").trim();
}

function oneLine(content: string | null): string {
  if (!content) return "";
  return content.replace(/\s+/g, " ").trim();
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}
