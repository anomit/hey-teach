/**
 * Connectivity probe for NIM — proves auth/endpoint vs chat hangs.
 * See: docs/NIM_CONSTRAINTS.md
 */

import OpenAI from "openai";

export const NIM_BASE_URL = "https://integrate.api.nvidia.com/v1";

export interface DoctorReport {
  baseURL: string;
  model: string;
  keyPresent: boolean;
  modelsListOk: boolean;
  modelListed: boolean | null;
  modelsCount: number | null;
  chatOk: boolean;
  chatDetail: string;
  elapsedMs: number;
}

export async function runNimDoctor(opts: {
  apiKey: string | undefined;
  model: string;
  baseURL?: string;
  timeoutMs?: number;
}): Promise<DoctorReport> {
  const baseURL = opts.baseURL ?? NIM_BASE_URL;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const started = Date.now();
  const report: DoctorReport = {
    baseURL,
    model: opts.model,
    keyPresent: Boolean(opts.apiKey),
    modelsListOk: false,
    modelListed: null,
    modelsCount: null,
    chatOk: false,
    chatDetail: "",
    elapsedMs: 0,
  };

  if (!opts.apiKey) {
    report.chatDetail = "NVIDIA_API_KEY missing";
    report.elapsedMs = Date.now() - started;
    return report;
  }

  const client = new OpenAI({
    apiKey: opts.apiKey,
    baseURL,
    timeout: timeoutMs,
    maxRetries: 0,
  });

  try {
    const page = await client.models.list();
    const ids: string[] = [];
    for await (const m of page) ids.push(m.id);
    report.modelsListOk = true;
    report.modelsCount = ids.length;
    report.modelListed = ids.includes(opts.model);
  } catch (err) {
    report.modelsListOk = false;
    report.chatDetail = `models.list failed: ${errMsg(err)}`;
    report.elapsedMs = Date.now() - started;
    return report;
  }

  try {
    const r = await client.chat.completions.create({
      model: opts.model,
      messages: [{ role: "user", content: "Reply with exactly: pong" }],
      max_tokens: 8,
    });
    const content = r.choices[0]?.message?.content?.trim() ?? "";
    report.chatOk = true;
    report.chatDetail = content
      ? `chat ok — "${truncate(content, 60)}"`
      : `chat returned empty content (finish_reason=${r.choices[0]?.finish_reason ?? "?"})`;
  } catch (err) {
    report.chatOk = false;
    report.chatDetail = `chat failed: ${errMsg(err)}`;
  }

  report.elapsedMs = Date.now() - started;
  return report;
}

function errMsg(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as { cause?: unknown }).cause;
  const causeText =
    cause instanceof Error
      ? cause.message
      : cause && typeof cause === "object" && "message" in cause
        ? String((cause as { message: unknown }).message)
        : cause
          ? String(cause)
          : "";
  return causeText ? `${err.message} (${causeText})` : err.message;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}
