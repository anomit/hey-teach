import { describe, expect, it, vi } from "vitest";
import {
  backoffMs,
  formatNimTelemetry,
  isTransientNimError,
  paceSince,
  parseRetryAfterMs,
  withNimRetries,
} from "./nim-retry.js";

describe("isTransientNimError", () => {
  it("retries 429, 500, 502, 503, 504", () => {
    for (const status of [429, 500, 502, 503, 504]) {
      expect(isTransientNimError({ status })).toBe(true);
    }
  });

  it("does not retry auth, not-found, or timeouts", () => {
    expect(isTransientNimError({ status: 401 })).toBe(false);
    expect(isTransientNimError({ status: 404 })).toBe(false);
    expect(isTransientNimError({ status: 400 })).toBe(false);
    expect(
      isTransientNimError({ name: "APIConnectionTimeoutError" }),
    ).toBe(false);
  });

  it("retries connection drops", () => {
    expect(isTransientNimError({ name: "APIConnectionError" })).toBe(true);
    expect(isTransientNimError({ message: "Connection error." })).toBe(true);
  });
});

describe("backoffMs", () => {
  it("grows 2s, 4s, 8s plus jitter", () => {
    expect(backoffMs(0, undefined, { random: () => 0 })).toBe(2_000);
    expect(backoffMs(1, undefined, { random: () => 0 })).toBe(4_000);
    expect(backoffMs(2, undefined, { random: () => 0 })).toBe(8_000);
  });

  it("honors Retry-After seconds", () => {
    expect(
      backoffMs(0, { headers: { "retry-after": "5" } }, { random: () => 0 }),
    ).toBe(5_000);
  });
});

describe("parseRetryAfterMs", () => {
  it("reads retry-after seconds", () => {
    expect(parseRetryAfterMs({ headers: { "retry-after": "3" } })).toBe(3_000);
  });
});

describe("withNimRetries", () => {
  it("returns on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withNimRetries(fn, { sleep: async () => {} })).resolves.toBe(
      "ok",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a 500 then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 500, message: "Internal server error" })
      .mockResolvedValue("ok");
    const waits: number[] = [];
    await expect(
      withNimRetries(fn, {
        sleep: async (ms) => {
          waits.push(ms);
        },
        random: () => 0,
      }),
    ).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([2_000]);
  });

  it("gives up after max retries and throws the last 500", async () => {
    const err = { status: 500, message: "Internal server error" };
    const fn = vi.fn().mockRejectedValue(err);
    await expect(
      withNimRetries(fn, { maxRetries: 2, sleep: async () => {}, random: () => 0 }),
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry 401", async () => {
    const err = { status: 401, message: "Unauthorized" };
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withNimRetries(fn, { sleep: async () => {} })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("paceSince", () => {
  it("skips the first call", async () => {
    const sleep = vi.fn();
    expect(await paceSince(0, 2_000, { sleep })).toBe(0);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("waits the remaining gap", async () => {
    const sleep = vi.fn(async () => {});
    expect(await paceSince(1_000, 2_000, { now: () => 1_500, sleep })).toBe(
      1_500,
    );
    expect(sleep).toHaveBeenCalledWith(1_500);
  });
});

describe("formatNimTelemetry", () => {
  it("separates pace from HTTP so a slow endpoint is obvious", () => {
    expect(
      formatNimTelemetry({
        pacedMs: 1_800,
        httpMs: [24_100],
        retryStatuses: [],
        ok: true,
      }),
    ).toBe("nim  paced 1.8s  http 24.1s  ok");
  });

  it("lists each HTTP attempt and retry statuses", () => {
    expect(
      formatNimTelemetry({
        pacedMs: 2_000,
        httpMs: [8_200, 21_400],
        retryStatuses: [500],
        ok: true,
      }),
    ).toBe("nim  paced 2.0s  http 8.2s+21.4s  ok  retries 1 (500)");
  });
});
