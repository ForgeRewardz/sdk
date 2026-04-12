/**
 * Five-bucket instruction classifier for the @rewardz/sdk/blinks
 * subpath.
 *
 * Walks a Codama `InstructionNode` and assigns each account and
 * argument to one of the five buckets defined in
 * {@link AccountBucket}. Heuristics are deterministic and pure:
 * calling `classifyInstruction` twice with identical inputs always
 * produces identical output.
 *
 * The classifier is intentionally conservative: when a signal is
 * ambiguous it falls back to the safest bucket (`fixed` for accounts,
 * `fixed` for pubkey args) and expects the admin to override via
 * {@link ClassificationHints}.
 *
 * See TODO-0015 §15G "SDK note" for the authoritative spec.
 */

import type {
  InstructionAccountNode,
  InstructionArgumentNode,
  InstructionNode,
  ProgramNode,
  TypeNode,
} from "codama";
import type { CodamaRootNode } from "./idl-normaliser.js";
import type { AccountBucket, InstructionClassification } from "./types.js";

/**
 * Admin-supplied overrides that win against any heuristic. Use this
 * to correct the classifier on a per-instruction basis — e.g. when an
 * account named `authority` is really a fixed governance key rather
 * than the payer.
 */
export interface ClassificationHints {
  /** Force the bucket for specific account names. */
  accounts?: Record<string, AccountBucket>;
  /** Force the bucket for specific argument names. */
  args?: Record<string, AccountBucket>;
}

/**
 * Account-name substrings that imply the account is the transaction
 * signer. The heuristic wins only when no other signal is more
 * specific (e.g. an override hint).
 */
const PAYER_NAME_HINTS = ["user", "authority", "signer", "payer", "owner"];

/**
 * Well-known singleton account-name substrings that imply the address
 * is publish-time `fixed` rather than per-request. Keeps config / pool
 * / vault / mint from ever landing in the `user-pda` bucket by default.
 */
const FIXED_NAME_HINTS = [
  "config",
  "treasury",
  "pool",
  "vault",
  "rewardmint",
  "mint",
  "program",
  "systemprogram",
  "tokenprogram",
  "rent",
  "clock",
  "associatedtokenprogram",
];

/**
 * Name substrings that hint at an associated token account. These are
 * token accounts whose address is derived from (payer, mint, token
 * program) and must be resolved at request time.
 */
const ATA_NAME_HINTS = ["usertoken", "useraccount", "userata", "payertoken"];

/**
 * Substrings whose presence implies the account is a per-user PDA
 * that needs a seed template (e.g. `userStake`). These are the
 * accounts the admin must supply seeds for when filling in the
 * program profile.
 */
const PDA_NAME_HINTS = [
  "userstake",
  "userstate",
  "userrecord",
  "userposition",
  "userdata",
];

function nameMatchesAny(name: string, hints: string[]): boolean {
  const lower = name.toLowerCase();
  return hints.some((hint) => lower === hint || lower.includes(hint));
}

/**
 * Narrows an arg's {@link TypeNode} to the subset the SDK's encoder
 * supports. Returns the matching `ArgScalarType` string or `null` if
 * the type is non-scalar (struct, array, option, etc.).
 */
function scalarTypeFromNode(
  type: TypeNode,
):
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
  | "string"
  | null {
  if (!type || typeof type !== "object") return null;
  const kind = (type as { kind?: string }).kind;
  switch (kind) {
    case "numberTypeNode": {
      const format = (type as { format?: string }).format;
      if (
        format === "u8" ||
        format === "u16" ||
        format === "u32" ||
        format === "u64" ||
        format === "i8" ||
        format === "i16" ||
        format === "i32" ||
        format === "i64"
      ) {
        return format;
      }
      return null;
    }
    case "booleanTypeNode":
      return "bool";
    case "publicKeyTypeNode":
      return "pubkey";
    case "stringTypeNode":
      return "string";
    // Size-prefixed or fixed strings wrap a stringTypeNode — codama
    // normalises these under the wrapping kind, but we still want to
    // recognise the inner string as user-input.
    case "sizePrefixTypeNode":
    case "fixedSizeTypeNode": {
      const inner = (type as { type?: TypeNode }).type;
      return inner ? scalarTypeFromNode(inner) : null;
    }
    default:
      return null;
  }
}

/**
 * Finds a program node in the root that contains the given
 * instruction name. Codama's `RootNode` has a primary `program` plus
 * an optional `additionalPrograms` array — the classifier searches
 * both.
 */
function findProgramForInstruction(
  root: CodamaRootNode,
  instructionName: string,
): ProgramNode | null {
  if (root.program.instructions.some((ix) => ix.name === instructionName)) {
    return root.program;
  }
  for (const prog of root.additionalPrograms ?? []) {
    if (prog.instructions.some((ix) => ix.name === instructionName)) {
      return prog;
    }
  }
  return null;
}

function findInstruction(
  program: ProgramNode,
  instructionName: string,
): InstructionNode | null {
  return program.instructions.find((ix) => ix.name === instructionName) ?? null;
}

/**
 * Default bucket for a single account, based on name heuristics and
 * the IDL's signer flag. Called by {@link classifyInstruction}; hints
 * override the return value downstream.
 */
function defaultAccountBucket(account: InstructionAccountNode): AccountBucket {
  const name = account.name;
  // A literal signer is always the payer. The blink system only
  // supports single-signer instructions at v1.
  if (account.isSigner === true) return "payer";
  if (account.isSigner === "either") return "payer";

  if (nameMatchesAny(name, ATA_NAME_HINTS)) return "user-ata";
  if (nameMatchesAny(name, PDA_NAME_HINTS)) return "user-pda";
  if (nameMatchesAny(name, FIXED_NAME_HINTS)) return "fixed";
  if (nameMatchesAny(name, PAYER_NAME_HINTS)) return "payer";

  // Unknown shape — defer to admin. `fixed` is the safest default
  // because it forces an explicit address at publish time rather than
  // silently routing through the payer.
  return "fixed";
}

/**
 * Default bucket for a single argument, based on its type. Scalar
 * types become `user-input` because they're expected to come in from
 * the blink query string; pubkey args default to `fixed` so admins
 * must paste them at publish time.
 *
 * The instruction `discriminator` argument (when present) is always
 * `fixed` because it is constant for the instruction shape and must
 * not be overridden by user input.
 */
function defaultArgBucket(arg: InstructionArgumentNode): AccountBucket {
  if (arg.name === "discriminator") return "fixed";
  const scalar = scalarTypeFromNode(arg.type);
  switch (scalar) {
    case "u8":
    case "u16":
    case "u32":
    case "u64":
    case "i8":
    case "i16":
    case "i32":
    case "i64":
    case "bool":
    case "string":
      return "user-input";
    case "pubkey":
      return "fixed";
    case null:
      // Non-scalar arg (struct/enum/array/option). The v1 manifest
      // cannot express these — admin must fall back to the 15E path.
      // We still return `fixed` so the classifier is total; the
      // manifest builder will error when asked to layout the arg.
      return "fixed";
  }
}

/**
 * Classifies every account and argument of a single instruction.
 *
 * Heuristics (in priority order):
 *
 * 1. If a `ClassificationHints.accounts[name]` override exists, use it.
 * 2. Otherwise run the account-name / signer-flag heuristic.
 *
 * The same two-step priority applies to arguments via
 * `ClassificationHints.args`.
 *
 * At most one account may be classified as `payer`. If the heuristic
 * produces multiple payer candidates (e.g. two signer accounts) the
 * classifier throws rather than silently producing an ambiguous
 * manifest — admins can break the tie via hints.
 *
 * @throws If `instructionName` is not present in any program of the root
 * node, or if multiple non-hinted accounts resolve to `payer`.
 */
export function classifyInstruction(
  root: CodamaRootNode,
  instructionName: string,
  hints?: ClassificationHints,
): InstructionClassification {
  const program = findProgramForInstruction(root, instructionName);
  if (program === null) {
    throw new Error(
      `classifyInstruction: instruction '${instructionName}' not found in any program`,
    );
  }
  const instruction = findInstruction(program, instructionName);
  if (instruction === null) {
    // Unreachable because findProgramForInstruction already checked,
    // but keeps the null-narrowing explicit for TS.
    throw new Error(
      `classifyInstruction: instruction '${instructionName}' not found`,
    );
  }

  const accounts: Record<string, AccountBucket> = {};
  const payerCandidates: string[] = [];
  for (const account of instruction.accounts) {
    const name = account.name;
    const override = hints?.accounts?.[name];
    const bucket = override ?? defaultAccountBucket(account);
    accounts[name] = bucket;
    // Count ALL payer-bucketed accounts, whether they came from heuristics
    // or from an admin-supplied hint. The v1 spec guarantees exactly one
    // signer per blink — a hint that aliases two accounts to `payer` would
    // silently collapse them in buildInstruction, so the guardrail must
    // enforce on final bucket counts not just heuristic-derived ones.
    if (bucket === "payer") {
      payerCandidates.push(name);
    }
  }

  if (payerCandidates.length > 1) {
    throw new Error(
      `classifyInstruction: instruction '${instructionName}' has ${payerCandidates.length} candidate payer accounts (${payerCandidates.join(", ")}); disambiguate via ClassificationHints.accounts (a single payer bucket is required even when supplied via hints)`,
    );
  }

  const args: Record<string, AccountBucket> = {};
  for (const arg of instruction.arguments) {
    const name = arg.name;
    const override = hints?.args?.[name];
    args[name] = override ?? defaultArgBucket(arg);
  }

  return { accounts, args };
}
