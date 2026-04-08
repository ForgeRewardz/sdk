// ---------------------------------------------------------------------------
// @rewardz/sdk — Base HTTP Client
//
// Foundation for all SDK API calls. Uses native `fetch` (no axios/got) so it
// works in browser, Node 18+, and React Native without polyfills.
//
// Integrates:
//  - Retry logic from ./retry.ts (exponential backoff, 429 Retry-After)
//  - Timeout via AbortController
//  - Typed error responses via RewardzApiError / RewardzTimeoutError
// ---------------------------------------------------------------------------

import { RewardzApiError, RewardzTimeoutError } from "./errors.js";
import { type RetryConfig, DEFAULT_RETRY_CONFIG, withRetry } from "./retry.js";

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

export interface HttpClientConfig {
  /** Base URL for the REWARDZ API (e.g. "https://api.rewardz.xyz"). */
  baseUrl: string;
  /** Extra headers sent on every request. */
  headers?: Record<string, string>;
  /** Per-request timeout in milliseconds (default: 30 000). */
  timeoutMs?: number;
  /** Override default retry behaviour. */
  retryConfig?: Partial<RetryConfig>;
}

/* -------------------------------------------------------------------------- */
/*  Internal request options                                                  */
/* -------------------------------------------------------------------------- */

/** Narrow request options so `headers` is always a plain record. */
interface InternalRequestInit {
  method: string;
  body?: string;
  headers?: Record<string, string>;
}

/* -------------------------------------------------------------------------- */
/*  HttpClient                                                                */
/* -------------------------------------------------------------------------- */

export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retryConfig: RetryConfig;
  private headers: Record<string, string>;

  constructor(config: HttpClientConfig) {
    // Strip trailing slash so callers can use paths like "/v1/healthz"
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retryConfig };
    this.headers = { ...config.headers };
  }

  /* ── Public API ────────────────────────────────────────────────────────── */

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = this.buildUrl(path, params);
    return this.request<T>(url, { method: "GET" });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    });
  }

  async delete<T>(path: string): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, { method: "DELETE" });
  }

  /**
   * Set (or replace) auth-related headers. Called by the auth module after
   * login / token refresh.
   */
  setAuthHeaders(headers: Record<string, string>): void {
    Object.assign(this.headers, headers);
  }

  /* ── Internals ─────────────────────────────────────────────────────────── */

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  /**
   * Central request method — wires up timeout, retry, and error mapping.
   */
  private async request<T>(url: string, init: InternalRequestInit): Promise<T> {
    const mergedHeaders: Record<string, string> = {
      Accept: "application/json",
      ...this.headers,
      ...init.headers,
    };

    return withRetry(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      let response: Response;
      try {
        response = await fetch(url, {
          ...init,
          headers: mergedHeaders,
          signal: controller.signal,
        });
      } catch (error: unknown) {
        // AbortController.abort() causes a DOMException with name "AbortError"
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new RewardzTimeoutError(
            `Request to ${url} timed out after ${this.timeoutMs}ms`,
            this.timeoutMs,
          );
        }
        // Re-throw network errors (TypeError) — retry logic handles them
        throw error;
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      // 204 No Content — return empty object as T
      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    }, this.retryConfig);
  }

  /**
   * Parse the error body and throw a typed `RewardzApiError`.
   *
   * The REWARDZ API returns bodies shaped like:
   *   { error: string, message: string, retry_after?: number }
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // Body isn't JSON — use status text instead
      body = undefined;
    }

    const message =
      (body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : undefined) ?? response.statusText;

    const errorCode =
      (body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : undefined) ?? `HTTP_${response.status}`;

    throw new RewardzApiError(message, response.status, errorCode, body);
  }
}
