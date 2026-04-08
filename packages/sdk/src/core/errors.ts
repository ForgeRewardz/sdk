// ---------------------------------------------------------------------------
// @rewardz/sdk — Custom Error Classes
//
// Typed errors for every failure mode the SDK can encounter: API responses,
// Solana RPC, transaction simulation/confirmation, auth, and timeouts.
// Zero external dependencies — safe in browser, Node 18+, React Native.
// ---------------------------------------------------------------------------

/* -------------------------------------------------------------------------- */
/*  Base                                                                      */
/* -------------------------------------------------------------------------- */

/** Base error for all REWARDZ SDK errors. */
export class RewardzError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "RewardzError";
  }
}

/* -------------------------------------------------------------------------- */
/*  API (HTTP 4xx / 5xx from our API)                                         */
/* -------------------------------------------------------------------------- */

/**
 * Thrown when the REWARDZ API returns a non-2xx response.
 *
 * Convenience getters let callers branch on common status codes without
 * hard-coding numbers everywhere.
 */
export class RewardzApiError extends RewardzError {
  constructor(
    message: string,
    /** HTTP status code (e.g. 401, 429, 500). */
    public readonly status: number,
    /** Machine-readable error code from the API body (e.g. "RATE_LIMITED"). */
    public readonly errorCode: string,
    /** Optional additional details from the API response body. */
    public readonly details?: unknown,
  ) {
    super(message, "API_ERROR");
    this.name = "RewardzApiError";
  }

  /** `true` when the server returned 429 Too Many Requests. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** `true` when the server returned 401 Unauthorized. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** `true` when the server returned 404 Not Found. */
  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** `true` when the server returned a 5xx status. */
  get isServerError(): boolean {
    return this.status >= 500;
  }
}

/* -------------------------------------------------------------------------- */
/*  Solana RPC                                                                */
/* -------------------------------------------------------------------------- */

/** Thrown when a Solana JSON-RPC call fails. */
export class RewardzRpcError extends RewardzError {
  constructor(
    message: string,
    /** The numeric JSON-RPC error code, if available. */
    public readonly rpcCode?: number,
  ) {
    super(message, "RPC_ERROR");
    this.name = "RewardzRpcError";
  }
}

/* -------------------------------------------------------------------------- */
/*  Transaction                                                               */
/* -------------------------------------------------------------------------- */

/** Thrown when a Solana transaction simulation or confirmation fails. */
export class RewardzTransactionError extends RewardzError {
  constructor(
    message: string,
    /** The base-58 transaction signature, if one was obtained. */
    public readonly signature?: string,
    /** Program logs emitted during simulation / execution. */
    public readonly logs?: string[],
  ) {
    super(message, "TRANSACTION_ERROR");
    this.name = "RewardzTransactionError";
  }
}

/* -------------------------------------------------------------------------- */
/*  Auth                                                                      */
/* -------------------------------------------------------------------------- */

/** Thrown when authentication fails before a request is even sent. */
export class RewardzAuthError extends RewardzError {
  constructor(
    message: string,
    /** Why auth failed. */
    public readonly reason: "expired" | "invalid" | "missing",
  ) {
    super(message, "AUTH_ERROR");
    this.name = "RewardzAuthError";
  }
}

/* -------------------------------------------------------------------------- */
/*  Timeout                                                                   */
/* -------------------------------------------------------------------------- */

/** Thrown when an HTTP request or RPC call exceeds the configured timeout. */
export class RewardzTimeoutError extends RewardzError {
  constructor(
    message: string,
    /** The timeout threshold that was exceeded (milliseconds). */
    public readonly timeoutMs: number,
  ) {
    super(message, "TIMEOUT_ERROR");
    this.name = "RewardzTimeoutError";
  }
}
