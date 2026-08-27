/**
 * Thin NIM client: OpenAI SDK → https://integrate.api.nvidia.com/v1
 * See: docs/NIM_CONSTRAINTS.md, docs/ARCHITECTURE.md
 */

import OpenAI from "openai";
import type {
  ChatRequest,
  ChatResponse,
  Message,
  ModelClient,
  ToolCall,
} from "./types.js";
import { NIM_BASE_URL } from "./nim-doctor.js";
import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_PACE_MS,
  formatNimTelemetry,
  nimErrorStatus,
  paceSince,
  withNimRetries,
} from "./nim-retry.js";

const DEFAULT_TIMEOUT_MS = 60_000;

export { NIM_BASE_URL };

export interface NimClientOptions {
  apiKey: string;
  model: string;
  baseURL?: string;
  /** Abort hung requests (default 60s). Env: NIM_TIMEOUT_MS */
  timeoutMs?: number;
  /** Gap after the last chat call before the next (default 2s). Env: NIM_PACE_MS */
  paceMs?: number;
  /** Transient 429/5xx retries after the first try (default 3). Env: NIM_MAX_RETRIES */
  maxRetries?: number;
  /** Spinner text while pacing, backing off, or waiting on HTTP */
  onWait?: (message: string) => void;
  /** Durable one-liner after each chat (pace vs HTTP vs retries) */
  onNote?: (line: string) => void;
}

export class NimClient implements ModelClient {
  readonly label: string;
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly paceMs: number;
  private readonly maxRetries: number;
  private readonly onWait?: (message: string) => void;
  private readonly onNote?: (line: string) => void;
  private lastCallAt = 0;

  constructor(opts: NimClientOptions) {
    this.model = opts.model;
    this.label = `NIM ${opts.model}`;
    this.timeoutMs = opts.timeoutMs ?? envInt("NIM_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
    this.paceMs = opts.paceMs ?? envInt("NIM_PACE_MS", DEFAULT_PACE_MS);
    this.maxRetries = opts.maxRetries ?? envInt("NIM_MAX_RETRIES", DEFAULT_MAX_RETRIES);
    this.onWait = opts.onWait;
    this.onNote = opts.onNote;
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseURL ?? NIM_BASE_URL,
      timeout: this.timeoutMs,
      maxRetries: 0,
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const pacedMs = await paceSince(this.lastCallAt, this.paceMs, {
      onWait: (waitMs) =>
        this.onWait?.(
          `Pacing NIM ${Math.ceil(waitMs / 1000)}s (our gap, not the API)…`,
        ),
    });

    this.onWait?.("Waiting on NIM chat…");

    const httpMs: number[] = [];
    const retryStatuses: number[] = [];
    let completion: OpenAI.Chat.Completions.ChatCompletion;
    try {
      completion = await withNimRetries(
        async () => {
          const started = Date.now();
          try {
            return await this.client.chat.completions.create({
              model: this.model,
              messages: request.messages.map(toOpenAIMessage),
              tools: request.tools?.length
                ? request.tools.map((t) => ({
                    type: "function" as const,
                    function: {
                      name: t.function.name,
                      description: t.function.description,
                      parameters: t.function.parameters,
                    },
                  }))
                : undefined,
            });
          } catch (err) {
            const status = nimErrorStatus(err);
            if (status != null) retryStatuses.push(status);
            throw err;
          } finally {
            httpMs.push(Date.now() - started);
            this.lastCallAt = Date.now();
          }
        },
        {
          maxRetries: this.maxRetries,
          onWait: ({ attempt, maxRetries, waitMs, status }) =>
            this.onWait?.(
              `NIM ${status ?? "error"} — retry ${attempt}/${maxRetries} in ${Math.ceil(waitMs / 1000)}s…`,
            ),
        },
      );
      this.onNote?.(
        formatNimTelemetry({ pacedMs, httpMs, retryStatuses, ok: true }),
      );
    } catch (err) {
      this.onNote?.(
        formatNimTelemetry({ pacedMs, httpMs, retryStatuses, ok: false }),
      );
      const msg = formatNimError(err, this.timeoutMs);
      throw new Error(msg);
    }

    const choice = completion.choices[0];
    if (!choice?.message) {
      return {
        message: {
          role: "assistant",
          content: `(empty NIM response — no choices; model=${this.model}; id=${completion.id ?? "?"})`,
        },
      };
    }

    const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map(
      (tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }),
    );

    const hasTools = Boolean(toolCalls && toolCalls.length > 0);
    const text = choice.message.content?.trim() ?? "";

    if (!text && !hasTools) {
      return {
        message: {
          role: "assistant",
          content: `(empty NIM response — finish_reason=${choice.finish_reason ?? "?"}; model=${this.model}. Try another NIM_MODEL or /clear and retry.)`,
        },
      };
    }

    const message: Message = {
      role: "assistant",
      content: choice.message.content ?? null,
      ...(hasTools ? { tool_calls: toolCalls } : {}),
    };

    return { message };
  }
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function formatNimError(err: unknown, timeoutMs: number): string {
  const e = err as {
    status?: number;
    code?: string;
    message?: string;
    name?: string;
    cause?: unknown;
  };
  const message = typeof e?.message === "string" ? e.message : "";
  const cause =
    e?.cause instanceof Error
      ? e.cause.message
      : e?.cause
        ? String(e.cause)
        : "";
  const combined = [message, cause].filter(Boolean).join(" — ");

  if (
    e?.name === "APIConnectionTimeoutError" ||
    e?.code === "ETIMEDOUT" ||
    /timed out/i.test(combined)
  ) {
    return `NIM timed out after ${Math.round(timeoutMs / 1000)}s talking to ${NIM_BASE_URL}/chat/completions. Auth/endpoint are often fine — the model may be cold or stuck. Try /doctor or another NIM_MODEL.`;
  }
  if (/connection error/i.test(combined)) {
    return `NIM connection error to ${NIM_BASE_URL}/chat/completions (${combined || "no detail"}). GET /v1/models often still works while a specific model hangs — run /doctor.`;
  }
  if (e?.status === 401 || e?.status === 403) {
    return `NIM auth failed (HTTP ${e.status}). Check NVIDIA_API_KEY.`;
  }
  if (e?.status === 404) {
    return `NIM model not found (HTTP 404). Check NIM_MODEL against build.nvidia.com.`;
  }
  if (e?.status === 429) {
    return `NIM rate limited (HTTP 429) after retries. Wait a minute — free tier is tight.`;
  }
  if (e?.status === 500) {
    return `NIM HTTP 500 after retries (often a disguised rate limit on free tier). Wait, then send the same prompt again — the session is saved.`;
  }
  if (
    e?.status === 503 ||
    /ResourceExhausted|request limit reached|overloaded/i.test(combined)
  ) {
    return `NIM worker is full (503 ResourceExhausted) after retries. Wait, or switch NIM_MODEL to a quieter catalog id.`;
  }
  if (combined) return `NIM error: ${combined}`;
  return `NIM error: ${err instanceof Error ? err.message : String(err)}`;
}

function toOpenAIMessage(
  m: Message,
): OpenAI.Chat.ChatCompletionMessageParam {
  if (m.role === "tool") {
    return {
      role: "tool",
      tool_call_id: m.tool_call_id ?? "",
      content: m.content ?? "",
    };
  }
  if (m.role === "assistant") {
    return {
      role: "assistant",
      content: m.content,
      tool_calls: m.tool_calls?.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
    };
  }
  if (m.role === "system") {
    return { role: "system", content: m.content ?? "" };
  }
  return { role: "user", content: m.content ?? "" };
}
