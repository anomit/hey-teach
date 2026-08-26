/**
 * Parent → children listing for /sessions.
 * See: docs/SESSIONS.md
 */

import { formatOutcomeColumn } from "../session-outcome.js";
import type { SessionSummary } from "../session-store.js";

export interface SessionTreeNode {
  summary: SessionSummary;
  depth: number;
}

/** Roots (missing / unknown parent) first by updatedAt desc; siblings by createdAt. */
export function orderSessionTree(summaries: SessionSummary[]): SessionTreeNode[] {
  const byId = new Map(summaries.map((s) => [s.id, s]));
  const children = new Map<string, SessionSummary[]>();
  const roots: SessionSummary[] = [];

  for (const s of summaries) {
    if (s.parentId && byId.has(s.parentId)) {
      const list = children.get(s.parentId) ?? [];
      list.push(s);
      children.set(s.parentId, list);
    } else {
      roots.push(s);
    }
  }

  roots.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const list of children.values()) {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const out: SessionTreeNode[] = [];
  const seen = new Set<string>();
  const walk = (node: SessionSummary, depth: number) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    out.push({ summary: node, depth });
    for (const child of children.get(node.id) ?? []) {
      walk(child, depth + 1);
    }
  };
  for (const r of roots) walk(r, 0);
  for (const s of summaries) {
    if (!seen.has(s.id)) walk(s, 0);
  }
  return out;
}

export function formatSessionTreeLine(
  node: SessionTreeNode,
  activeId: string,
): string {
  const { summary: s, depth } = node;
  const mark = s.id === activeId ? "*" : " ";
  const indent = depth === 0 ? "" : `${"  ".repeat(depth)}└ `;
  const oc = formatOutcomeColumn(s.outcome).padEnd(9);
  const fork =
    s.forkedAtIndex !== undefined ? `  fork@${s.forkedAtIndex}` : "";
  return `${mark} ${indent}${s.id}  ${oc}  msgs=${s.messageCount}  lesson=${s.lessonId}${fork}`;
}

export function formatSessionTree(
  summaries: SessionSummary[],
  activeId: string,
): string[] {
  return orderSessionTree(summaries).map((n) =>
    formatSessionTreeLine(n, activeId),
  );
}
