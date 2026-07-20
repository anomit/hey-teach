import { describe, it, expect } from "vitest";
import { bfs, type Graph } from "./graph";

describe("bfs", () => {
  it("simple linear graph", () => {
    const graph: Graph = {
      A: ["B"],
      B: ["C"],
      C: [],
    };
    expect(bfs(graph, "A")).toEqual(["A", "B", "C"]);
  });

  it("branching graph", () => {
    const graph: Graph = {
      A: ["B", "C"],
      B: ["D"],
      C: ["E"],
      D: [],
      E: [],
    };
    expect(bfs(graph, "A")).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("graph with cycle", () => {
    const graph: Graph = {
      A: ["B"],
      B: ["C"],
      C: ["A"], // cycle back to A
    };
    expect(bfs(graph, "A")).toEqual(["A", "B", "C"]);
  });

  it("disconnected nodes - only reachable from start", () => {
    const graph: Graph = {
      A: ["B"],
      B: [],
      C: ["D"], // disconnected component
      D: [],
    };
    expect(bfs(graph, "A")).toEqual(["A", "B"]);
  });

  it("start node not in graph", () => {
    const graph: Graph = {
      A: ["B"],
      B: [],
    };
    expect(bfs(graph, "Z")).toEqual([]);
  });
});