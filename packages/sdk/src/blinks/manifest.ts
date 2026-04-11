/**
 * BlinkManifest builder for the @rewardz/sdk/blinks subpath.
 *
 * Takes a classified Codama instruction plus publish-time concretes
 * (fixed accounts, program profile, verification adapter) and produces
 * the runtime-ready {@link BlinkManifest} that api/ persists in
 * `protocol_blinks.manifest_jsonb`.
 *
 * This module is deterministic and pure — same inputs always produce
 * the same output. `mintOwners` is intentionally left empty because
 * resolving mint-owner programs requires RPC, which api/ handles at
 * publish time before persisting the manifest.
 *
 * See TODO-0015 §15G "SDK note" for the authoritative spec.
 */

import { createHash } from "node:crypto";
import type {
  InstructionArgumentNode,
  InstructionNode,
  ProgramNode,
  TypeNode,
} from "codama";

import { base58Encode } from "./seeds.js";
import type { CodamaRootNode } from "./idl-normaliser.js";
import type {
  ArgScalarType,
  BlinkManifest,
  DiscriminatorKind,
  FixedAccounts,
  InstructionClassification,
  PdaSeedTemplate,
  ProgramProfile,
} from "./types.js";

/**
 * Computes the 12-character fixedAccountsHash used as a URL slug
 * segment in the hosted blink route.
 *
 * Algorithm (stable, cross-implementation):
 *
 * 1. Extract the base58 pubkey values from `fixedAccounts`.
 *    Account *names* are ignored — only the addresses matter.
 * 2. Sort the pubkey strings ASCII-ascending.
 * 3. Concatenate with an empty-string separator (no delimiter bytes).
 * 4. UTF-8 encode → SHA-256 → 32 raw bytes.
 * 5. base58-encode the 32 bytes.
 * 6. Take the first 12 characters.
 *
 * Two protocols with the same concrete addresses — regardless of
 * account-name aliasing or the order the admin typed them in —
 * produce an identical hash, which is the invariant tests rely on.
 */
export function computeFixedAccountsHash(
  fixedAccounts: FixedAccounts,
): string {
  const sortedPubkeys = Object.values(fixedAccounts).slice().sort();
  const concatenated = sortedPubkeys.join("");
  const hashBytes = createHash("sha256")
    .update(concatenated, "utf8")
    .digest();
  const base58 = base58Encode(new Uint8Array(hashBytes));
  return base58.slice(0, 12);
}

/**
 * Convert an arbitrary camelCase instruction name into a
 * lowercase-kebab URL slug. Multi-word boundaries come from
 * camelCase transitions; anything non-alphanumeric is collapsed to
 * a single dash and trimmed from both ends.
 */
function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "");
}

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
  return (
    program.instructions.find((ix) => ix.name === instructionName) ?? null
  );
}

/**
 * Converts a base16 (hex) string into its raw byte array.
 * Used when the Anchor-import path stashes the 8-byte discriminator
 * in a `bytesValueNode` with `encoding: "base16"`.
 */
function hexToBytes(hex: string): number[] {
  const clean = hex.replace(/^0x/, "");
  if (clean.length % 2 !== 0) {
    throw new Error(
      `manifest.hexToBytes: odd-length hex string (${hex.length} chars)`,
    );
  }
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    out.push(parseInt(clean.substring(i, i + 2), 16));
  }
  return out;
}

/**
 * Pulls the discriminator bytes + kind out of an instruction's
 * `discriminator` argument. Supports both representations emitted by
 * `@codama/nodes-from-anchor`:
 *
 * - Codama Steel / Pinocchio: `{ defaultValue: { kind: "numberValueNode",
 *   number: N }, type: { kind: "numberTypeNode", format: "u8" } }`.
 *   Produces a single-byte discriminator array and `kind: "u8"`.
 * - Anchor v0.30+: `{ defaultValue: { kind: "bytesValueNode",
 *   encoding: "base16", data: "abcd..." }, type: fixedSizeTypeNode
 *   wrapping bytesTypeNode }`. Produces an 8-byte discriminator array
 *   and `kind: "sighash"`.
 *
 * Throws if the instruction does not have a `discriminator` argument
 * with one of these shapes.
 */
function extractDiscriminator(instruction: InstructionNode): {
  bytes: number[];
  kind: DiscriminatorKind;
} {
  const arg = instruction.arguments.find((a) => a.name === "discriminator");
  if (arg === undefined) {
    throw new Error(
      `manifest.extractDiscriminator: instruction '${instruction.name}' has no 'discriminator' argument`,
    );
  }
  const defaultValue = (arg as InstructionArgumentNode).defaultValue as
    | { kind: string; number?: number; data?: string; encoding?: string }
    | undefined;
  if (defaultValue === undefined) {
    throw new Error(
      `manifest.extractDiscriminator: instruction '${instruction.name}' discriminator arg has no defaultValue`,
    );
  }
  if (defaultValue.kind === "numberValueNode") {
    if (typeof defaultValue.number !== "number") {
      throw new Error(
        `manifest.extractDiscriminator: numberValueNode on '${instruction.name}' missing 'number' field`,
      );
    }
    return { bytes: [defaultValue.number & 0xff], kind: "u8" };
  }
  if (defaultValue.kind === "bytesValueNode") {
    if (typeof defaultValue.data !== "string") {
      throw new Error(
        `manifest.extractDiscriminator: bytesValueNode on '${instruction.name}' missing 'data' field`,
      );
    }
    if (defaultValue.encoding !== "base16") {
      throw new Error(
        `manifest.extractDiscriminator: unsupported bytes encoding '${String(defaultValue.encoding)}' on '${instruction.name}' (expected base16)`,
      );
    }
    return { bytes: hexToBytes(defaultValue.data), kind: "sighash" };
  }
  throw new Error(
    `manifest.extractDiscriminator: unsupported defaultValue kind '${defaultValue.kind}' on '${instruction.name}'`,
  );
}

/**
 * Walks an arg `TypeNode` and returns the SDK's `ArgScalarType` for
 * it, or `null` if the type is not expressible in the v1 manifest.
 * Duplicated from `classifier.ts` to avoid a circular import — the
 * two modules intentionally stay independent.
 */
function scalarTypeFromNode(type: TypeNode): ArgScalarType | null {
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
    case "sizePrefixTypeNode":
    case "fixedSizeTypeNode": {
      const inner = (type as { type?: TypeNode }).type;
      return inner ? scalarTypeFromNode(inner) : null;
    }
    default:
      return null;
  }
}

export interface BuildManifestArgs {
  rootNode: CodamaRootNode;
  instructionName: string;
  protocolId: string;
  classification: InstructionClassification;
  fixedAccounts: FixedAccounts;
  /**
   * Per-(protocol, program) seed templates. Only consulted when the
   * classification marks at least one account as `user-pda`; absent
   * profiles for other accounts are silently ignored.
   */
  programProfile?: ProgramProfile;
  verificationAdapter: string;
}

/**
 * Builds a runtime-ready {@link BlinkManifest} from a classified
 * instruction and admin-supplied publish-time inputs.
 *
 * Invariants the builder enforces:
 *
 * - The instruction must exist in `rootNode`.
 * - Every `user-pda` account in the classification must have a seed
 *   template in `programProfile.seeds[accountName]`.
 * - The discriminator must be extractable via one of the two supported
 *   shapes (numberValueNode or bytesValueNode/base16).
 * - `argLayout` drops the synthetic `discriminator` argument emitted
 *   by `@codama/nodes-from-anchor` because the builder stashes it in
 *   `discriminator[]` / `discriminatorKind` instead.
 *
 * `mintOwners` is always returned empty. api/ runs the RPC lookups
 * for any `user-ata` accounts and writes the resolved values into the
 * final persisted manifest before storing it.
 */
export function buildManifest(args: BuildManifestArgs): BlinkManifest {
  const {
    rootNode,
    instructionName,
    protocolId,
    classification,
    fixedAccounts,
    programProfile,
    verificationAdapter,
  } = args;

  const program = findProgramForInstruction(rootNode, instructionName);
  if (program === null) {
    throw new Error(
      `buildManifest: instruction '${instructionName}' not found in any program`,
    );
  }
  const instruction = findInstruction(program, instructionName);
  if (instruction === null) {
    throw new Error(
      `buildManifest: instruction '${instructionName}' not found`,
    );
  }

  const { bytes: discriminator, kind: discriminatorKind } =
    extractDiscriminator(instruction);

  // Collect account order + flags straight from the IDL so the
  // runtime builder doesn't need to re-parse the Codama node.
  const accountOrder: string[] = [];
  const accountFlags: Record<
    string,
    { isSigner: boolean; isWritable: boolean }
  > = {};
  for (const account of instruction.accounts) {
    accountOrder.push(account.name);
    accountFlags[account.name] = {
      isSigner: account.isSigner === true,
      isWritable: account.isWritable === true,
    };
  }

  // Build argLayout from every non-discriminator argument. The
  // classifier has already decided whether each arg is user-input or
  // fixed; the layout itself is purely structural so buildInstruction
  // knows byte widths at request time.
  const argLayout: BlinkManifest["argLayout"] = [];
  for (const arg of instruction.arguments) {
    if (arg.name === "discriminator") continue;
    const scalar = scalarTypeFromNode(arg.type);
    if (scalar === null) {
      throw new Error(
        `buildManifest: instruction '${instructionName}' argument '${arg.name}' has a non-scalar type not representable in the v1 manifest`,
      );
    }
    argLayout.push({ name: arg.name, type: scalar });
  }

  // Collect PDA seed templates for any user-pda accounts. Missing
  // templates are a hard error because the runtime builder cannot
  // derive addresses without them.
  const pdaSeeds: Record<string, PdaSeedTemplate> = {};
  for (const [accountName, bucket] of Object.entries(
    classification.accounts,
  )) {
    if (bucket !== "user-pda") continue;
    const template = programProfile?.seeds[accountName];
    if (template === undefined) {
      throw new Error(
        `buildManifest: account '${accountName}' is classified as user-pda but no seed template was provided in the program profile`,
      );
    }
    pdaSeeds[accountName] = template;
  }

  return {
    version: "1",
    protocolId,
    programId: program.publicKey,
    instructionName,
    instructionSlug: toKebabCase(instructionName),
    discriminator,
    discriminatorKind,
    classification,
    fixedAccounts,
    fixedAccountsHash: computeFixedAccountsHash(fixedAccounts),
    pdaSeeds,
    mintOwners: {},
    argLayout,
    accountFlags,
    accountOrder,
    verificationAdapter,
  };
}
