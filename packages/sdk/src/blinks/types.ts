/**
 * Type definitions for the @rewardz/sdk/blinks subpath.
 *
 * These types describe the published, runtime-ready manifest that
 * api/ persists in `protocol_blinks.manifest_jsonb` and that
 * `buildInstruction` consumes to produce RPC-agnostic instruction
 * records for Solana Action responses.
 *
 * See TODO-0015 §15G "SDK note" for the authoritative spec.
 */

/**
 * Five-bucket account/arg taxonomy (v2 plan §15G).
 *
 * - `payer`     — per-request, sourced from ActionPostRequest.account
 * - `fixed`     — publish-time concrete address (e.g. config, pool, vault)
 * - `user-pda`  — per-request PDA derived from payer + template seeds
 * - `user-ata`  — per-request associated token account for payer+mint
 * - `user-input` — scalar instruction arg pulled from blink query params
 */
export type AccountBucket =
  | "payer"
  | "fixed"
  | "user-pda"
  | "user-ata"
  | "user-input";

/**
 * Five-source seed DSL for user-PDA derivation.
 *
 * Every seed in a `PdaSeedTemplate.seeds` array is one of these kinds.
 * The encoder in `seeds.ts` resolves each source to raw bytes using
 * the `SeedContext` supplied at request time.
 */
export type SeedSource =
  /** UTF-8 string literal (e.g. "stake"). */
  | { kind: "literal"; value: string }
  /** The payer's pubkey (32 bytes). */
  | { kind: "payer" }
  /**
   * A scalar instruction arg encoded little-endian.
   *
   * `name` must reference an arg declared in the manifest's `argLayout`
   * so the encoder knows the exact byte width.
   */
  | { kind: "scalar_arg"; name: string }
  /**
   * Another account's pubkey (32 bytes). `name` must reference a key
   * in `SeedContext.accountRefs`.
   */
  | { kind: "account_ref"; name: string }
  /** Hard-coded base58 pubkey (32 bytes). */
  | { kind: "const_pubkey"; value: string };

/**
 * Per-account seed template (only for the `user-pda` bucket).
 */
export interface PdaSeedTemplate {
  /**
   * Whether to apply the canonical bump-seed algorithm. Default true.
   * When false the caller is expected to provide all seeds explicitly
   * without a trailing bump byte.
   */
  withBump?: boolean;
  seeds: SeedSource[];
}

/**
 * A classification decision for a single instruction.
 *
 * `accounts` maps an IDL account name to its bucket.
 * `args` maps an IDL arg name to a bucket — only `user-input` or
 * `fixed` are valid arg buckets.
 */
export interface InstructionClassification {
  accounts: Record<string, AccountBucket>;
  args: Record<string, AccountBucket>;
}

/**
 * Publish-time concrete pubkey overrides.
 *
 * Keyed by IDL account name, values are base58 pubkeys. These addresses
 * are baked into the blink URL slug via the `fixedAccountsHash`.
 */
export type FixedAccounts = Record<string, string>;

/**
 * Cached mint-owner metadata per ATA account.
 *
 * Populated by api/ at publish time (after resolving the mint via RPC)
 * to avoid a runtime lookup on every blink request. Values are the
 * token program flavour: legacy SPL or Token-2022.
 */
export type MintOwnerMap = Record<string, "legacy" | "token-2022">;

/**
 * Per-(protocol, program) seed templates for `user-pda` accounts.
 *
 * A protocol's admin sets this once per (protocolId, programId) pair
 * via `POST /v1/protocols/:id/program-profiles` and it is reused when
 * publishing any instruction of the same program.
 */
export interface ProgramProfile {
  programId: string;
  /** Seed template keyed by IDL account name. */
  seeds: Record<string, PdaSeedTemplate>;
}

/**
 * The numeric / scalar type for a single instruction argument.
 *
 * These are the only IDL types accepted by the SDK's instruction
 * encoder. Complex / nested arg types are out of scope for the v1
 * manifest — admins who need them fall back to the advanced 15E path.
 */
export type ArgScalarType =
  | "u8"
  | "u16"
  | "u32"
  | "u64"
  | "i8"
  | "i16"
  | "i32"
  | "i64"
  | "bool"
  | "pubkey"
  | "string";

/**
 * Discriminator kind, used by `buildInstruction` to branch on how to
 * emit the leading bytes of the instruction data.
 *
 * - `u8`     — Steel / Pinocchio style: a single `numberTypeNode` byte.
 * - `sighash` — Anchor style: 8-byte `sha256("global:<name>")[0..8]`.
 */
export type DiscriminatorKind = "u8" | "sighash";

/**
 * The BlinkManifest is the published, runtime-ready description of a
 * single instruction exposed as a Solana Action. api/ stores this in
 * `protocol_blinks.manifest_jsonb`; the runtime `/v1/blinks/*` route
 * uses `buildInstruction(manifest, params, payer)` to produce the
 * target ix.
 */
export interface BlinkManifest {
  /** Schema version. */
  version: "1";
  /** Protocol this blink belongs to. */
  protocolId: string;
  /** base58 program pubkey. */
  programId: string;
  /** The instruction name from the IDL (e.g. "userStake"). */
  instructionName: string;
  /** kebab-case URL-safe slug derived from instructionName. */
  instructionSlug: string;
  /**
   * Discriminator bytes. 1 byte for Codama (u8) or 8 bytes for
   * Anchor (sha256("global:<name>")[0..8]).
   */
  discriminator: number[];
  /**
   * The discriminator kind, used by the builder to know whether to
   * emit one byte or eight. Redundant with `discriminator.length` but
   * kept explicit for safer round-trips through JSON.
   */
  discriminatorKind: DiscriminatorKind;
  /** How each account should be resolved at request time. */
  classification: InstructionClassification;
  /** Publish-time fixed pubkeys, keyed by accountName. */
  fixedAccounts: FixedAccounts;
  /** base58(sha256(sortedPubkeys))[0..12] — URL slug segment. */
  fixedAccountsHash: string;
  /** Seed templates for any user-pda accounts. Keyed by accountName. */
  pdaSeeds: Record<string, PdaSeedTemplate>;
  /** Cached mint-owner program for any user-ata accounts. */
  mintOwners: MintOwnerMap;
  /**
   * For each instruction argument, the encoder-ready type descriptor.
   *
   * Arguments appear in the same order the IDL declares them, which
   * is also the wire-order used by `buildInstruction`.
   */
  argLayout: Array<{
    name: string;
    type: ArgScalarType;
  }>;
  /**
   * Per-account signer/writable flags pulled from the IDL. Keyed by
   * account name so `buildInstruction` can emit correct AccountMeta
   * entries without re-parsing the IDL at request time.
   */
  accountFlags: Record<string, { isSigner: boolean; isWritable: boolean }>;
  /**
   * Ordered list of account names in the exact order the IDL
   * declares them. The builder assembles `keys[]` in this order.
   */
  accountOrder: string[];
  /**
   * Verification adapter id (e.g. "stake.steel.v1"). Required by api/
   * at publish time; the publish endpoint rejects manifests whose
   * adapter the verification pipeline cannot resolve.
   */
  verificationAdapter: string;
}

/**
 * Raw built instruction, RPC-agnostic.
 *
 * `api/` wraps this into a full `VersionedTransaction` using
 * `@solana/web3.js` (with compute-budget ixs and an optional ATA
 * prelude) — that assembly lives outside the SDK.
 */
export interface BuiltInstruction {
  /** base58 program pubkey. */
  programId: string;
  keys: Array<{
    /** base58 pubkey. */
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }>;
  /** discriminator + packed args. */
  data: Uint8Array;
}
