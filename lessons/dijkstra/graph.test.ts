import { describe, it, expect } from "vitest";
import { dijkstra, type WeightedGraph, type DijkstraResult } from "./graph";

describe("dijkstra", () => {
  it("simple linear graph", () => {
    const graph: WeightedGraph = {
      A: { B: 1 },
      B: { C: 2 },
      C: {},
    };
    const result = dijkstra(graph, "A");
    expect(result.distances).toEqual({ A: 0, B: 1, C: 3 });
    expect(result.previous).toEqual({ A: null, B: "A", C: "B" });
  });

  it("branching graph - shortest path chosen", () => {
    const graph: WeightedGraph = {
      A: { B: 5, C: 1 },
      B: { D: 1 },
      C: { D: 1 },
      D: {},
    };
    const result = dijkstra(graph, "A");
    // Shortest path to D is A->C->D (cost 2), not A->B->D (cost 6)
    expect(result.distances.D).toBe(2);
    expect(result.previous.D).toBe("C");
  });

  it("graph with cycle", () => {
    const graph: WeightedGraph = {
      A: { B: 1 },
      B: { C: 1 },
      C: { A: 1 }, // cycle back to A
    };
    const result = dijkstra(graph, "A");
    expect(result.distances).toEqual({ A: 0, B: 1, C: 2 });
    expect(result.previous).toEqual({ A: null, B: "A", C: "B" });
  });

  it("disconnected nodes - only reachable from start", () => {
    const graph: WeightedGraph = {
      A: { B: 1 },
      B: {},
      C: { D: 1 }, // disconnected component
      D: {},
    };
    const result = dijkstra(graph, "A");
    expect(result.distances).toEqual({ A: 0, B: 1 });
    expect(result.previous).toEqual({ A: null, B: "A" });
  });

  it("start node not in graph", () => {
    const graph: WeightedGraph = {
      A: { B: 1 },
      B: {},
    };
    const result = dijkstra(graph, "Z");
    expect(result).toEqual({ distances: {}, previous: {} });
  });

  it("multiple paths - picks minimum weight", () => {
    const graph: WeightedGraph = {
      A: { B: 10, C: 1 },
      B: { D: 1 },
      C: { B: 1 },
      D: {},
    };
    const result = dijkstra(graph, "A");
    // A->C->B (cost 2) is shorter than A->B (cost 10)
    expect(result.distances.B).toBe(2);
    expect(result.previous.B).toBe("C");
    expect(result.distances.D).toBe(3);
    expect(result.previous.D).toBe("B");
  });
});