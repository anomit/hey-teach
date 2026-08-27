import { describe, it, expect } from "vitest";
import { dfs, type Graph } from "./graph";

describe("dfs", () => {
  it("simple linear graph", () => {
    const graph: Graph = {
      A: ["B"],
      B: ["C"],
      C: [],
    };
    expect(dfs(graph, "A")).toEqual(["A", "B", "C"]);
  });

  it("branching graph — neighbors in list order (not BFS)", () => {
    const graph: Graph = {
      A: ["B", "C"],
      B: ["D"],
      C: ["E"],
      D: [],
      E: [],
    };
    expect(dfs(graph, "A")).toEqual(["A", "B", "D", "C", "E"]);
  });

  it("graph with cycle", () => {
    const graph: Graph = {
      A: ["B"],
      B: ["C"],
      C: ["A"], // cycle back to A
    };
    expect(dfs(graph, "A")).toEqual(["A", "B", "C"]);
  });

  it("disconnected nodes - only reachable from start", () => {
    const graph: Graph = {
      A: ["B"],
      B: [],
      C: ["D"], // disconnected component
      D: [],
    };
    expect(dfs(graph, "A")).toEqual(["A", "B"]);
  });

  it("start node not in graph", () => {
    const graph: Graph = {
      A: ["B"],
      B: [],
    };
    expect(dfs(graph, "Z")).toEqual([]);
  });
});
