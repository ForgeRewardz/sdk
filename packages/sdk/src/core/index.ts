// ---------------------------------------------------------------------------
// @rewardz/sdk/core — Barrel export
//
// Error classes, retry logic, the base HTTP client, and auth strategies.
// ---------------------------------------------------------------------------

export {
  RewardzError,
  RewardzApiError,
  RewardzRpcError,
  RewardzTransactionError,
  RewardzAuthError,
  RewardzTimeoutError,
} from "./errors.js";

export { type RetryConfig, DEFAULT_RETRY_CONFIG, withRetry } from "./retry.js";

export { type HttpClientConfig, HttpClient } from "./http.js";

export {
  type AuthStrategy,
  type WalletAdapter,
  WalletAuth,
  ApiKeyAuth,
  BearerAuth,
  InternalKeyAuth,
} from "./auth.js";
