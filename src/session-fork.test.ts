import { describe, expect, it } from "vitest";
import type { Message } from "./model/types.js";
import { isValidChatPrefix, snapForkIndex } from "./session-fork.js";

const user = (content: string): Message => ({ role: "user", content });
const assistant = (content: string): Message => ({ role: "assistant", content });
const assistantTools = (...names: string[]): Message => ({
  role: "assistant",
  content: null,
  tool_calls: names.map((name, i) => ({
    id: `call_${i + 1}`,
    type: "function",
    function: { name, arguments: "{}" },
  })),
});
const tool = (id: string, name: string, content = "ok"): Message => ({
  role: "tool",
  tool_call_id: id,
  name,
  content,
});

describe("isValidChatPrefix", () => {
  it("accepts user + final assistant text", () => {
    expect(isValidChatPrefix([user("hi"), assistant("hello")])).toBe(true);
  });

  it("rejects assistant tool_calls without results", () => {
    expect(isValidChatPrefix([user("go"), assistantTools("read_file")])).toBe(
      false,
    );
  });

  it("accepts a complete tool round", () => {
    const msgs = [
      user("go"),
      assistantTools("read_file"),
      tool("call_1", "read_file"),
      assistant("done"),
    ];
    expect(isValidChatPrefix(msgs)).toBe(true);
  });

  it("rejects a partial multi-tool group", () => {
    const msgs = [
      user("go"),
      assistantTools("read_file", "bash"),
      tool("call_1", "read_file"),
    ];
    expect(isValidChatPrefix(msgs)).toBe(false);
  });
});

describe("snapForkIndex", () => {
  const msgs: Message[] = [
    user("implement bfs"),
    assistantTools("read_file"),
    tool("call_1", "read_file"),
    assistant("I’ll add a queue"),
  ];

  it("keeps a complete index", () => {
    expect(snapForkIndex(msgs, 3)).toBe(3);
    expect(snapForkIndex(msgs, 0)).toBe(0);
    expect(snapForkIndex(msgs, 2)).toBe(2);
  });

  it("snaps back from a tool-call assistant with no results", () => {
    const mid = [user("go"), assistantTools("read_file")];
    expect(snapForkIndex(mid, 1)).toBe(0);
  });

  it("rejects an empty session and out-of-range index", () => {
    expect(() => snapForkIndex([], 0)).toThrow(/empty/i);
    expect(() => snapForkIndex(msgs, 9)).toThrow(/out of range/i);
    expect(() => snapForkIndex(msgs, 1.5)).toThrow(/out of range/i);
  });
});
