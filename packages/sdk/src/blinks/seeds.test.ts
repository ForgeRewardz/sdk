/**
 * Tests for seeds.ts — base58 codec + seed encoder + PDA derivation.
 *
 * PDA derivation is spot-checked for determinism and shape (base58,
 * bump in [0,255]) rather than against a hard-coded expected PDA.
 * Cross-validation against `PublicKey.findProgramAddressSync` would
 * require pulling in `@solana/web3.js` as a dev dep — kept out to
 * preserve the RPC-agnostic subpath. A determinism + shape test
 * catches the most likely bug class (non-determinism from a mutable
 * seed list or a missing bump loop exit).
 */

import { describe, it, expect } from "vitest";

import {
  base58Decode,
  base58Encode,
  derivePda,
  encodeSeed,
  type SeedContext,
} from "./seeds.js";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const PAYER = "So11111111111111111111111111111111111111112";
const REWARDZ_PROGRAM = "RewardzMVP11111111111111111111111111111111111";

const BASE_CTX: SeedContext = {
  payer: PAYER,
  accountRefs: { config: "ConfigA111111111111111111111111111111111111A" },
  args: { amount: 1000n, nonce: 42n },
  argTypes: { amount: "u64", nonce: "u64" },
};

describe("base58 codec", () => {
  it("round-trips the system program pubkey", () => {
    const bytes = base58Decode(SYSTEM_PROGRAM);
    expect(bytes).toHaveLength(32);
    expect(base58Encode(bytes)).toBe(SYSTEM_PROGRAM);
  });

  it("round-trips a 32-byte pubkey", () => {
    const bytes = base58Decode(PAYER);
    expect(bytes).toHaveLength(32);
    expect(base58Encode(bytes)).toBe(PAYER);
  });

  it("preserves leading zeros (system program is 32 zero bytes)", () => {
    const bytes = base58Decode(SYSTEM_PROGRAM);
    for (const b of bytes) {
      expect(b).toBe(0);
    }
  });

  it("handles an empty string", () => {
    expect(base58Decode("").length).toBe(0);
    expect(base58Encode(new Uint8Array())).toBe("");
  });

  it("throws on invalid characters", () => {
    expect(() => base58Decode("0OIl")).toThrow(/invalid character/);
  });
});

describe("encodeSeed", () => {
  it("encodes a literal as UTF-8 bytes", () => {
    const bytes = encodeSeed({ kind: "literal", value: "stake" }, BASE_CTX);
    expect([...bytes]).toEqual([115, 116, 97, 107, 101]); // "stake"
  });

  it("encodes the payer as 32 bytes", () => {
    const bytes = encodeSeed({ kind: "payer" }, BASE_CTX);
    expect(bytes).toHaveLength(32);
    // First non-zero byte of "So11...12" decoded — verifies it's
    // actually the payer, not a zero-fill fallback.
    expect(bytes[0]).toBe(base58Decode(PAYER)[0]);
  });

  it("encodes a u64 scalar_arg as 8 LE bytes", () => {
    const bytes = encodeSeed(
      { kind: "scalar_arg", name: "amount" },
      BASE_CTX,
    );
    expect(bytes).toHaveLength(8);
    // 1000 LE = [232, 3, 0, 0, 0, 0, 0, 0]
    expect([...bytes]).toEqual([232, 3, 0, 0, 0, 0, 0, 0]);
  });

  it("encodes a u8 scalar_arg as 1 byte", () => {
    const ctx: SeedContext = {
      ...BASE_CTX,
      args: { flag: 42 },
      argTypes: { flag: "u8" },
    };
    const bytes = encodeSeed({ kind: "scalar_arg", name: "flag" }, ctx);
    expect([...bytes]).toEqual([42]);
  });

  it("encodes an account_ref as 32 bytes of the referenced pubkey", () => {
    const bytes = encodeSeed(
      { kind: "account_ref", name: "config" },
      BASE_CTX,
    );
    expect(bytes).toHaveLength(32);
  });

  it("encodes a const_pubkey as 32 bytes", () => {
    const bytes = encodeSeed(
      { kind: "const_pubkey", value: SYSTEM_PROGRAM },
      BASE_CTX,
    );
    expect(bytes).toHaveLength(32);
    for (const b of bytes) {
      expect(b).toBe(0);
    }
  });

  it("throws when a scalar_arg is missing from context.args", () => {
    expect(() =>
      encodeSeed(
        { kind: "scalar_arg", name: "missing" },
        { ...BASE_CTX, args: {} },
      ),
    ).toThrow(/missing scalar_arg/);
  });

  it("throws when a scalar_arg has no argTypes entry", () => {
    expect(() =>
      encodeSeed(
        { kind: "scalar_arg", name: "amount" },
        { ...BASE_CTX, argTypes: {} },
      ),
    ).toThrow(/missing type declaration/);
  });

  it("throws when an account_ref is missing from context.accountRefs", () => {
    expect(() =>
      encodeSeed(
        { kind: "account_ref", name: "missing" },
        BASE_CTX,
      ),
    ).toThrow(/missing account_ref/);
  });
});

describe("derivePda", () => {
  const template = {
    seeds: [
      { kind: "literal", value: "user_stake" } as const,
      { kind: "payer" } as const,
    ],
  };

  it("returns a 44-char-ish base58 string and a bump in [0, 255]", () => {
    const { pda, bump } = derivePda(REWARDZ_PROGRAM, template, BASE_CTX);
    expect(pda).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });

  it("is deterministic — same inputs produce the same PDA and bump", () => {
    const a = derivePda(REWARDZ_PROGRAM, template, BASE_CTX);
    const b = derivePda(REWARDZ_PROGRAM, template, BASE_CTX);
    expect(a.pda).toBe(b.pda);
    expect(a.bump).toBe(b.bump);
  });

  it("produces a different PDA for a different payer", () => {
    const otherCtx: SeedContext = {
      ...BASE_CTX,
      payer: "11111111111111111111111111111112",
    };
    const a = derivePda(REWARDZ_PROGRAM, template, BASE_CTX);
    const b = derivePda(REWARDZ_PROGRAM, template, otherCtx);
    expect(a.pda).not.toBe(b.pda);
  });

  it("produces a different PDA for a different program", () => {
    const a = derivePda(REWARDZ_PROGRAM, template, BASE_CTX);
    const b = derivePda(SYSTEM_PROGRAM, template, BASE_CTX);
    expect(a.pda).not.toBe(b.pda);
  });

  it("resolves the account_ref seed source during derivation", () => {
    const withRef = {
      seeds: [
        { kind: "literal", value: "round" } as const,
        { kind: "account_ref", name: "config" } as const,
      ],
    };
    const result = derivePda(REWARDZ_PROGRAM, withRef, BASE_CTX);
    expect(result.pda).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });
});
