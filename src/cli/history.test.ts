import { describe, expect, it } from "vitest";
import { formatHistory, formatHistoryLine } from "./history.js";
import type { Message } from "../model/types.js";

describe("formatHistory", () => {
  it("prints an empty-session message", () => {
    expect(formatHistory([])).toBe("No messages yet.");
  });

  it("numbers 0-based roles and summarizes tool calls", () => {
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
    const text = formatHistory(messages);
    expect(text).toContain("  0  user      implement bfs in graph.ts");
    expect(text).toContain("tool_calls: read_file");
    expect(text).toContain("read_file  ok  3 lines");
    expect(text).toContain("I’ll add a queue");
    expect(text).toContain("4 messages. /fork [n]");
  });

  it("does not dump full diffs", () => {
    const line = formatHistoryLine(2, {
      role: "tool",
      name: "edit_file",
      tool_call_id: "c1",
      content: "--- a/x\n+++ b/x\n@@\n-old\n+new\n",
    });
    expect(line).toContain("diff +");
    expect(line).not.toContain("-old");
  });
});
