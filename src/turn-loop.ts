/**
 * Educational core: user → model → tools → model… until a final reply.
 * Walkthrough: docs/TURN_LOOP.md · Overview: docs/ARCHITECTURE.md
 */

import type { Message, ModelClient, ToolCall } from "./model/types.js";
import { modelLabel } from "./model/types.js";
import type { LessonPlugin } from "./lessons/types.js";
import { buildSystemPrompt } from "./prompt/build-system-prompt.js";
import type { Session } from "./session.js";
import type { ToolRegistry } from "./tools/registry.js";

/** Keep last N non-system messages so free-tier context stays usable */
export const MAX_MESSAGES = 40;

/** Cap runaway tool loops */
export const MAX_TOOL_ROUNDS = 8;

export interface ToolTrace {
  name: string;
  argsSummary: string;
  ok: boolean;
  resultSummary: string;
  /** Full multiline body for the CLI (e.g. unified diffs). */
  detail?: string;
}

export type TurnEvent =
  | { type: "status"; message: string }
  | { type: "status_clear" }
  | { type: "trace"; trace: ToolTrace };

export interface TurnResult {
  reply: string;
  traces: ToolTrace[];
}

export interface TurnLoopOptions {
  session: Session;
  model: ModelClient;
  tools: ToolRegistry;
  lesson: LessonPlugin | undefined;
  /** Live status + tool traces for the CLI spinner / printer */
  onEvent?: (event: TurnEvent) => void;
}

export class TurnLoop {
  constructor(private readonly opts: TurnLoopOptions) {}

  async runTurn(userText: string): Promise<TurnResult> {
    const { session, model, tools, lesson, onEvent } = this.opts;
    const traces: ToolTrace[] = [];
    const emit = (event: TurnEvent) => onEvent?.(event);

    session.append({ role: "user", content: userText });

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const system: Message = {
          role: "system",
          content: buildSystemPrompt(lesson),
        };
        const history = trimMessages(session.messages, MAX_MESSAGES);

        emit({
          type: "status",
          message:
            round === 0
              ? `Calling ${modelLabel(model)}…`
              : `Calling ${modelLabel(model)} (round ${round + 1})…`,
        });

        let response;
        try {
          response = await model.chat({
            messages: [system, ...history],
            tools: tools.schemas(),
          });
        } finally {
          emit({ type: "status_clear" });
        }

        const assistant = response.message;
        session.append(assistant);

        const calls = assistant.tool_calls;
        if (!calls || calls.length === 0) {
          return {
            reply: assistant.content?.trim() || "(empty model reply)",
            traces,
          };
        }

        for (const call of calls) {
          emit({
            type: "status",
            message: `Running ${call.function.name}…`,
          });
          const trace = await this.runToolCall(call);
          emit({ type: "status_clear" });
          traces.push(trace);
          emit({ type: "trace", trace });
        }
      }

      return {
        reply: "(stopped: max tool rounds reached)",
        traces,
      };
    } finally {
      emit({ type: "status_clear" });
    }
  }

  private async runToolCall(call: ToolCall): Promise<ToolTrace> {
    const { session, tools } = this.opts;
    const name = call.function.name;
    let args: Record<string, unknown> = {};
    let parseError: string | undefined;

    try {
      args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
    } catch {
      parseError = `Invalid tool arguments JSON: ${call.function.arguments}`;
    }

    const argsSummary = summarizeArgs(args, call.function.arguments);

    if (parseError) {
      session.append({
        role: "tool",
        tool_call_id: call.id,
        name,
        content: parseError,
      });
      return {
        name,
        argsSummary,
        ok: false,
        resultSummary: summarizeResult(parseError),
      };
    }

    const result = await tools.execute(name, args, {
      workspaceRoot: session.workspaceRoot,
    });

    session.append({
      role: "tool",
      tool_call_id: call.id,
      name,
      content: result.output,
    });

    return {
      name,
      argsSummary,
      ok: result.ok,
      resultSummary: summarizeResult(result.output),
      detail: shouldShowDetail(result.output) ? result.output : undefined,
    };
  }
}

function trimMessages(messages: Message[], max: number): Message[] {
  if (messages.length <= max) return messages;
  return messages.slice(messages.length - max);
}

function summarizeArgs(
  args: Record<string, unknown>,
  raw: string,
): string {
  if (typeof args.path === "string") {
    return JSON.stringify({ path: args.path });
  }
  try {
    const s = JSON.stringify(args);
    return s.length <= 80 ? s : `${s.slice(0, 80)}…`;
  } catch {
    return truncate(raw, 80);
  }
}

function summarizeResult(output: string): string {
  if (looksLikeUnifiedDiff(output)) {
    const lines = output.split("\n");
    const plus = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
    const minus = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
    return `diff +${plus} -${minus}`;
  }
  const oneLine = output.replace(/\s+/g, " ").trim();
  if (oneLine.length <= 100) return oneLine;
  return `${oneLine.slice(0, 100)}… (${output.length} chars)`;
}

function shouldShowDetail(output: string): boolean {
  // Full body only for unified diffs — not raw read_file dumps
  return looksLikeUnifiedDiff(output);
}

function looksLikeUnifiedDiff(output: string): boolean {
  return (
    output.startsWith("--- ") ||
    output.startsWith("---\t") ||
    /^--- /m.test(output.slice(0, 80))
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}
