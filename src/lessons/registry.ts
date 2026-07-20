/**
 * Lesson registry — add plugins here; no turn-loop edits required.
 * See: docs/LESSON_PLUGINS.md
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { LessonPlugin } from "./types.js";
import { stubBfsLesson } from "./stub-bfs.js";

const lessons = new Map<string, LessonPlugin>();

function register(plugin: LessonPlugin): void {
  lessons.set(plugin.id, plugin);
}

register(stubBfsLesson);

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
