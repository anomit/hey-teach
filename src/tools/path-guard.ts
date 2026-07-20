/**
 * Resolve paths under workspace; reject escapes outside root.
 * See: docs/ARCHITECTURE.md (Tools), docs/NIM_CONSTRAINTS.md
 */

import path from "node:path";

export function resolveWorkspacePath(workspaceRoot: string, relPath: string): string {
  if (!relPath || typeof relPath !== "string") {
    throw new Error("path is required");
  }
  const root = path.resolve(workspaceRoot);
  const abs = path.resolve(root, relPath);
  const rel = path.relative(root, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`path escapes workspace: ${relPath}`);
  }
  return abs;
}
