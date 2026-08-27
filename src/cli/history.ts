/**
 * Colorized, expanded history for resume replay and /history.
 * Indices are 0-based (JSONL line / forkedAtIndex).
 * See: docs/SESSIONS.md
 */

import type { Message, ToolCall } from "../model/types.js";
import { ansi, colorizeUnifiedDiff } from "./ansi.js";

const DIFF_LINE_LIMIT = 160;
const BODY_LINE_LIMIT = 40;
const REMINDER_RE = /\n?<system-reminder>[\s\S]*?<\/system-reminder>/g;

const GUTTER = "│";
const IDX_WIDTH = 3;

export function formatHistory(messages: Message[]): string {
  if (messages.length === 0) return "No messages yet.";
  const blocks = messages.map((m, i) => formatHistoryEntry(i, m));
  blocks.push(
    ansi.dim(
      `${messages.length} messages. /fork [n] branches from an index; omit n for HEAD.`,
    ),
  );
  return blocks.join("\n\n");
}

/** One message as a header + indented body (diffs expanded, roles colored). */
export function formatHistoryEntry(index: number, message: Message): string {
  const idx = ansi.yellow(String(index).padStart(IDX_WIDTH, " "));
  const bar = ansi.dim(GUTTER);
  const header = `${idx} ${bar} ${formatHeader(message)}`;
  const body = formatBodyLines(message).map(
    (line) => `${" ".repeat(IDX_WIDTH)} ${bar} ${line}`,
  );
  return [header, ...body].join("\n");
}

function formatHeader(message: Message): string {
  if (message.role === "user") return ansi.cyan("user");
  if (message.role === "assistant") return ansi.magenta("assistant");

  const name = message.name ?? "tool";
  const body = stripReminders(message.content);
  const ok = inferToolStatus(body) === "ok";
  const status = ok ? ansi.green("ok") : ansi.red("err");
  const extra = looksLikeUnifiedDiff(body) ? `  ${diffStat(body)}` : "";
  return `${ansi.dim("tool")}  ${ansi.bold(name)}  ${status}${extra}`;
}

function formatBodyLines(message: Message): string[] {
  if (message.role === "assistant" && message.tool_calls?.length) {
    const lines: string[] = [];
    const text = message.content?.trim();
    if (text) lines.push(...capLines(text, BODY_LINE_LIMIT));
    for (const call of message.tool_calls) {
      lines.push(formatToolCall(call));
    }
    return lines;
  }

  if (message.role === "tool") {
    const body = stripReminders(message.content);
    if (!body) return [ansi.dim("(empty)")];
    const asDiff = looksLikeUnifiedDiff(body);
    const limit = asDiff ? DIFF_LINE_LIMIT : BODY_LINE_LIMIT;
    const raw = capLines(body, limit);
    if (!asDiff) {
      const paint = inferToolStatus(body) === "ok" ? ansi.dim : ansi.red;
      return raw.map((line) =>
        line.startsWith("… ") ? ansi.dim(line) : paint(line),
      );
    }
    const overflow = raw.find((l) => l.startsWith("… "));
    const diffLines = overflow ? raw.slice(0, -1) : raw;
    const colored = colorizeUnifiedDiff(diffLines.join("\n")).split("\n");
    if (overflow) colored.push(ansi.dim(overflow));
    return colored;
  }

  const text = message.content?.trim() ?? "";
  if (!text) return [ansi.dim("(empty)")];
  const lines = capLines(text, BODY_LINE_LIMIT);
  if (message.role === "user") return lines.map((l) => ansi.cyan(l));
  return lines;
}

function formatToolCall(call: ToolCall): string {
  const args = formatArgsSummary(call.function.arguments);
  return `${ansi.dim("→")} ${ansi.bold(call.function.name)} ${ansi.dim(args)}`;
}

function formatArgsSummary(raw: string): string {
  try {
    const args = JSON.parse(raw || "{}") as Record<string, unknown>;
    if (typeof args.path === "string") {
      return JSON.stringify({ path: args.path });
    }
    if (typeof args.command === "string") {
      const c = args.command.replace(/\s+/g, " ").trim();
      return JSON.stringify({
        command: c.length <= 60 ? c : `${c.slice(0, 60)}…`,
      });
    }
    const s = JSON.stringify(args);
    return s.length <= 80 ? s : `${s.slice(0, 80)}…`;
  } catch {
    return raw.length <= 80 ? raw : `${raw.slice(0, 80)}…`;
  }
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

function looksLikeUnifiedDiff(output: string): boolean {
  return (
    output.startsWith("--- ") ||
    output.startsWith("---\t") ||
    /^--- /m.test(output.slice(0, 80))
  );
}

function diffStat(body: string): string {
  const lines = body.split("\n");
  const plus = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
  const minus = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
  return `diff +${plus} -${minus}`;
}

function capLines(text: string, limit: number): string[] {
  const lines = text.split("\n");
  if (lines.length <= limit) return lines;
  return [...lines.slice(0, limit), `… ${lines.length - limit} more lines`];
}

function stripReminders(content: string | null): string {
  if (!content) return "";
  return content.replace(REMINDER_RE, "").trim();
}
