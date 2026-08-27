/**
 * Minimal lesson plugin: metadata + prompt + starter files + evaluate.
 * See: docs/LESSON_PLUGINS.md, docs/EXPORT.md
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { LessonPlugin } from "./types.js";

const execFileAsync = promisify(execFile);

export const stubDfsLesson: LessonPlugin = {
  id: "stub-dfs",
  title: "Stub: Depth-First Search",
  topics: ["graphs", "dfs", "algorithms"],
  systemPromptAddon: `The student is practicing DFS on an adjacency-list graph.
Guide them to implement depth-first search in lessons/dfs/graph.ts.
Visit neighbors in adjacency-list order (recursive DFS / preorder).
Do not dump a full solution on the first turn; ask clarifying questions and use tools to inspect their code.`,
  starterFiles: {
    "lessons/dfs/graph.ts": `/** Starter: implement DFS from a start node. */
export type Graph = Record<string, string[]>;

export function dfs(graph: Graph, start: string): string[] {
  // TODO: return nodes in DFS visit order (neighbors in list order)
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
        ["vitest", "run", "lessons/dfs/graph.test.ts"],
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
        feedback: snippet.slice(0, 800) || "All DFS tests passed.",
      };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const snippet = [e.stdout, e.stderr, e.message]
        .filter(Boolean)
        .join("\n")
        .trim();
      return {
        passed: false,
        feedback: snippet.slice(0, 800) || "DFS tests failed.",
      };
    }
  },
};
