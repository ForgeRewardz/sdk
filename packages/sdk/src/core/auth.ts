// ---------------------------------------------------------------------------
// @rewardz/sdk — Auth Strategies
//
// Strategy pattern for the four auth mechanisms used by the REWARDZ API:
//   1. WalletAuth   — ed25519 signature per request (mobile/web users)
//   2. ApiKeyAuth   — x-api-key header (protocol partners)
//   3. BearerAuth   — Authorization Bearer JWT (agent delegations)
//   4. InternalKeyAuth — x-api-key header with internal service key (Telegram)
//
// Zero external dependencies — safe in browser, Node 18+, React Native.
// ---------------------------------------------------------------------------

import type { Address } from "@solana/kit";
import { RewardzAuthError } from "./errors.js";

/* -------------------------------------------------------------------------- */
/*  AuthStrategy interface                                                    */
/* -------------------------------------------------------------------------- */

/** Auth strategy interface — each auth method implements this. */
export interface AuthStrategy {
  /** Get headers to attach to requests. */
  getHeaders(): Promise<Record<string, string>>;
  /** Whether auth is currently valid. */
  isValid(): boolean;
}

/* -------------------------------------------------------------------------- */
/*  WalletAdapter interface                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Minimal wallet interface for signing auth messages.
 *
 * Compatible with `@solana/kit` wallet accounts and any wallet that exposes
 * a base58 address and a signMessage method.
 */
export interface WalletAdapter {
  /** Base58 wallet address (compatible with @solana/kit Address type). */
  address: Address;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

/* -------------------------------------------------------------------------- */
/*  1. WalletAuth — per-request ed25519 signature                             */
/* -------------------------------------------------------------------------- */

/**
 * Wallet signature auth for mobile/web users.
 *
 * Each request is authenticated by signing a deterministic message with the
 * wallet's private key. The API verifies the ed25519 signature against the
 * wallet's public key.
 *
 * Message format (must match API middleware):
 *   `Sign in to REWARDZ with wallet {walletAddress}`
 *
 * Headers sent:
 *   - `x-wallet-address` — base58 public key
 *   - `x-wallet-signature` — base64-encoded ed25519 signature
 */
export class WalletAuth implements AuthStrategy {
  /** Cached signature — valid as long as the wallet + message don't change. */
  private cachedSignature: string | undefined;

  constructor(private readonly wallet: WalletAdapter) {}

  /**
   * Sign the auth message and cache the result.
   *
   * Called automatically by `getHeaders()` if no cached signature exists, but
   * can be called eagerly (e.g. during app init) to surface signing errors
   * early.
   *
   * @throws RewardzAuthError if the wallet cannot sign.
   */
  async signIn(): Promise<void> {
    const address = this.wallet.address;
    const message = new TextEncoder().encode(
      `Sign in to REWARDZ with wallet ${address}`,
    );

    try {
      const signatureBytes = await this.wallet.signMessage(message);
      this.cachedSignature = uint8ArrayToBase64(signatureBytes);
    } catch (cause: unknown) {
      throw new RewardzAuthError(
        `Wallet signing failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        "invalid",
      );
    }
  }

  async getHeaders(): Promise<Record<string, string>> {
    if (!this.cachedSignature) {
      await this.signIn();
    }

    return {
      "x-wallet-address": this.wallet.address,
      "x-wallet-signature": this.cachedSignature!,
    };
  }

  isValid(): boolean {
    return !!this.wallet.address && !!this.cachedSignature;
  }

  /** The connected wallet's base58 address. */
  get walletAddress(): string {
    return this.wallet.address;
  }

  /**
   * Clear the cached signature. The next `getHeaders()` call will re-sign.
   * Useful after a wallet disconnect/reconnect.
   */
  invalidate(): void {
    this.cachedSignature = undefined;
  }
}

/* -------------------------------------------------------------------------- */
/*  2. ApiKeyAuth — x-api-key header                                          */
/* -------------------------------------------------------------------------- */

/** API key auth for protocol partners. */
export class ApiKeyAuth implements AuthStrategy {
  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new RewardzAuthError("API key must not be empty", "missing");
    }
  }

  async getHeaders(): Promise<Record<string, string>> {
    return { "x-api-key": this.apiKey };
  }

  isValid(): boolean {
    return !!this.apiKey;
  }
}

/* -------------------------------------------------------------------------- */
/*  3. BearerAuth — Authorization Bearer JWT                                  */
/* -------------------------------------------------------------------------- */

/**
 * Bearer token auth for agent delegations.
 *
 * The token is typically a JWT issued by the REWARDZ API. This class tracks
 * expiration by decoding the `exp` claim from the JWT payload (without
 * verifying the signature — that's the server's job).
 */
export class BearerAuth implements AuthStrategy {
  private token: string;
  private expiresAt: number | undefined;

  constructor(token: string) {
    if (!token) {
      throw new RewardzAuthError("Bearer token must not be empty", "missing");
    }
    this.token = token;
    this.expiresAt = decodeJwtExp(token);
  }

  async getHeaders(): Promise<Record<string, string>> {
    if (this.isExpired()) {
      throw new RewardzAuthError("Bearer token has expired", "expired");
    }
    return { Authorization: `Bearer ${this.token}` };
  }

  isValid(): boolean {
    return !!this.token && !this.isExpired();
  }

  /** Replace the current token (e.g. after a refresh). */
  setToken(token: string): void {
    if (!token) {
      throw new RewardzAuthError("Bearer token must not be empty", "missing");
    }
    this.token = token;
    this.expiresAt = decodeJwtExp(token);
  }

  /** Check if the token has expired (with 30s safety margin). */
  private isExpired(): boolean {
    if (this.expiresAt === undefined) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return nowSec >= this.expiresAt - 30;
  }
}

/* -------------------------------------------------------------------------- */
/*  4. InternalKeyAuth — x-api-key header (trusted services)                  */
/* -------------------------------------------------------------------------- */

/**
 * Internal key auth for trusted services (e.g. Telegram bot).
 *
 * Uses the same `x-api-key` header as ApiKeyAuth, matching the API's
 * `requireInternalKey` middleware which reads from that header.
 */
export class InternalKeyAuth implements AuthStrategy {
  constructor(private readonly internalKey: string) {
    if (!internalKey) {
      throw new RewardzAuthError("Internal key must not be empty", "missing");
    }
  }

  async getHeaders(): Promise<Record<string, string>> {
    return { "x-api-key": this.internalKey };
  }

  isValid(): boolean {
    return !!this.internalKey;
  }
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Decode the `exp` claim from a JWT without verifying the signature.
 *
 * Returns the expiration as a Unix timestamp (seconds), or `undefined` if
 * the token doesn't contain a valid exp claim.
 */
function decodeJwtExp(token: string): number | undefined {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return undefined;

    // JWT payload is base64url-encoded JSON
    const payload = parts[1];
    const json = base64UrlDecode(payload);
    const parsed: unknown = JSON.parse(json);

    if (
      parsed &&
      typeof parsed === "object" &&
      "exp" in parsed &&
      typeof (parsed as { exp: unknown }).exp === "number"
    ) {
      return (parsed as { exp: number }).exp;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Decode a base64url string to a UTF-8 string.
 *
 * Works in browser (atob), Node 18+ (Buffer), and React Native.
 */
function base64UrlDecode(input: string): string {
  // Convert base64url to standard base64
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");

  // Pad if necessary
  const remainder = base64.length % 4;
  if (remainder === 2) base64 += "==";
  else if (remainder === 3) base64 += "=";

  // Prefer globalThis.atob (browser + Node 16+)
  if (typeof globalThis.atob === "function") {
    return globalThis.atob(base64);
  }

  // Fallback for older Node (Buffer)
  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64").toString("utf-8");
  }

  throw new Error("No base64 decoder available");
}

/**
 * Convert a Uint8Array to a standard base64 string.
 *
 * Works in browser (btoa), Node 18+ (Buffer), and React Native.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Prefer Buffer (Node)
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  // Browser fallback — btoa works on binary strings
  if (typeof globalThis.btoa === "function") {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return globalThis.btoa(binary);
  }

  throw new Error("No base64 encoder available");
}
