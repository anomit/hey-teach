/**
 * Minimal lesson plugin: metadata + prompt + starter files + evaluate.
 * See: docs/LESSON_PLUGINS.md, docs/EXPORT.md
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { LessonPlugin } from "./types.js";

const execFileAsync = promisify(execFile);

export const stubDijkstraLesson: LessonPlugin = {
  id: "stub-dijkstra",
  title: "Stub: Dijkstra shortest paths",
  topics: ["graphs", "dijkstra", "algorithms"],
  systemPromptAddon: `The student is practicing Dijkstra on a weighted adjacency-list graph.
Guide them to implement shortest paths in lessons/dijkstra/graph.ts.
Do not dump a full solution on the first turn; ask clarifying questions and use tools to inspect their code.`,
  starterFiles: {
    "lessons/dijkstra/graph.ts": `/** Starter: implement Dijkstra's shortest path from a start node. */
export type WeightedGraph = Record<string, Record<string, number>>;

export type DijkstraResult = {
  distances: Record<string, number>;
  previous: Record<string, string | null>;
};

export function dijkstra(graph: WeightedGraph, start: string): DijkstraResult {
  // TODO: distances + previous for nodes reachable from start
  void graph;
  void start;
  return { distances: {}, previous: {} };
}
`,
  },
  async evaluate(ctx) {
    try {
      const { stdout, stderr } = await execFileAsync(
        "npx",
        ["vitest", "run", "lessons/dijkstra/graph.test.ts"],
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
        feedback: snippet.slice(0, 800) || "All Dijkstra tests passed.",
      };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const snippet = [e.stdout, e.stderr, e.message]
        .filter(Boolean)
        .join("\n")
        .trim();
      return {
        passed: false,
        feedback: snippet.slice(0, 800) || "Dijkstra tests failed.",
      };
    }
  },
};
