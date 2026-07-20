/**
 * Base harness instructions + active lesson systemPromptAddon.
 * See: docs/ARCHITECTURE.md, docs/LESSON_PLUGINS.md
 */

import type { LessonPlugin } from "../lessons/types.js";

const BASE = `You are a coding assistant inside an educational harness.
You help the student work in their workspace using the provided tools.
Prefer small, correct edits. Use tools when you need to inspect or change files.
Keep answers concise and educational.`;

export function buildSystemPrompt(lesson: LessonPlugin | undefined): string {
  if (!lesson) {
    return BASE;
  }
  return `${BASE}

## Active lesson: ${lesson.title} (${lesson.id})
Topics: ${lesson.topics.join(", ")}

${lesson.systemPromptAddon}`;
}
