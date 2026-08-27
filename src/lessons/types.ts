/**
 * LessonPlugin contract — curriculum without hardcoding the loop.
 * See: docs/LESSON_PLUGINS.md, docs/ARCHITECTURE.md
 */

import type { ToolContext } from "../tools/types.js";

export interface EvaluateResult {
  passed: boolean;
  feedback: string;
}

export interface LessonPlugin {
  id: string;
  title: string;
  topics: string[];
  /** Appended to the system prompt when this lesson is active */
  systemPromptAddon: string;
  /** Relative path → contents; written when lesson is selected (missing files only) */
  starterFiles?: Record<string, string>;
  /** Optional grader — CLI `/evaluate` writes session outcome green/red */
  evaluate?: (ctx: ToolContext) => Promise<EvaluateResult>;
}
