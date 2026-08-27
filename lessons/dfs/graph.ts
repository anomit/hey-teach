/** Starter: implement DFS from a start node. */
export type Graph = Record<string, string[]>;

export function dfs(graph: Graph, start: string): string[] {
  if (!(start in graph)) {
    return [];
  }

  const visited = new Set<string>();
  const result: string[] = [];

  function visit(node: string): void {
    if (visited.has(node)) {
      return;
    }
    visited.add(node);
    result.push(node);

    const neighbors = graph[node] || [];
    for (const neighbor of neighbors) {
      visit(neighbor);
    }
  }

  visit(start);
  return result;
}
