import { describe, expect, it } from "vitest";
import { formatHistory, formatHistoryEntry } from "./history.js";
import type { Message } from "../model/types.js";

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("formatHistory", () => {
  it("prints an empty-session message", () => {
    expect(formatHistory([])).toBe("No messages yet.");
  });

  it("prints numbered blocks with tool args and file bodies", () => {
    const messages: Message[] = [
      { role: "user", content: "implement bfs in graph.ts" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "c1",
            type: "function",
            function: { name: "read_file", arguments: '{"path":"x"}' },
          },
        ],
      },
      {
        role: "tool",
        name: "read_file",
        tool_call_id: "c1",
        content: "line1\nline2\nline3",
      },
      { role: "assistant", content: "I’ll add a queue and a visited set." },
    ];
    const text = stripAnsi(formatHistory(messages));
    expect(text).toContain("  0 │ user");
    expect(text).toContain("implement bfs in graph.ts");
    expect(text).toContain("→ read_file {\"path\":\"x\"}");
    expect(text).toContain("tool  read_file  ok");
    expect(text).toContain("line1");
    expect(text).toContain("line2");
    expect(text).toContain("I’ll add a queue");
    expect(text).toContain("4 messages. /fork [n]");
  });

  it("expands unified diffs in the tool body", () => {
    const entry = stripAnsi(
      formatHistoryEntry(2, {
        role: "tool",
        name: "edit_file",
        tool_call_id: "c1",
        content: "--- a/x\n+++ b/x\n@@\n-old\n+new\n",
      }),
    );
    expect(entry).toContain("tool  edit_file  ok  diff +1 -1");
    expect(entry).toContain("-old");
    expect(entry).toContain("+new");
    expect(entry).toContain("--- a/x");
  });

  it("strips system reminders and caps long non-diff bodies", () => {
    const body = Array.from({ length: 50 }, (_, i) => `L${i}`).join("\n");
    const entry = stripAnsi(
      formatHistoryEntry(1, {
        role: "tool",
        name: "read_file",
        tool_call_id: "c1",
        content: `${body}\n<system-reminder>\n- verify\n</system-reminder>`,
      }),
    );
    expect(entry).toContain("L0");
    expect(entry).toContain("L39");
    expect(entry).not.toContain("L40");
    expect(entry).toContain("… 10 more lines");
    expect(entry).not.toContain("system-reminder");
    expect(entry).not.toContain("verify");
  });
});
