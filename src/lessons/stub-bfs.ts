/**
 * Minimal lesson plugin: metadata + prompt + tiny starter file map (no grader).
 * See: docs/LESSON_PLUGINS.md
 */

import type { LessonPlugin } from "./types.js";

export const stubBfsLesson: LessonPlugin = {
  id: "stub-bfs",
  title: "Stub: Breadth-First Search",
  topics: ["graphs", "bfs", "algorithms"],
  systemPromptAddon: `The student is practicing BFS on an adjacency-list graph.
Guide them to implement breadth-first search in lessons/bfs/graph.ts.
Do not dump a full solution on the first turn; ask clarifying questions and use tools to inspect their code.`,
  starterFiles: {
    "lessons/bfs/graph.ts": `/** Starter: implement BFS from a start node. */
export type Graph = Record<string, string[]>;

export function bfs(graph: Graph, start: string): string[] {
  // TODO: return nodes in BFS visit order
  void graph;
  void start;
  return [];
}
`,
  },
};
