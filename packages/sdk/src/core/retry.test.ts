// ---------------------------------------------------------------------------
// @rewardz/sdk — withRetry Tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRetry, DEFAULT_RETRY_CONFIG, type RetryConfig } from "./retry.js";
import { RewardzApiError, RewardzTimeoutError } from "./errors.js";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Retry config with zero delays so tests run instantly. */
const INSTANT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 0,
  maxDelayMs: 0,
  retryableStatuses: [429, 502, 503, 504],
};

function makeApiError(status: number): RewardzApiError {
  return new RewardzApiError(`HTTP ${status}`, status, `HTTP_${status}`);
}

/* -------------------------------------------------------------------------- */
/*  DEFAULT_RETRY_CONFIG                                                      */
/* -------------------------------------------------------------------------- */

describe("DEFAULT_RETRY_CONFIG", () => {
  it("has expected defaults", () => {
    expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(1000);
    expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(10000);
    expect(DEFAULT_RETRY_CONFIG.retryableStatuses).toEqual([
      429, 502, 503, 504,
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/*  withRetry — success path                                                  */
/* -------------------------------------------------------------------------- */

describe("withRetry — success path", () => {
  it("returns the value when fn succeeds on the first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, INSTANT_CONFIG);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("returns the value when fn succeeds on the second attempt after a retryable error", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(makeApiError(503))
      .mockResolvedValue("recovered");

    const result = await withRetry(fn, INSTANT_CONFIG);
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("returns the value after multiple retries before success", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(makeApiError(502))
      .mockRejectedValueOnce(makeApiError(503))
      .mockResolvedValue("finally");

    const result = await withRetry(fn, INSTANT_CONFIG);
    expect(result).toBe("finally");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

/* -------------------------------------------------------------------------- */
/*  withRetry — non-retryable errors                                         */
/* -------------------------------------------------------------------------- */

describe("withRetry — non-retryable errors", () => {
  it("throws immediately on a non-retryable API error (400)", async () => {
    const fn = vi.fn().mockRejectedValue(makeApiError(400));
    await expect(withRetry(fn, INSTANT_CONFIG)).rejects.toThrow(
      RewardzApiError,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws immediately on a 401 error", async () => {
    const fn = vi.fn().mockRejectedValue(makeApiError(401));
    await expect(withRetry(fn, INSTANT_CONFIG)).rejects.toThrow(
      RewardzApiError,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws immediately on a 403 error", async () => {
    const fn = vi.fn().mockRejectedValue(makeApiError(403));
    await expect(withRetry(fn, INSTANT_CONFIG)).rejects.toThrow(
      RewardzApiError,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws immediately on a 422 error", async () => {
    const fn = vi.fn().mockRejectedValue(makeApiError(422));
    await expect(withRetry(fn, INSTANT_CONFIG)).rejects.toThrow(
      RewardzApiError,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws immediately on a plain Error (not retryable)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("generic error"));
    await expect(withRetry(fn, INSTANT_CONFIG)).rejects.toThrow(
      "generic error",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------------------------------------- */
/*  withRetry — retryable errors exhaust retries                             */
/* -------------------------------------------------------------------------- */

describe("withRetry — exhausted retries", () => {
  it("throws last error after maxRetries attempts for 503", async () => {
    const err = makeApiError(503);
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn, INSTANT_CONFIG)).rejects.toBe(err);
    // Called once initially + 3 retries = 4 total
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("throws last error after maxRetries attempts for 429", async () => {
    const err = makeApiError(429);
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn, INSTANT_CONFIG)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("throws last error after maxRetries attempts for 502", async () => {
    const err = makeApiError(502);
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn, INSTANT_CONFIG)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

/* -------------------------------------------------------------------------- */
/*  withRetry — RewardzTimeoutError is always retryable                      */
/* -------------------------------------------------------------------------- */

describe("withRetry — timeout errors", () => {
  it("retries on RewardzTimeoutError", async () => {
    const timeoutErr = new RewardzTimeoutError("timed out", 5000);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(timeoutErr)
      .mockResolvedValue("success after timeout retry");

    const result = await withRetry(fn, INSTANT_CONFIG);
    expect(result).toBe("success after timeout retry");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("exhausts retries when all attempts time out", async () => {
    const timeoutErr = new RewardzTimeoutError("timed out", 5000);
    const fn = vi.fn().mockRejectedValue(timeoutErr);

    await expect(withRetry(fn, INSTANT_CONFIG)).rejects.toBe(timeoutErr);
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

/* -------------------------------------------------------------------------- */
/*  withRetry — TypeError (network failures) is retryable                   */
/* -------------------------------------------------------------------------- */

describe("withRetry — network TypeError", () => {
  it("retries on TypeError (fetch network failure)", async () => {
    const networkErr = new TypeError("Failed to fetch");
    const fn = vi
      .fn()
      .mockRejectedValueOnce(networkErr)
      .mockResolvedValue("recovered");

    const result = await withRetry(fn, INSTANT_CONFIG);
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("exhausts retries when all attempts fail with TypeError", async () => {
    const networkErr = new TypeError("Failed to fetch");
    const fn = vi.fn().mockRejectedValue(networkErr);

    await expect(withRetry(fn, INSTANT_CONFIG)).rejects.toBe(networkErr);
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

/* -------------------------------------------------------------------------- */
/*  withRetry — maxRetries: 0 means no retries                               */
/* -------------------------------------------------------------------------- */

describe("withRetry — maxRetries: 0", () => {
  const NO_RETRY_CONFIG: RetryConfig = { ...INSTANT_CONFIG, maxRetries: 0 };

  it("does not retry when maxRetries is 0 and error is retryable", async () => {
    const fn = vi.fn().mockRejectedValue(makeApiError(503));
    await expect(withRetry(fn, NO_RETRY_CONFIG)).rejects.toThrow(
      RewardzApiError,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("returns value immediately if fn succeeds", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, NO_RETRY_CONFIG);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------------------------------------- */
/*  withRetry — uses DEFAULT_RETRY_CONFIG when none provided                 */
/* -------------------------------------------------------------------------- */

describe("withRetry — default config", () => {
  it("uses DEFAULT_RETRY_CONFIG when no config argument is given", async () => {
    // A non-retryable error should be thrown on first attempt regardless
    const fn = vi.fn().mockRejectedValue(makeApiError(400));
    await expect(withRetry(fn)).rejects.toThrow(RewardzApiError);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
