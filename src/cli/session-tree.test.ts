import { describe, expect, it } from "vitest";
import { formatSessionTree, orderSessionTree } from "./session-tree.js";
import type { SessionSummary } from "../session-store.js";

function summary(
  partial: Partial<SessionSummary> & Pick<SessionSummary, "id">,
): SessionSummary {
  return {
    lessonId: "stub-bfs",
    createdAt: "2026-08-26T12:00:00.000Z",
    updatedAt: "2026-08-26T12:00:00.000Z",
    messageCount: 1,
    outcome: "unlabeled",
    ...partial,
  };
}

describe("orderSessionTree", () => {
  it("nests children under parents; orphans become roots", () => {
    const parent = summary({
      id: "parent",
      updatedAt: "2026-08-26T13:00:00.000Z",
      outcome: "green",
      messageCount: 24,
    });
    const child = summary({
      id: "child",
      parentId: "parent",
      forkedAtIndex: 7,
      createdAt: "2026-08-26T13:40:00.000Z",
      updatedAt: "2026-08-26T13:40:00.000Z",
      messageCount: 12,
    });
    const other = summary({
      id: "other",
      updatedAt: "2026-08-26T11:00:00.000Z",
      outcome: "red",
      messageCount: 8,
    });
    const orphan = summary({
      id: "orphan",
      parentId: "missing",
      updatedAt: "2026-08-26T10:00:00.000Z",
    });

    const ordered = orderSessionTree([child, other, orphan, parent]);
    expect(ordered.map((n) => `${n.depth}:${n.summary.id}`)).toEqual([
      "0:parent",
      "1:child",
      "0:other",
      "0:orphan",
    ]);
  });
});

describe("formatSessionTree", () => {
  it("marks the active session and shows fork@n", () => {
    const lines = formatSessionTree(
      [
        summary({
          id: "aaa",
          updatedAt: "2026-08-26T13:00:00.000Z",
          outcome: "green",
          messageCount: 24,
        }),
        summary({
          id: "bbb",
          parentId: "aaa",
          forkedAtIndex: 7,
          createdAt: "2026-08-26T13:40:00.000Z",
          messageCount: 12,
        }),
      ],
      "bbb",
    );
    expect(lines[0]).toMatch(/^ {2}aaa {2}green/);
    expect(lines[1]).toContain("*");
    expect(lines[1]).toContain("└ bbb");
    expect(lines[1]).toContain("fork@7");
  });
});
