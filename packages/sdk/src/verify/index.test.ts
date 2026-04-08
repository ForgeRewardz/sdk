// ---------------------------------------------------------------------------
// @rewardz/sdk — RewardVerifier Tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  RewardVerifier,
  SwapVerifier,
  StakeVerifier,
  MintVerifier,
  type ParsedInstruction,
  type VerificationAdapter,
  type VerificationResult,
  type VerificationConstraints,
} from "./index.js";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Build a minimal ParsedInstruction. */
function ix(
  programId: string,
  data: number[] = [1, 2, 3],
  accounts: string[] = ["acc1"],
): ParsedInstruction {
  return { programId, data: new Uint8Array(data), accounts };
}

/* Well-known program IDs (duplicated here for test readability). */
const JUPITER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const RAYDIUM = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const MARINADE = "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD";
const REWARDZ = "mineHEHyaVbQAkcPDDCuCSbkfGNid1RVz6GzcEgSVTh";
const SPL_TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const UNKNOWN = "11111111111111111111111111111111";

/* -------------------------------------------------------------------------- */
/*  SwapVerifier                                                              */
/* -------------------------------------------------------------------------- */

describe("SwapVerifier", () => {
  const adapter = new SwapVerifier();

  it("supports Jupiter v6", () => {
    expect(adapter.supports(JUPITER)).toBe(true);
  });

  it("supports Raydium AMM", () => {
    expect(adapter.supports(RAYDIUM)).toBe(true);
  });

  it("does not support unknown programs", () => {
    expect(adapter.supports(UNKNOWN)).toBe(false);
  });

  it("verifies a Jupiter swap instruction", () => {
    const result = adapter.verify([ix(JUPITER)], {});
    expect(result.verified).toBe(true);
    expect(result.adapterName).toBe("swap");
    expect(result.programId).toBe(JUPITER);
    expect(result.details).toEqual({ programId: JUPITER, instructionCount: 1 });
    expect(result.error).toBeUndefined();
  });

  it("verifies a Raydium swap instruction", () => {
    const result = adapter.verify([ix(RAYDIUM)], {});
    expect(result.verified).toBe(true);
    expect(result.programId).toBe(RAYDIUM);
  });

  it("counts multiple matching instructions", () => {
    const result = adapter.verify([ix(JUPITER), ix(JUPITER)], {});
    expect(result.verified).toBe(true);
    expect(result.details).toEqual({ programId: JUPITER, instructionCount: 2 });
  });

  it("fails when no matching instructions exist", () => {
    const result = adapter.verify([ix(UNKNOWN)], {});
    expect(result.verified).toBe(false);
    expect(result.error).toBe("No swap instructions found");
  });

  it("fails when instruction data is empty", () => {
    const result = adapter.verify([ix(JUPITER, [])], {});
    expect(result.verified).toBe(false);
    expect(result.error).toBe("Swap instruction data is empty");
  });

  it("fails when expectedProgramId does not match", () => {
    const result = adapter.verify([ix(JUPITER)], {
      expectedProgramId: RAYDIUM,
    });
    expect(result.verified).toBe(false);
    expect(result.error).toContain("Expected program");
    expect(result.error).toContain(RAYDIUM);
  });

  it("passes when expectedProgramId matches", () => {
    const result = adapter.verify([ix(JUPITER)], {
      expectedProgramId: JUPITER,
    });
    expect(result.verified).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  StakeVerifier                                                             */
/* -------------------------------------------------------------------------- */

describe("StakeVerifier", () => {
  const adapter = new StakeVerifier();

  it("supports Marinade", () => {
    expect(adapter.supports(MARINADE)).toBe(true);
  });

  it("supports REWARDZ program", () => {
    expect(adapter.supports(REWARDZ)).toBe(true);
  });

  it("does not support unknown programs", () => {
    expect(adapter.supports(UNKNOWN)).toBe(false);
  });

  it("verifies a Marinade staking instruction", () => {
    const result = adapter.verify([ix(MARINADE)], {});
    expect(result.verified).toBe(true);
    expect(result.adapterName).toBe("stake");
    expect(result.programId).toBe(MARINADE);
    expect(result.details).toEqual({
      programId: MARINADE,
      instructionCount: 1,
    });
  });

  it("verifies a REWARDZ staking instruction", () => {
    const result = adapter.verify([ix(REWARDZ)], {});
    expect(result.verified).toBe(true);
    expect(result.programId).toBe(REWARDZ);
  });

  it("fails when no matching instructions exist", () => {
    const result = adapter.verify([ix(UNKNOWN)], {});
    expect(result.verified).toBe(false);
    expect(result.error).toBe("No staking instructions found");
  });

  it("fails when expectedProgramId does not match", () => {
    const result = adapter.verify([ix(MARINADE)], {
      expectedProgramId: REWARDZ,
    });
    expect(result.verified).toBe(false);
    expect(result.error).toContain("Expected program");
  });
});

/* -------------------------------------------------------------------------- */
/*  MintVerifier                                                              */
/* -------------------------------------------------------------------------- */

describe("MintVerifier", () => {
  const adapter = new MintVerifier();

  it("supports SPL Token", () => {
    expect(adapter.supports(SPL_TOKEN)).toBe(true);
  });

  it("supports Token-2022", () => {
    expect(adapter.supports(TOKEN_2022)).toBe(true);
  });

  it("does not support unknown programs", () => {
    expect(adapter.supports(UNKNOWN)).toBe(false);
  });

  it("verifies an SPL Token instruction", () => {
    const result = adapter.verify([ix(SPL_TOKEN)], {});
    expect(result.verified).toBe(true);
    expect(result.adapterName).toBe("mint");
    expect(result.programId).toBe(SPL_TOKEN);
    expect(result.details).toEqual({
      programId: SPL_TOKEN,
      instructionCount: 1,
    });
  });

  it("verifies a Token-2022 instruction", () => {
    const result = adapter.verify([ix(TOKEN_2022)], {});
    expect(result.verified).toBe(true);
    expect(result.programId).toBe(TOKEN_2022);
  });

  it("fails when no matching instructions exist", () => {
    const result = adapter.verify([ix(UNKNOWN)], {});
    expect(result.verified).toBe(false);
    expect(result.error).toBe("No mint instructions found");
  });

  it("fails when expectedProgramId does not match", () => {
    const result = adapter.verify([ix(SPL_TOKEN)], {
      expectedProgramId: TOKEN_2022,
    });
    expect(result.verified).toBe(false);
    expect(result.error).toContain("Expected program");
  });
});

/* -------------------------------------------------------------------------- */
/*  RewardVerifier                                                            */
/* -------------------------------------------------------------------------- */

describe("RewardVerifier", () => {
  it("registers built-in adapters on construction", () => {
    const verifier = new RewardVerifier();
    expect(verifier.listAdapters()).toEqual(["swap", "stake", "mint"]);
  });

  it("delegates to the swap adapter for Jupiter instructions", () => {
    const verifier = new RewardVerifier();
    const result = verifier.verify([ix(JUPITER)]);
    expect(result.verified).toBe(true);
    expect(result.adapterName).toBe("swap");
  });

  it("delegates to the stake adapter for Marinade instructions", () => {
    const verifier = new RewardVerifier();
    const result = verifier.verify([ix(MARINADE)]);
    expect(result.verified).toBe(true);
    expect(result.adapterName).toBe("stake");
  });

  it("delegates to the mint adapter for SPL Token instructions", () => {
    const verifier = new RewardVerifier();
    const result = verifier.verify([ix(SPL_TOKEN)]);
    expect(result.verified).toBe(true);
    expect(result.adapterName).toBe("mint");
  });

  it("returns no-adapter result for unknown programs", () => {
    const verifier = new RewardVerifier();
    const result = verifier.verify([ix(UNKNOWN)]);
    expect(result.verified).toBe(false);
    expect(result.adapterName).toBe("none");
    expect(result.programId).toBe("unknown");
    expect(result.error).toBe("No adapter found for transaction programs");
  });

  it("returns no-adapter result for empty instruction list", () => {
    const verifier = new RewardVerifier();
    const result = verifier.verify([]);
    expect(result.verified).toBe(false);
    expect(result.adapterName).toBe("none");
    expect(result.error).toBe("No adapter found for transaction programs");
  });

  it("finds the first matching adapter across mixed instructions", () => {
    const verifier = new RewardVerifier();
    // First instruction is unknown, second is a swap
    const result = verifier.verify([ix(UNKNOWN), ix(JUPITER)]);
    expect(result.verified).toBe(true);
    expect(result.adapterName).toBe("swap");
  });

  it("passes constraints through to the matching adapter", () => {
    const verifier = new RewardVerifier();
    const result = verifier.verify([ix(JUPITER)], {
      expectedProgramId: RAYDIUM,
    });
    expect(result.verified).toBe(false);
    expect(result.error).toContain("Expected program");
  });

  it("defaults constraints to empty object", () => {
    const verifier = new RewardVerifier();
    // Calling without constraints should not throw
    const result = verifier.verify([ix(JUPITER)]);
    expect(result.verified).toBe(true);
  });

  describe("custom adapter registration", () => {
    it("allows registering a custom adapter", () => {
      const verifier = new RewardVerifier();
      const custom: VerificationAdapter = {
        name: "custom",
        supports: (pid: string) => pid === "CustomProgram1111111111111111111",
        verify: (
          _instructions: ParsedInstruction[],
          _constraints: VerificationConstraints,
        ): VerificationResult => ({
          verified: true,
          adapterName: "custom",
          programId: "CustomProgram1111111111111111111",
          details: { custom: true },
        }),
      };

      verifier.register(custom);
      expect(verifier.listAdapters()).toEqual([
        "swap",
        "stake",
        "mint",
        "custom",
      ]);

      const result = verifier.verify([ix("CustomProgram1111111111111111111")]);
      expect(result.verified).toBe(true);
      expect(result.adapterName).toBe("custom");
    });

    it("prefers built-in adapters over later-registered ones for same program", () => {
      const verifier = new RewardVerifier();
      const duplicate: VerificationAdapter = {
        name: "duplicate-swap",
        supports: (pid: string) => pid === JUPITER,
        verify: (): VerificationResult => ({
          verified: false,
          adapterName: "duplicate-swap",
          programId: JUPITER,
          details: {},
          error: "Should not be reached",
        }),
      };

      verifier.register(duplicate);
      // Built-in swap adapter should be checked first
      const result = verifier.verify([ix(JUPITER)]);
      expect(result.verified).toBe(true);
      expect(result.adapterName).toBe("swap");
    });
  });
});
