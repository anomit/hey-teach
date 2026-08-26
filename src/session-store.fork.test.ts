import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SessionStore } from "./session-store.js";
import { collectTrajectories } from "./export/trajectories.js";
import type { Message } from "./model/types.js";

const temps: string[] = [];

function tmpWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hey-teach-fork-"));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of temps.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("SessionStore.fork", () => {
  it("copies a prefix, leaves the parent log unchanged, starts unlabeled", async () => {
    const root = tmpWorkspace();
    const parent = new SessionStore(root, "parent-id");
    await parent.init("stub-bfs", { teacherModel: "mock" });
    parent.setOutcome("green", "manual", "passed");
    const msgs: Message[] = [
      { role: "user", content: "one" },
      { role: "assistant", content: "two" },
      { role: "user", content: "three" },
      { role: "assistant", content: "four" },
    ];
    for (const m of msgs) parent.appendMessage(m, "stub-bfs");
    const parentRaw = fs.readFileSync(parent.messagesPath, "utf8");

    const result = await parent.fork(1);
    expect(result.forkedAtIndex).toBe(1);
    expect(result.snapped).toBe(false);
    expect(result.messages).toEqual(msgs.slice(0, 2));
    expect(fs.readFileSync(parent.messagesPath, "utf8")).toBe(parentRaw);

    const childSummary = result.store.getSummarySync();
    expect(childSummary?.parentId).toBe("parent-id");
    expect(childSummary?.forkedAtIndex).toBe(1);
    expect(childSummary?.messageCount).toBe(2);
    expect(childSummary?.outcome).toBe("unlabeled");
    expect(childSummary?.teacherModel).toBe("mock");
    expect(childSummary?.lessonId).toBe("stub-bfs");
    expect(await result.store.loadMessages()).toEqual(msgs.slice(0, 2));

    const exported = await collectTrajectories({
      workspaceRoot: root,
      filter: "all",
    });
    const childLine = exported.find((r) => r.id === result.store.id);
    expect(childLine?.parentId).toBe("parent-id");
    expect(childLine?.forkedAtIndex).toBe(1);
  });

  it("forks HEAD when index is omitted and snaps incomplete tool pairs", async () => {
    const root = tmpWorkspace();
    const parent = new SessionStore(root, "p2");
    await parent.init("stub-bfs");
    parent.appendMessage({ role: "user", content: "go" }, "stub-bfs");
    parent.appendMessage(
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "c1",
            type: "function",
            function: { name: "read_file", arguments: "{}" },
          },
        ],
      },
      "stub-bfs",
    );
    const snapped = await parent.fork();
    expect(snapped.requestedIndex).toBe(1);
    expect(snapped.forkedAtIndex).toBe(0);
    expect(snapped.snapped).toBe(true);
    expect(snapped.messages).toHaveLength(1);
    expect(snapped.messages[0]?.role).toBe("user");
  });
});
