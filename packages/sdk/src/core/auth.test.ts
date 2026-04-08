// ---------------------------------------------------------------------------
// @rewardz/sdk — Auth Strategies Tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Address } from "@solana/kit";
import {
  type WalletAdapter,
  WalletAuth,
  ApiKeyAuth,
  BearerAuth,
  InternalKeyAuth,
} from "./auth.js";
import { RewardzAuthError } from "./errors.js";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const MOCK_ADDRESS = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" as Address;

/** Create a mock WalletAdapter. */
function mockWallet(overrides?: Partial<WalletAdapter>): WalletAdapter {
  return {
    address: MOCK_ADDRESS,
    signMessage: vi.fn().mockResolvedValue(new Uint8Array(64).fill(0xab)),
    ...overrides,
  };
}

/**
 * Build a fake JWT with a given payload.
 * Does NOT produce a valid signature — only the payload matters for client-side
 * decoding.
 */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const sig = "fake-signature";
  return `${header}.${body}.${sig}`;
}

/* -------------------------------------------------------------------------- */
/*  WalletAuth                                                                */
/* -------------------------------------------------------------------------- */

describe("WalletAuth", () => {
  let wallet: WalletAdapter;
  let auth: WalletAuth;

  beforeEach(() => {
    wallet = mockWallet();
    auth = new WalletAuth(wallet);
  });

  it("isValid() returns false before signIn", () => {
    expect(auth.isValid()).toBe(false);
  });

  it("signIn() calls wallet.signMessage with the correct message", async () => {
    await auth.signIn();

    const expected = new TextEncoder().encode(
      `Sign in to REWARDZ with wallet ${wallet.address}`,
    );

    expect(wallet.signMessage).toHaveBeenCalledOnce();
    expect(wallet.signMessage).toHaveBeenCalledWith(expected);
  });

  it("isValid() returns true after signIn", async () => {
    await auth.signIn();
    expect(auth.isValid()).toBe(true);
  });

  it("getHeaders() auto-signs if no cached signature", async () => {
    const headers = await auth.getHeaders();

    expect(wallet.signMessage).toHaveBeenCalledOnce();
    expect(headers["x-wallet-address"]).toBe(
      "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    );
    expect(headers["x-wallet-signature"]).toBeDefined();
    expect(typeof headers["x-wallet-signature"]).toBe("string");
  });

  it("getHeaders() uses cached signature on second call", async () => {
    await auth.getHeaders();
    await auth.getHeaders();

    // signMessage called only once — second call uses cache
    expect(wallet.signMessage).toHaveBeenCalledOnce();
  });

  it("invalidate() clears cache, forcing re-sign on next getHeaders()", async () => {
    await auth.getHeaders();
    auth.invalidate();

    expect(auth.isValid()).toBe(false);

    await auth.getHeaders();
    expect(wallet.signMessage).toHaveBeenCalledTimes(2);
  });

  it("throws RewardzAuthError when wallet.signMessage rejects", async () => {
    const failWallet = mockWallet({
      signMessage: vi.fn().mockRejectedValue(new Error("User rejected")),
    });
    const failAuth = new WalletAuth(failWallet);

    await expect(failAuth.signIn()).rejects.toThrow(RewardzAuthError);
    await expect(failAuth.getHeaders()).rejects.toThrow(RewardzAuthError);
  });

  it("RewardzAuthError has reason 'invalid' on sign failure", async () => {
    const failWallet = mockWallet({
      signMessage: vi.fn().mockRejectedValue(new Error("User rejected")),
    });
    const failAuth = new WalletAuth(failWallet);

    try {
      await failAuth.signIn();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RewardzAuthError);
      expect((err as RewardzAuthError).reason).toBe("invalid");
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  ApiKeyAuth                                                                */
/* -------------------------------------------------------------------------- */

describe("ApiKeyAuth", () => {
  it("returns x-api-key header", async () => {
    const auth = new ApiKeyAuth("sk_test_abc123");
    const headers = await auth.getHeaders();

    expect(headers).toEqual({ "x-api-key": "sk_test_abc123" });
  });

  it("isValid() returns true for non-empty key", () => {
    const auth = new ApiKeyAuth("sk_test_abc123");
    expect(auth.isValid()).toBe(true);
  });

  it("throws RewardzAuthError for empty key", () => {
    expect(() => new ApiKeyAuth("")).toThrow(RewardzAuthError);
  });

  it("throws with reason 'missing' for empty key", () => {
    try {
      new ApiKeyAuth("");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as RewardzAuthError).reason).toBe("missing");
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  BearerAuth                                                                */
/* -------------------------------------------------------------------------- */

describe("BearerAuth", () => {
  it("returns Authorization Bearer header", async () => {
    const token = fakeJwt({ wallet_address: "abc", exp: 9999999999 });
    const auth = new BearerAuth(token);
    const headers = await auth.getHeaders();

    expect(headers.Authorization).toBe(`Bearer ${token}`);
  });

  it("isValid() returns true for non-expired token", () => {
    const token = fakeJwt({ exp: 9999999999 });
    const auth = new BearerAuth(token);
    expect(auth.isValid()).toBe(true);
  });

  it("isValid() returns false for expired token", () => {
    const token = fakeJwt({ exp: 1000 }); // Unix timestamp 1000 — long expired
    const auth = new BearerAuth(token);
    expect(auth.isValid()).toBe(false);
  });

  it("getHeaders() throws RewardzAuthError for expired token", async () => {
    const token = fakeJwt({ exp: 1000 });
    const auth = new BearerAuth(token);

    await expect(auth.getHeaders()).rejects.toThrow(RewardzAuthError);
  });

  it("expired error has reason 'expired'", async () => {
    const token = fakeJwt({ exp: 1000 });
    const auth = new BearerAuth(token);

    try {
      await auth.getHeaders();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as RewardzAuthError).reason).toBe("expired");
    }
  });

  it("setToken() updates the token and re-parses exp", () => {
    const oldToken = fakeJwt({ exp: 1000 });
    const auth = new BearerAuth(oldToken);
    expect(auth.isValid()).toBe(false);

    const newToken = fakeJwt({ exp: 9999999999 });
    auth.setToken(newToken);
    expect(auth.isValid()).toBe(true);
  });

  it("setToken() throws for empty token", () => {
    const auth = new BearerAuth(fakeJwt({ exp: 9999999999 }));
    expect(() => auth.setToken("")).toThrow(RewardzAuthError);
  });

  it("throws RewardzAuthError for empty constructor token", () => {
    expect(() => new BearerAuth("")).toThrow(RewardzAuthError);
  });

  it("handles tokens without exp claim gracefully", () => {
    const token = fakeJwt({ wallet_address: "abc" }); // no exp
    const auth = new BearerAuth(token);
    // Without exp, token is considered non-expired (server handles expiry)
    expect(auth.isValid()).toBe(true);
  });

  it("handles non-JWT strings gracefully", () => {
    const auth = new BearerAuth("not-a-jwt");
    // Non-JWT tokens treated as valid (no exp to check)
    expect(auth.isValid()).toBe(true);
  });

  it("considers token expired within 30s safety margin", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    // Token expires in 20s — within the 30s margin
    const token = fakeJwt({ exp: nowSec + 20 });
    const auth = new BearerAuth(token);
    expect(auth.isValid()).toBe(false);
  });

  it("considers token valid outside 30s safety margin", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    // Token expires in 60s — outside the 30s margin
    const token = fakeJwt({ exp: nowSec + 60 });
    const auth = new BearerAuth(token);
    expect(auth.isValid()).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  InternalKeyAuth                                                           */
/* -------------------------------------------------------------------------- */

describe("InternalKeyAuth", () => {
  it("returns x-api-key header with internal key", async () => {
    const auth = new InternalKeyAuth("internal_secret_key_123");
    const headers = await auth.getHeaders();

    expect(headers).toEqual({ "x-api-key": "internal_secret_key_123" });
  });

  it("isValid() returns true for non-empty key", () => {
    const auth = new InternalKeyAuth("internal_secret_key_123");
    expect(auth.isValid()).toBe(true);
  });

  it("throws RewardzAuthError for empty key", () => {
    expect(() => new InternalKeyAuth("")).toThrow(RewardzAuthError);
  });

  it("throws with reason 'missing' for empty key", () => {
    try {
      new InternalKeyAuth("");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as RewardzAuthError).reason).toBe("missing");
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  AuthStrategy interface compliance                                         */
/* -------------------------------------------------------------------------- */

describe("AuthStrategy interface compliance", () => {
  it("all strategies have getHeaders() and isValid()", async () => {
    const strategies = [
      new WalletAuth(mockWallet()),
      new ApiKeyAuth("key"),
      new BearerAuth(fakeJwt({ exp: 9999999999 })),
      new InternalKeyAuth("key"),
    ];

    for (const strategy of strategies) {
      expect(typeof strategy.getHeaders).toBe("function");
      expect(typeof strategy.isValid).toBe("function");

      const headers = await strategy.getHeaders();
      expect(typeof headers).toBe("object");
      expect(typeof strategy.isValid()).toBe("boolean");
    }
  });
});
