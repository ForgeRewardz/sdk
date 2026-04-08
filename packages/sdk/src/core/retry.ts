// ---------------------------------------------------------------------------
// @rewardz/sdk — Retry Logic
//
// Exponential backoff with jitter. Respects Retry-After headers on 429s.
// Zero external dependencies.
// ---------------------------------------------------------------------------

import { RewardzApiError, RewardzTimeoutError } from "./errors.js";

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries: number;
  /** Base delay in milliseconds before the first retry (default: 1000). */
  baseDelayMs: number;
  /** Upper bound on computed delay in milliseconds (default: 10000). */
  maxDelayMs: number;
  /** HTTP status codes that should trigger a retry (default: 429, 502, 503, 504). */
  retryableStatuses: number[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatuses: [429, 502, 503, 504],
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Compute the delay for attempt `n` using exponential backoff + jitter.
 *
 * delay = min(baseDelay * 2^attempt + random_jitter, maxDelay)
 */
function computeDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const exponential = baseDelayMs * 2 ** attempt;
  // Add up to 30% jitter to avoid thundering herd
  const jitter = exponential * 0.3 * Math.random();
  return Math.min(exponential + jitter, maxDelayMs);
}

/**
 * Extract the Retry-After value (in ms) from a RewardzApiError if the
 * original response included one. Returns `undefined` if not available.
 */
function getRetryAfterMs(error: RewardzApiError): number | undefined {
  if (
    error.details &&
    typeof error.details === "object" &&
    "retry_after" in error.details
  ) {
    const seconds = Number(
      (error.details as { retry_after: unknown }).retry_after,
    );
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000;
    }
  }
  return undefined;
}

function isRetryable(error: unknown, retryableStatuses: number[]): boolean {
  // Timeout errors are always retryable
  if (error instanceof RewardzTimeoutError) return true;

  // API errors are retryable if their status is in the allow-list
  if (error instanceof RewardzApiError) {
    return retryableStatuses.includes(error.status);
  }

  // Network-level fetch failures (TypeError from fetch) are retryable
  if (error instanceof TypeError) return true;

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* -------------------------------------------------------------------------- */
/*  withRetry                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Execute `fn` with automatic retries on transient failures.
 *
 * - Uses exponential backoff with jitter between attempts.
 * - On 429 responses, respects the `retry_after` value from the API body.
 * - After all retries are exhausted the last error is re-thrown.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // If we've used all retries, or the error isn't retryable, bail.
      if (
        attempt >= config.maxRetries ||
        !isRetryable(error, config.retryableStatuses)
      ) {
        throw error;
      }

      // Determine how long to wait before the next attempt.
      let delayMs = computeDelay(
        attempt,
        config.baseDelayMs,
        config.maxDelayMs,
      );

      // For 429s, prefer the server's Retry-After if available.
      if (error instanceof RewardzApiError && error.isRateLimited) {
        const retryAfter = getRetryAfterMs(error);
        if (retryAfter !== undefined) {
          delayMs = Math.min(retryAfter, config.maxDelayMs);
        }
      }

      await sleep(delayMs);
    }
  }

  // Should be unreachable, but satisfies TypeScript.
  throw lastError;
}
