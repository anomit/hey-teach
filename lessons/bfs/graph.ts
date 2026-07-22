/** Starter: implement BFS from a start node. */
export type Graph = Record<string, string[]>;

export function bfs(graph: Graph, start: string): string[] {
  // If start node doesn't exist in graph, return empty array
  if (!(start in graph)) {
    return [];
  }

  const visited = new Set<string>();
  const queue: string[] = [start];
  const result: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;

    if (visited.has(node)) {
      continue;
    }

    visited.add(node);
    result.push(node);

    // Add neighbors to queue
    const neighbors = graph[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return result;
}
