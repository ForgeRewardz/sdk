/**
 * Tests for instruction-builder.ts — the runtime BuildInstruction
 * assembler. This is the single load-bearing crypto piece api/'s
 * transaction builder depends on, so the assertions are deliberately
 * exhaustive and hard-coded rather than derived.
 *
 * Each fixture produces a BuiltInstruction whose:
 *   - programId matches the IDL's publicKey
 *   - keys[] order matches the IDL's accountOrder
 *   - keys[payer].isSigner is forced true
 *   - data[0..N] = discriminator bytes (1 for Codama u8, 8 for Anchor)
 *   - data[N..] = user-input args encoded LE
 *
 * Known-good byte sequences:
 *   - userStake(amount=1000n) → [5, 232, 3, 0, 0, 0, 0, 0, 0]
 *   - burnToMint(nonce=42n)   → [17, 42, 0, 0, 0, 0, 0, 0, 0]
 *   - anchor transfer(amount=500n) →
 *       [163, 52, 200, 231, 140, 3, 69, 186, 244, 1, 0, 0, 0, 0, 0, 0]
 */

import { describe, it, expect } from "vitest";

import { buildInstruction } from "./instruction-builder.js";
import { buildManifest } from "./manifest.js";
import { classifyInstruction } from "./classifier.js";
import { parseIdl } from "./idl-normaliser.js";
import type { ProgramProfile } from "./types.js";
import rewardzMvp from "./__fixtures__/rewardz-mvp.json" with { type: "json" };
import anchorSample from "./__fixtures__/anchor-sample.json" with { type: "json" };

const PROTOCOL_ID = "00000000-0000-0000-0000-000000000001";
const PAYER = "So11111111111111111111111111111111111111112";
const CONFIG_PUBKEY = "ConfigA111111111111111111111111111111111111A";
const STAKE_VAULT_PUBKEY = "VaultA111111111111111111111111111111111111AA";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const REWARD_MINT = "RewardMint11111111111111111111111111111111AA";

const USER_STAKE_PROFILE: ProgramProfile = {
  programId: "RewardzMVP11111111111111111111111111111111111",
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
  programId: "RewardzMVP11111111111111111111111111111111111",
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

describe("buildInstruction — rewardz-mvp userStake (Codama u8)", () => {
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

  const built = buildInstruction({
    manifest,
    params: { amount: "1000" },
    payer: PAYER,
    ataMints: { userToken: REWARD_MINT },
  });

  it("returns the program publicKey as programId", () => {
    expect(built.programId).toBe(
      "RewardzMVP11111111111111111111111111111111111",
    );
  });

  it("keys[] follows the IDL account order", () => {
    const names = ["user", "config", "userStake", "userToken", "stakeVault", "systemProgram", "tokenProgram"];
    expect(built.keys).toHaveLength(names.length);
  });

  it("resolves payer as the first key (user → payer)", () => {
    expect(built.keys[0]?.pubkey).toBe(PAYER);
    expect(built.keys[0]?.isSigner).toBe(true);
  });

  it("resolves the fixed config + stakeVault accounts", () => {
    expect(built.keys[1]?.pubkey).toBe(CONFIG_PUBKEY);
    expect(built.keys[4]?.pubkey).toBe(STAKE_VAULT_PUBKEY);
  });

  it("resolves userStake as a PDA (44-char base58 that is NOT the payer)", () => {
    const userStake = built.keys[2]?.pubkey;
    expect(userStake).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(userStake).not.toBe(PAYER);
  });

  it("resolves userToken as an ATA (derived from payer + reward mint)", () => {
    const userToken = built.keys[3]?.pubkey;
    expect(userToken).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(userToken).not.toBe(PAYER);
    expect(userToken).not.toBe(REWARD_MINT);
  });

  it("sets isWritable=true on the writable accounts", () => {
    expect(built.keys[1]?.isWritable).toBe(true); // config
    expect(built.keys[2]?.isWritable).toBe(true); // userStake
    expect(built.keys[3]?.isWritable).toBe(true); // userToken
    expect(built.keys[4]?.isWritable).toBe(true); // stakeVault
    expect(built.keys[5]?.isWritable).toBe(false); // systemProgram
    expect(built.keys[6]?.isWritable).toBe(false); // tokenProgram
  });

  it("emits discriminator byte 5 at data[0]", () => {
    expect(built.data[0]).toBe(5);
  });

  it("emits amount=1000 as little-endian u64 at data[1..9]", () => {
    expect([...built.data.slice(1, 9)]).toEqual([232, 3, 0, 0, 0, 0, 0, 0]);
  });

  it("total data length = 9 (1 disc + 8 u64)", () => {
    expect(built.data).toHaveLength(9);
  });

  it("is deterministic — same inputs produce byte-identical output", () => {
    const again = buildInstruction({
      manifest,
      params: { amount: "1000" },
      payer: PAYER,
      ataMints: { userToken: REWARD_MINT },
    });
    expect([...again.data]).toEqual([...built.data]);
    expect(again.keys.map((k) => k.pubkey)).toEqual(
      built.keys.map((k) => k.pubkey),
    );
  });
});

describe("buildInstruction — rewardz-mvp burnToMint (Codama u8)", () => {
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

  const built = buildInstruction({
    manifest,
    params: { nonce: "42" },
    payer: PAYER,
  });

  it("emits discriminator byte 17 at data[0]", () => {
    expect(built.data[0]).toBe(17);
  });

  it("emits nonce=42 as little-endian u64 at data[1..9]", () => {
    expect([...built.data.slice(1, 9)]).toEqual([42, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("has 5 accounts in IDL order", () => {
    expect(built.keys).toHaveLength(5);
    expect(built.keys[0]?.pubkey).toBe(PAYER);
    expect(built.keys[1]?.pubkey).toBe(CONFIG_PUBKEY);
    // Positions 2 and 3 are PDAs (userStake, mintAttempt).
    expect(built.keys[2]?.pubkey).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(built.keys[3]?.pubkey).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(built.keys[2]?.pubkey).not.toBe(built.keys[3]?.pubkey);
    expect(built.keys[4]?.pubkey).toBe(SYSTEM_PROGRAM);
  });

  it("produces different userStake/mintAttempt PDAs for different nonces (because mintAttempt uses the scalar_arg seed)", () => {
    const otherBuilt = buildInstruction({
      manifest,
      params: { nonce: "99" },
      payer: PAYER,
    });
    // userStake has no scalar_arg seed → same across both calls.
    expect(otherBuilt.keys[2]?.pubkey).toBe(built.keys[2]?.pubkey);
    // mintAttempt does use nonce in its seeds → must differ.
    expect(otherBuilt.keys[3]?.pubkey).not.toBe(built.keys[3]?.pubkey);
  });
});

describe("buildInstruction — anchor-sample transfer (Anchor 8-byte sighash)", () => {
  const root = parseIdl(anchorSample);
  const classification = classifyInstruction(root, "transfer");
  const TO_PUBKEY = "ToA1111111111111111111111111111111111111AAAA";
  const manifest = buildManifest({
    rootNode: root,
    instructionName: "transfer",
    protocolId: PROTOCOL_ID,
    classification,
    fixedAccounts: {
      to: TO_PUBKEY,
      systemProgram: SYSTEM_PROGRAM,
    },
    verificationAdapter: "completion.generic.v1",
  });

  const built = buildInstruction({
    manifest,
    params: { amount: "500" },
    payer: PAYER,
  });

  it("emits the 8-byte Anchor sighash at data[0..8]", () => {
    expect([...built.data.slice(0, 8)]).toEqual([
      163, 52, 200, 231, 140, 3, 69, 186,
    ]);
  });

  it("emits amount=500 as little-endian u64 at data[8..16]", () => {
    expect([...built.data.slice(8, 16)]).toEqual([
      244, 1, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it("total data length = 16 (8 sighash + 8 u64)", () => {
    expect(built.data).toHaveLength(16);
  });

  it("resolves from=payer, to=fixed, systemProgram=fixed", () => {
    expect(built.keys).toHaveLength(3);
    expect(built.keys[0]?.pubkey).toBe(PAYER);
    expect(built.keys[0]?.isSigner).toBe(true);
    expect(built.keys[1]?.pubkey).toBe(TO_PUBKEY);
    expect(built.keys[2]?.pubkey).toBe(SYSTEM_PROGRAM);
  });
});

describe("buildInstruction — error paths", () => {
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

  it("throws when a required user-input param is missing", () => {
    expect(() =>
      buildInstruction({
        manifest,
        params: {}, // missing amount
        payer: PAYER,
        ataMints: { userToken: REWARD_MINT },
      }),
    ).toThrow(/missing user-input arg/);
  });

  it("throws when a user-ata has no mint", () => {
    expect(() =>
      buildInstruction({
        manifest,
        params: { amount: "1000" },
        payer: PAYER,
        // no ataMints → userToken cannot resolve
      }),
    ).toThrow(/needs a mint pubkey/);
  });
});
