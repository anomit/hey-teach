/** Starter: implement Dijkstra's shortest path from a start node. */
export type WeightedGraph = Record<string, Record<string, number>>;

export type DijkstraResult = {
  distances: Record<string, number>;
  previous: Record<string, string | null>;
};

export function dijkstra(graph: WeightedGraph, start: string): DijkstraResult {
  // If start node doesn't exist in graph, return empty result
  if (!(start in graph)) {
    return { distances: {}, previous: {} };
  }

  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const visited = new Set<string>();

  // Initialize distances to infinity
  for (const node of Object.keys(graph)) {
    distances[node] = Infinity;
    previous[node] = null;
  }
  distances[start] = 0;

  // Simple O(V^2) implementation - can be optimized with priority queue
  while (true) {
    // Find unvisited node with minimum distance
    let minNode: string | null = null;
    let minDist = Infinity;

    for (const node of Object.keys(graph)) {
      if (!visited.has(node) && distances[node] < minDist) {
        minDist = distances[node];
        minNode = node;
      }
    }

    if (minNode === null) {
      break; // All reachable nodes visited
    }

    visited.add(minNode);

    // Relax edges
    const neighbors = graph[minNode] || {};
    for (const [neighbor, weight] of Object.entries(neighbors)) {
      if (visited.has(neighbor)) continue;

      const alt = distances[minNode] + weight;
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        previous[neighbor] = minNode;
      }
    }
  }

  // Filter out unreachable nodes (distance = Infinity)
  const reachableDistances: Record<string, number> = {};
  const reachablePrevious: Record<string, string | null> = {};
  for (const node of Object.keys(distances)) {
    if (distances[node] !== Infinity) {
      reachableDistances[node] = distances[node];
      reachablePrevious[node] = previous[node];
    }
  }

  return { distances: reachableDistances, previous: reachablePrevious };
}