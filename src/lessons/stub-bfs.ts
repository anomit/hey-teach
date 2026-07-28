/**
 * Minimal lesson plugin: metadata + prompt + starter files + evaluate.
 * See: docs/LESSON_PLUGINS.md, docs/EXPORT.md
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { LessonPlugin } from "./types.js";

const execFileAsync = promisify(execFile);

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
  async evaluate(ctx) {
    try {
      const { stdout, stderr } = await execFileAsync(
        "npx",
        ["vitest", "run", "lessons/bfs/graph.test.ts"],
        {
          cwd: ctx.workspaceRoot,
          timeout: 60_000,
          maxBuffer: 256 * 1024,
          env: process.env,
        },
      );
      const snippet = [stdout, stderr].filter(Boolean).join("\n").trim();
      return {
        passed: true,
        feedback: snippet.slice(0, 800) || "All BFS tests passed.",
      };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const snippet = [e.stdout, e.stderr, e.message]
        .filter(Boolean)
        .join("\n")
        .trim();
      return {
        passed: false,
        feedback: snippet.slice(0, 800) || "BFS tests failed.",
      };
    }
  },
};
