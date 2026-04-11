/**
 * Tests for classifier.ts — the five-bucket heuristic classifier.
 *
 * Covers three fixture instructions:
 *   - rewardz-mvp userStake (Codama, PDA + ATA + fixed + user-input)
 *   - rewardz-mvp burnToMint (Codama, two user-pda accounts)
 *   - anchor-sample transfer (Anchor → Codama, signer + defaults)
 */

import { describe, it, expect } from "vitest";

import { classifyInstruction } from "./classifier.js";
import { parseIdl } from "./idl-normaliser.js";
import rewardzMvp from "./__fixtures__/rewardz-mvp.json" with { type: "json" };
import anchorSample from "./__fixtures__/anchor-sample.json" with { type: "json" };

describe("classifyInstruction — rewardz-mvp userStake", () => {
  const root = parseIdl(rewardzMvp);
  const result = classifyInstruction(root, "userStake");

  it("classifies user as payer (signer flag wins)", () => {
    expect(result.accounts.user).toBe("payer");
  });

  it("classifies config as fixed (name hint)", () => {
    expect(result.accounts.config).toBe("fixed");
  });

  it("classifies userStake as user-pda (PDA name hint)", () => {
    expect(result.accounts.userStake).toBe("user-pda");
  });

  it("classifies userToken as user-ata (ATA name hint)", () => {
    expect(result.accounts.userToken).toBe("user-ata");
  });

  it("classifies stakeVault as fixed (vault substring)", () => {
    expect(result.accounts.stakeVault).toBe("fixed");
  });

  it("classifies systemProgram + tokenProgram as fixed", () => {
    expect(result.accounts.systemProgram).toBe("fixed");
    expect(result.accounts.tokenProgram).toBe("fixed");
  });

  it("classifies the amount arg as user-input", () => {
    expect(result.args.amount).toBe("user-input");
  });

  it("classifies the discriminator arg as fixed", () => {
    expect(result.args.discriminator).toBe("fixed");
  });

  it("has no unclassified accounts or args", () => {
    expect(Object.keys(result.accounts)).toHaveLength(7);
    expect(Object.keys(result.args)).toHaveLength(2);
  });
});

describe("classifyInstruction — rewardz-mvp burnToMint", () => {
  const root = parseIdl(rewardzMvp);
  const result = classifyInstruction(root, "burnToMint");

  it("classifies user as payer", () => {
    expect(result.accounts.user).toBe("payer");
  });

  it("classifies config as fixed", () => {
    expect(result.accounts.config).toBe("fixed");
  });

  it("classifies userStake + mintAttempt as user-pda", () => {
    expect(result.accounts.userStake).toBe("user-pda");
    expect(result.accounts.mintAttempt).toBe("user-pda");
  });

  it("classifies systemProgram as fixed", () => {
    expect(result.accounts.systemProgram).toBe("fixed");
  });

  it("classifies the nonce arg as user-input", () => {
    expect(result.args.nonce).toBe("user-input");
  });
});

describe("classifyInstruction — anchor-sample transfer", () => {
  const root = parseIdl(anchorSample);
  const result = classifyInstruction(root, "transfer");

  it("classifies from as payer (signer flag wins)", () => {
    expect(result.accounts.from).toBe("payer");
  });

  it("classifies to as fixed (default fallthrough)", () => {
    expect(result.accounts.to).toBe("fixed");
  });

  it("classifies systemProgram as fixed", () => {
    expect(result.accounts.systemProgram).toBe("fixed");
  });

  it("classifies amount as user-input", () => {
    expect(result.args.amount).toBe("user-input");
  });
});

describe("classifyInstruction — hints override heuristics", () => {
  const root = parseIdl(rewardzMvp);

  it("accepts an accounts override to force user-ata on a name the classifier would call fixed", () => {
    const result = classifyInstruction(root, "userStake", {
      accounts: { stakeVault: "user-ata" },
    });
    expect(result.accounts.stakeVault).toBe("user-ata");
    // Other accounts remain on the default heuristic.
    expect(result.accounts.user).toBe("payer");
  });

  it("accepts an args override", () => {
    const result = classifyInstruction(root, "userStake", {
      args: { amount: "fixed" },
    });
    expect(result.args.amount).toBe("fixed");
  });
});

describe("classifyInstruction — error paths", () => {
  const root = parseIdl(rewardzMvp);

  it("throws for an unknown instruction name", () => {
    expect(() => classifyInstruction(root, "doesNotExist")).toThrow(
      /not found/,
    );
  });

  it("throws when hints alias two accounts to the payer bucket", () => {
    // Regression test (Klaus R10 / code-reviewer I1 important finding):
    // the multi-payer guard must count bucket === 'payer' regardless of
    // whether the bucket came from heuristics or from an admin hint. A
    // hint that forces two accounts to 'payer' would otherwise silently
    // collapse them to the same pubkey in buildInstruction.
    expect(() =>
      classifyInstruction(root, "userStake", {
        accounts: { config: "payer", stakeVault: "payer" },
      }),
    ).toThrow(/candidate payer accounts/);
  });
});
