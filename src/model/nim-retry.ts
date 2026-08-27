/**
 * Bounded backoff for free-tier NIM. 429/5xx and connection drops retry;
 * 401/404 and timeouts do not. See: docs/NIM_CONSTRAINTS.md
 */

export const TRANSIENT_HTTP = new Set([429, 500, 502, 503, 504]);

export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_PACE_MS = 2_000;
export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_CAP_MS = 20_000;

export function nimErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

export function isTransientNimError(err: unknown): boolean {
  const status = nimErrorStatus(err);
  if (status != null) return TRANSIENT_HTTP.has(status);

  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: string; message?: string };
  if (e.name === "APIConnectionTimeoutError" || e.code === "ETIMEDOUT") {
    return false;
  }
  if (e.name === "APIConnectionError") return true;
  if (typeof e.message === "string" && /connection error/i.test(e.message)) {
    return true;
  }
  return false;
}

/** First retry is attempt 0. Honors Retry-After when present. */
export function backoffMs(
  attempt: number,
  err?: unknown,
  opts?: { random?: () => number },
): number {
  const fromHeader = parseRetryAfterMs(err);
  if (fromHeader != null) return Math.min(fromHeader, BACKOFF_CAP_MS);
  const exp = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt);
  const jitter = Math.floor((opts?.random ?? Math.random)() * 400);
  return exp + jitter;
}

export function parseRetryAfterMs(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const headers = (err as { headers?: unknown }).headers;
  if (!headers || typeof headers !== "object") return undefined;
  const raw =
    (headers as Record<string, string | undefined>)["retry-after"] ??
    (headers as Record<string, string | undefined>)["Retry-After"];
  if (raw == null || raw === "") return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const when = Date.parse(raw);
  if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
  return undefined;
}

export interface NimRetryWait {
  attempt: number;
  maxRetries: number;
  waitMs: number;
  status?: number;
}

export async function withNimRetries<T>(
  fn: () => Promise<T>,
  opts: {
    maxRetries?: number;
    sleep?: (ms: number) => Promise<void>;
    onWait?: (info: NimRetryWait) => void;
    random?: () => number;
  } = {},
): Promise<T> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const sleep =
    opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  let last: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isTransientNimError(err) || attempt === maxRetries) throw err;
      const waitMs = backoffMs(attempt, err, { random: opts.random });
      opts.onWait?.({
        attempt: attempt + 1,
        maxRetries,
        waitMs,
        status: nimErrorStatus(err),
      });
      await sleep(waitMs);
    }
  }
  throw last;
}

export async function paceSince(
  lastCallAt: number,
  paceMs: number,
  opts?: {
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    onWait?: (waitMs: number) => void;
  },
): Promise<number> {
  if (paceMs <= 0 || lastCallAt <= 0) return 0;
  const now = opts?.now ?? Date.now;
  const wait = paceMs - (now() - lastCallAt);
  if (wait <= 0) return 0;
  opts?.onWait?.(wait);
  const sleep =
    opts?.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  await sleep(wait);
  return wait;
}

export interface NimCallStats {
  pacedMs: number;
  httpMs: number[];
  retryStatuses: number[];
  ok: boolean;
}

/** One durable line: paced wait vs actual HTTP, so a 24s NIM call is not blamed on a 2s gap. */
export function formatNimTelemetry(s: NimCallStats): string {
  const pace = `paced ${(s.pacedMs / 1000).toFixed(1)}s`;
  const http =
    s.httpMs.length === 0
      ? "http ?"
      : `http ${s.httpMs.map((ms) => `${(ms / 1000).toFixed(1)}s`).join("+")}`;
  const retries =
    s.retryStatuses.length > 0
      ? `  retries ${s.retryStatuses.length} (${s.retryStatuses.join(",")})`
      : "";
  return `nim  ${pace}  ${http}  ${s.ok ? "ok" : "fail"}${retries}`;
}
