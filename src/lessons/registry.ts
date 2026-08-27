/**
 * Lesson registry — add plugins here; no turn-loop edits required.
 * See: docs/LESSON_PLUGINS.md
 */

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { LessonPlugin } from "./types.js";
import { stubBfsLesson } from "./stub-bfs.js";
import { stubDfsLesson } from "./stub-dfs.js";
import { stubDijkstraLesson } from "./stub-dijkstra.js";

const lessons = new Map<string, LessonPlugin>();

function register(plugin: LessonPlugin): void {
  lessons.set(plugin.id, plugin);
}

register(stubBfsLesson);
register(stubDfsLesson);
register(stubDijkstraLesson);

export function isLessonPlugin(value: unknown): value is LessonPlugin {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<LessonPlugin>;
  return (
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    Array.isArray(v.topics) &&
    typeof v.systemPromptAddon === "string"
  );
}

/**
 * Re-import src/lessons/*.ts (cache-busted) into the in-memory map.
 * Needed because a long-lived REPL does not pick up new plugin files.
 */
export async function reloadLessonPlugins(
  workspaceRoot: string,
): Promise<{ ids: string[]; added: string[] }> {
  const prev = new Set(lessons.keys());
  const dir = path.join(workspaceRoot, "src", "lessons");
  const names = await fs.readdir(dir);
  const skip = new Set(["registry.ts", "types.ts"]);
  lessons.clear();
  for (const name of names) {
    if (!name.endsWith(".ts") || name.endsWith(".test.ts") || skip.has(name)) {
      continue;
    }
    const href = `${pathToFileURL(path.join(dir, name)).href}?t=${Date.now()}`;
    const mod = (await import(href)) as Record<string, unknown>;
    for (const value of Object.values(mod)) {
      if (isLessonPlugin(value)) register(value);
    }
  }
  const ids = [...lessons.keys()].sort();
  return { ids, added: ids.filter((id) => !prev.has(id)) };
}

export function listLessons(): LessonPlugin[] {
  return [...lessons.values()];
}

export function getLesson(id: string): LessonPlugin | undefined {
  return lessons.get(id);
}

export function defaultLessonId(): string {
  return stubBfsLesson.id;
}

/**
 * Write starter files that do not already exist (no overwrite).
 */
export async function applyStarterFiles(
  lesson: LessonPlugin,
  workspaceRoot: string,
): Promise<string[]> {
  const written: string[] = [];
  if (!lesson.starterFiles) return written;

  for (const [rel, content] of Object.entries(lesson.starterFiles)) {
    const abs = path.resolve(workspaceRoot, rel);
    try {
      await fs.access(abs);
      // exists — skip
    } catch {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, "utf8");
      written.push(rel);
    }
  }
  return written;
}
