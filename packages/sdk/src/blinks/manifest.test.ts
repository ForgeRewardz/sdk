/**
 * Tests for manifest.ts — the runtime-ready BlinkManifest builder.
 *
 * Dual-fixture discriminator coverage:
 *   - Codama u8 path  (userStake disc=5, burnToMint disc=17)
 *   - Anchor sighash  (anchor-sample transfer — 8-byte bytesValueNode)
 *
 * Also asserts the fixedAccountsHash stability invariant: same
 * concrete addresses in any order must hash to the same 12 chars.
 */

import { describe, it, expect } from "vitest";

import {
  buildManifest,
  computeFixedAccountsHash,
} from "./manifest.js";
import { classifyInstruction } from "./classifier.js";
import { parseIdl } from "./idl-normaliser.js";
import type { ProgramProfile } from "./types.js";
import rewardzMvp from "./__fixtures__/rewardz-mvp.json" with { type: "json" };
import anchorSample from "./__fixtures__/anchor-sample.json" with { type: "json" };

// Deterministic test inputs. These are NOT real on-curve addresses —
// they're syntactically-valid 32-44 char base58 strings the fixed-
// accounts hasher and builder operate on purely as opaque strings.
const PROTOCOL_ID = "00000000-0000-0000-0000-000000000001";
const CONFIG_PUBKEY = "ConfigA111111111111111111111111111111111111A";
const STAKE_VAULT_PUBKEY = "VaultA111111111111111111111111111111111111AA";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

const USER_STAKE_PROFILE: ProgramProfile = {
  programId: "Fxe49DwqpdSRRpQpv7zm3QwtxaAYcbWurG6ntBZifb4Z",
  seeds: {
    userStake: {
      seeds: [
        { kind: "literal", value: "user_stake" },
        { kind: "payer" },
      ],
    },
  },
};

const BURN_TO_MINT_PROFILE: ProgramProfile = {
  programId: "Fxe49DwqpdSRRpQpv7zm3QwtxaAYcbWurG6ntBZifb4Z",
  seeds: {
    userStake: {
      seeds: [
        { kind: "literal", value: "user_stake" },
        { kind: "payer" },
      ],
    },
    mintAttempt: {
      seeds: [
        { kind: "literal", value: "mint_attempt" },
        { kind: "payer" },
        { kind: "scalar_arg", name: "nonce" },
      ],
    },
  },
};

describe("computeFixedAccountsHash", () => {
  it("produces a 12-character base58 string", () => {
    const hash = computeFixedAccountsHash({
      config: CONFIG_PUBKEY,
      stakeVault: STAKE_VAULT_PUBKEY,
    });
    expect(hash).toHaveLength(12);
    expect(hash).toMatch(/^[1-9A-HJ-NP-Za-km-z]{12}$/);
  });

  it("is stable — key order does not affect the hash", () => {
    const a = computeFixedAccountsHash({
      config: CONFIG_PUBKEY,
      stakeVault: STAKE_VAULT_PUBKEY,
      systemProgram: SYSTEM_PROGRAM,
    });
    const b = computeFixedAccountsHash({
      systemProgram: SYSTEM_PROGRAM,
      config: CONFIG_PUBKEY,
      stakeVault: STAKE_VAULT_PUBKEY,
    });
    expect(a).toBe(b);
  });

  it("account-name aliasing does not affect the hash (only addresses matter)", () => {
    const a = computeFixedAccountsHash({
      configA: CONFIG_PUBKEY,
      vaultA: STAKE_VAULT_PUBKEY,
    });
    const b = computeFixedAccountsHash({
      foo: CONFIG_PUBKEY,
      bar: STAKE_VAULT_PUBKEY,
    });
    expect(a).toBe(b);
  });

  it("different addresses produce different hashes", () => {
    const a = computeFixedAccountsHash({ x: CONFIG_PUBKEY });
    const b = computeFixedAccountsHash({ x: STAKE_VAULT_PUBKEY });
    expect(a).not.toBe(b);
  });

  it("empty input produces an empty-string hash (the 12-char slice of an empty base58)", () => {
    const hash = computeFixedAccountsHash({});
    // sha256("") still produces 32 bytes → 44 base58 chars, so the
    // slice is 12 chars long. Just assert it's deterministic and
    // consistent with the algorithm rather than asserting a specific
    // string — avoids hardcoding implementation-defined constants.
    expect(hash).toHaveLength(12);
  });
});

describe("buildManifest — rewardz-mvp userStake (Codama u8 discriminator)", () => {
  const root = parseIdl(rewardzMvp);
  const classification = classifyInstruction(root, "userStake");
  const manifest = buildManifest({
    rootNode: root,
    instructionName: "userStake",
    protocolId: PROTOCOL_ID,
    classification,
    fixedAccounts: {
      config: CONFIG_PUBKEY,
      stakeVault: STAKE_VAULT_PUBKEY,
      systemProgram: SYSTEM_PROGRAM,
      tokenProgram: TOKEN_PROGRAM,
    },
    programProfile: USER_STAKE_PROFILE,
    verificationAdapter: "stake.steel.v1",
  });

  it("has version 1", () => {
    expect(manifest.version).toBe("1");
  });

  it("carries the program publicKey from the IDL", () => {
    expect(manifest.programId).toBe(
      "Fxe49DwqpdSRRpQpv7zm3QwtxaAYcbWurG6ntBZifb4Z",
    );
  });

  it("kebab-cases the instruction slug", () => {
    expect(manifest.instructionSlug).toBe("user-stake");
  });

  it("emits a single-byte discriminator with kind='u8'", () => {
    expect(manifest.discriminator).toEqual([5]);
    expect(manifest.discriminatorKind).toBe("u8");
  });

  it("preserves the IDL account order", () => {
    expect(manifest.accountOrder).toEqual([
      "user",
      "config",
      "userStake",
      "userToken",
      "stakeVault",
      "systemProgram",
      "tokenProgram",
    ]);
  });

  it("carries isSigner/isWritable flags from the IDL", () => {
    expect(manifest.accountFlags.user).toEqual({
      isSigner: true,
      isWritable: false,
    });
    expect(manifest.accountFlags.config).toEqual({
      isSigner: false,
      isWritable: true,
    });
  });

  it("argLayout drops the synthetic discriminator argument", () => {
    expect(manifest.argLayout).toEqual([{ name: "amount", type: "u64" }]);
  });

  it("pulls seed templates for user-pda accounts from the profile", () => {
    expect(manifest.pdaSeeds.userStake).toEqual({
      seeds: [
        { kind: "literal", value: "user_stake" },
        { kind: "payer" },
      ],
    });
  });

  it("mintOwners starts empty (api/ populates at publish time)", () => {
    expect(manifest.mintOwners).toEqual({});
  });

  it("carries the verification adapter id verbatim", () => {
    expect(manifest.verificationAdapter).toBe("stake.steel.v1");
  });

  it("fixedAccountsHash is 12 chars and matches computeFixedAccountsHash", () => {
    expect(manifest.fixedAccountsHash).toHaveLength(12);
    expect(manifest.fixedAccountsHash).toBe(
      computeFixedAccountsHash(manifest.fixedAccounts),
    );
  });
});

describe("buildManifest — rewardz-mvp burnToMint", () => {
  const root = parseIdl(rewardzMvp);
  const classification = classifyInstruction(root, "burnToMint");
  const manifest = buildManifest({
    rootNode: root,
    instructionName: "burnToMint",
    protocolId: PROTOCOL_ID,
    classification,
    fixedAccounts: {
      config: CONFIG_PUBKEY,
      systemProgram: SYSTEM_PROGRAM,
    },
    programProfile: BURN_TO_MINT_PROFILE,
    verificationAdapter: "mint.steel.v1",
  });

  it("emits discriminator byte 17 with kind='u8'", () => {
    expect(manifest.discriminator).toEqual([17]);
    expect(manifest.discriminatorKind).toBe("u8");
  });

  it("argLayout is [nonce: u64]", () => {
    expect(manifest.argLayout).toEqual([{ name: "nonce", type: "u64" }]);
  });

  it("accountOrder matches the IDL", () => {
    expect(manifest.accountOrder).toEqual([
      "user",
      "config",
      "userStake",
      "mintAttempt",
      "systemProgram",
    ]);
  });

  it("carries seed templates for BOTH user-pda accounts", () => {
    expect(manifest.pdaSeeds.userStake).toBeDefined();
    expect(manifest.pdaSeeds.mintAttempt).toBeDefined();
  });
});

describe("buildManifest — anchor-sample transfer (Anchor sighash discriminator)", () => {
  const root = parseIdl(anchorSample);
  const classification = classifyInstruction(root, "transfer");
  const manifest = buildManifest({
    rootNode: root,
    instructionName: "transfer",
    protocolId: PROTOCOL_ID,
    classification,
    fixedAccounts: {
      to: "ToA1111111111111111111111111111111111111AAAA",
      systemProgram: SYSTEM_PROGRAM,
    },
    verificationAdapter: "completion.generic.v1",
  });

  it("emits an 8-byte discriminator with kind='sighash'", () => {
    expect(manifest.discriminator).toHaveLength(8);
    expect(manifest.discriminatorKind).toBe("sighash");
  });

  it("discriminator bytes match sha256('global:transfer')[0..8]", () => {
    // Pre-computed with `echo -n 'global:transfer' | openssl dgst -sha256`.
    // Matches the value baked into anchor-sample.json.
    expect(manifest.discriminator).toEqual([
      163, 52, 200, 231, 140, 3, 69, 186,
    ]);
  });

  it("argLayout is [amount: u64]", () => {
    expect(manifest.argLayout).toEqual([{ name: "amount", type: "u64" }]);
  });

  it("kebab-cases a single-word name back to itself", () => {
    expect(manifest.instructionSlug).toBe("transfer");
  });
});

describe("buildManifest — error paths", () => {
  const root = parseIdl(rewardzMvp);

  it("throws when a user-pda account has no seed template", () => {
    const classification = classifyInstruction(root, "userStake");
    expect(() =>
      buildManifest({
        rootNode: root,
        instructionName: "userStake",
        protocolId: PROTOCOL_ID,
        classification,
        fixedAccounts: {
          config: CONFIG_PUBKEY,
          stakeVault: STAKE_VAULT_PUBKEY,
          systemProgram: SYSTEM_PROGRAM,
          tokenProgram: TOKEN_PROGRAM,
        },
        // No programProfile — userStake PDA has no seeds.
        verificationAdapter: "stake.steel.v1",
      }),
    ).toThrow(/no seed template/);
  });

  it("throws when the instruction is not in the root", () => {
    const classification = classifyInstruction(root, "userStake");
    expect(() =>
      buildManifest({
        rootNode: root,
        instructionName: "doesNotExist",
        protocolId: PROTOCOL_ID,
        classification,
        fixedAccounts: {},
        verificationAdapter: "stake.steel.v1",
      }),
    ).toThrow(/not found/);
  });
});
