// ---------------------------------------------------------------------------
// @rewardz/sdk/verify — Adapter-based on-chain transaction verification
//
// Examines parsed Solana transaction instructions and delegates verification
// to the first matching adapter. Ships with built-in adapters for swaps
// (Jupiter, Raydium), staking (Marinade, REWARDZ), and token mints
// (SPL Token, Token-2022). Partners can register custom adapters at runtime.
//
// Zero external dependencies — works with raw parsed instruction data.
// ---------------------------------------------------------------------------

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/** A decoded Solana instruction with its program, data, and account keys. */
export interface ParsedInstruction {
  programId: string;
  data: Uint8Array;
  accounts: string[];
}

/** Constraints a transaction must satisfy to pass verification. */
export interface VerificationConstraints {
  minAmount?: bigint;
  maxAmount?: bigint;
  expectedTokenMint?: string;
  expectedProgramId?: string;
}

/** The result returned by every verification attempt. */
export interface VerificationResult {
  verified: boolean;
  adapterName: string;
  programId: string;
  details: Record<string, unknown>;
  error?: string;
}

/**
 * A pluggable strategy that can verify instructions targeting a specific
 * program (or family of programs).
 */
export interface VerificationAdapter {
  name: string;
  /** Check if this adapter can handle the given program ID. */
  supports(programId: string): boolean;
  /** Verify a transaction's instructions against constraints. */
  verify(
    instructions: ParsedInstruction[],
    constraints: VerificationConstraints,
  ): VerificationResult;
}

/* -------------------------------------------------------------------------- */
/*  Built-in Adapters                                                         */
/* -------------------------------------------------------------------------- */

/** Well-known program IDs for swap protocols. */
const JUPITER_V6_PROGRAM = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const RAYDIUM_AMM_PROGRAM = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

/** Well-known program IDs for staking protocols. */
const MARINADE_PROGRAM = "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD";
const REWARDZ_PROGRAM = "mineHEHyaVbQAkcPDDCuCSbkfGNid1RVz6GzcEgSVTh";

/** Well-known program IDs for token minting. */
const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

/**
 * Verifies swap transactions targeting Jupiter v6 or Raydium AMM.
 *
 * Checks that the program ID matches and instruction data is non-empty.
 */
export class SwapVerifier implements VerificationAdapter {
  readonly name = "swap";

  private readonly programIds = new Set([
    JUPITER_V6_PROGRAM,
    RAYDIUM_AMM_PROGRAM,
  ]);

  supports(programId: string): boolean {
    return this.programIds.has(programId);
  }

  verify(
    instructions: ParsedInstruction[],
    constraints: VerificationConstraints,
  ): VerificationResult {
    const matching = instructions.filter((ix) =>
      this.programIds.has(ix.programId),
    );

    if (matching.length === 0) {
      return {
        verified: false,
        adapterName: this.name,
        programId: "unknown",
        details: {},
        error: "No swap instructions found",
      };
    }

    const programId = matching[0].programId;

    // Enforce expectedProgramId constraint if provided
    if (
      constraints.expectedProgramId &&
      programId !== constraints.expectedProgramId
    ) {
      return {
        verified: false,
        adapterName: this.name,
        programId,
        details: { programId, instructionCount: matching.length },
        error: `Expected program ${constraints.expectedProgramId}, found ${programId}`,
      };
    }

    // Swap instructions must carry non-empty data
    const hasData = matching.some((ix) => ix.data.length > 0);
    if (!hasData) {
      return {
        verified: false,
        adapterName: this.name,
        programId,
        details: { programId, instructionCount: matching.length },
        error: "Swap instruction data is empty",
      };
    }

    return {
      verified: true,
      adapterName: this.name,
      programId,
      details: { programId, instructionCount: matching.length },
    };
  }
}

/**
 * Verifies staking transactions targeting Marinade or the REWARDZ program.
 *
 * Checks that the program ID matches and at least one instruction exists.
 */
export class StakeVerifier implements VerificationAdapter {
  readonly name = "stake";

  private readonly programIds = new Set([MARINADE_PROGRAM, REWARDZ_PROGRAM]);

  supports(programId: string): boolean {
    return this.programIds.has(programId);
  }

  verify(
    instructions: ParsedInstruction[],
    constraints: VerificationConstraints,
  ): VerificationResult {
    const matching = instructions.filter((ix) =>
      this.programIds.has(ix.programId),
    );

    if (matching.length === 0) {
      return {
        verified: false,
        adapterName: this.name,
        programId: "unknown",
        details: {},
        error: "No staking instructions found",
      };
    }

    const programId = matching[0].programId;

    // Enforce expectedProgramId constraint if provided
    if (
      constraints.expectedProgramId &&
      programId !== constraints.expectedProgramId
    ) {
      return {
        verified: false,
        adapterName: this.name,
        programId,
        details: { programId, instructionCount: matching.length },
        error: `Expected program ${constraints.expectedProgramId}, found ${programId}`,
      };
    }

    return {
      verified: true,
      adapterName: this.name,
      programId,
      details: { programId, instructionCount: matching.length },
    };
  }
}

/**
 * Verifies token mint transactions targeting SPL Token or Token-2022.
 *
 * Checks that the program ID matches and at least one instruction exists.
 */
export class MintVerifier implements VerificationAdapter {
  readonly name = "mint";

  private readonly programIds = new Set([
    SPL_TOKEN_PROGRAM,
    TOKEN_2022_PROGRAM,
  ]);

  supports(programId: string): boolean {
    return this.programIds.has(programId);
  }

  verify(
    instructions: ParsedInstruction[],
    constraints: VerificationConstraints,
  ): VerificationResult {
    const matching = instructions.filter((ix) =>
      this.programIds.has(ix.programId),
    );

    if (matching.length === 0) {
      return {
        verified: false,
        adapterName: this.name,
        programId: "unknown",
        details: {},
        error: "No mint instructions found",
      };
    }

    const programId = matching[0].programId;

    // Enforce expectedProgramId constraint if provided
    if (
      constraints.expectedProgramId &&
      programId !== constraints.expectedProgramId
    ) {
      return {
        verified: false,
        adapterName: this.name,
        programId,
        details: { programId, instructionCount: matching.length },
        error: `Expected program ${constraints.expectedProgramId}, found ${programId}`,
      };
    }

    return {
      verified: true,
      adapterName: this.name,
      programId,
      details: { programId, instructionCount: matching.length },
    };
  }
}

/* -------------------------------------------------------------------------- */
/*  RewardVerifier                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Adapter-based transaction verifier.
 *
 * Ships with built-in adapters for swaps, staking, and token mints.
 * Partners can register custom adapters via {@link RewardVerifier.register}.
 *
 * @example
 * ```ts
 * const verifier = new RewardVerifier();
 * const result = verifier.verify(parsedInstructions, { expectedProgramId: "JUP6..." });
 * if (result.verified) {
 *   // reward the user
 * }
 * ```
 */
export class RewardVerifier {
  private adapters: VerificationAdapter[] = [];

  constructor() {
    // Register built-in adapters
    this.register(new SwapVerifier());
    this.register(new StakeVerifier());
    this.register(new MintVerifier());
  }

  /** Register a custom adapter. */
  register(adapter: VerificationAdapter): void {
    this.adapters.push(adapter);
  }

  /**
   * Verify a transaction by examining its instructions.
   *
   * Iterates through instructions to find one whose programId is supported
   * by a registered adapter, then delegates verification to that adapter.
   * Returns a failure result if no adapter matches any instruction.
   */
  verify(
    instructions: ParsedInstruction[],
    constraints: VerificationConstraints = {},
  ): VerificationResult {
    for (const ix of instructions) {
      for (const adapter of this.adapters) {
        if (adapter.supports(ix.programId)) {
          return adapter.verify(instructions, constraints);
        }
      }
    }

    return {
      verified: false,
      adapterName: "none",
      programId: "unknown",
      details: {},
      error: "No adapter found for transaction programs",
    };
  }

  /** List registered adapter names. */
  listAdapters(): string[] {
    return this.adapters.map((a) => a.name);
  }
}
