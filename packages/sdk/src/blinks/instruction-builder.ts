/**
 * Runtime instruction builder for the @rewardz/sdk/blinks subpath.
 *
 * Takes a {@link BlinkManifest}, the request-time query params, and
 * the payer pubkey, then produces a fully-resolved
 * {@link BuiltInstruction} record — RPC-agnostic, ready to be wrapped
 * into a `VersionedTransaction` by api/.
 *
 * This is the single load-bearing crypto piece api/'s transaction
 * assembly depends on. A bug here ships a wrong-discriminator tx
 * that fails on-chain at runtime, not at test time, so the code is
 * deliberately boring: no clever short-circuits, every branch is
 * explicitly documented, and every scalar type has its own encoder.
 *
 * See TODO-0015 §15G "SDK note" for the authoritative spec.
 */

import {
  base58Decode,
  base58Encode,
  derivePda,
  type SeedContext,
} from "./seeds.js";
import { createHash } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import type {
  ArgScalarType,
  BlinkManifest,
  BuiltInstruction,
} from "./types.js";

// ─── Well-known program IDs ────────────────────────────────────────
// Inlined as base58 strings so the subpath stays @solana/web3.js-free.

const ATA_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const LEGACY_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const PDA_MARKER = new TextEncoder().encode("ProgramDerivedAddress");

function sha256(...parts: Uint8Array[]): Uint8Array {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return new Uint8Array(h.digest());
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function isOnCurve(bytes: Uint8Array): boolean {
  try {
    // zip215=false matches Solana's runtime strict RFC8032 decoder
    // (see seeds.ts:isOnCurve for the full rationale — Klaus R10).
    return ed25519.utils.isValidPublicKey(bytes, false);
  } catch {
    return false;
  }
}

/**
 * Standalone PDA derivation used only for the ATA seeds inline here.
 * We duplicate the bump loop from `seeds.ts` rather than re-exporting
 * because the ATA case uses a fixed three-seed template rather than
 * the five-source DSL.
 */
function findProgramAddress(
  seeds: Uint8Array[],
  programIdBase58: string,
): { pda: string; bump: number } {
  const programBytes = base58Decode(programIdBase58);
  if (programBytes.length !== 32) {
    throw new Error(
      `findProgramAddress: programId must decode to exactly 32 bytes, got ${programBytes.length}`,
    );
  }
  for (let bump = 255; bump >= 0; bump--) {
    const candidate = sha256(
      ...seeds,
      new Uint8Array([bump]),
      programBytes,
      PDA_MARKER,
    );
    if (!isOnCurve(candidate)) {
      return { pda: base58Encode(candidate), bump };
    }
  }
  throw new Error("findProgramAddress: exhausted all bumps");
}

/**
 * Computes the associated token account address for a given
 * `(payer, mint, tokenProgram)` triple.
 *
 * Matches `getAssociatedTokenAddressSync` from `@solana/spl-token`:
 *
 *     findProgramAddress(
 *       [owner, tokenProgram, mint],
 *       ASSOCIATED_TOKEN_PROGRAM_ID,
 *     )
 */
function deriveAta(
  payer: string,
  mint: string,
  tokenProgramFlavour: "legacy" | "token-2022",
): string {
  const tokenProgramId =
    tokenProgramFlavour === "legacy"
      ? LEGACY_TOKEN_PROGRAM_ID
      : TOKEN_2022_PROGRAM_ID;
  const seeds = [
    base58Decode(payer),
    base58Decode(tokenProgramId),
    base58Decode(mint),
  ];
  return findProgramAddress(seeds, ATA_PROGRAM_ID).pda;
}

// ─── Scalar arg encoders ───────────────────────────────────────────
// Copy-pasted in a dumb, explicit way so the mapping from IDL type to
// wire bytes is immediately auditable.

function encScalar(type: ArgScalarType, rawValue: unknown): Uint8Array {
  switch (type) {
    case "u8": {
      const n = Number(rawValue);
      const out = new Uint8Array(1);
      out[0] = n & 0xff;
      return out;
    }
    case "u16": {
      const n = Number(rawValue);
      const out = new Uint8Array(2);
      const view = new DataView(out.buffer);
      view.setUint16(0, n & 0xffff, true);
      return out;
    }
    case "u32": {
      const n = Number(rawValue);
      const out = new Uint8Array(4);
      const view = new DataView(out.buffer);
      view.setUint32(0, n >>> 0, true);
      return out;
    }
    case "u64": {
      const big = BigInt(rawValue as string | number | bigint);
      const out = new Uint8Array(8);
      const view = new DataView(out.buffer);
      view.setBigUint64(0, big, true);
      return out;
    }
    case "i8": {
      const n = Number(rawValue);
      const out = new Uint8Array(1);
      const view = new DataView(out.buffer);
      view.setInt8(0, n);
      return out;
    }
    case "i16": {
      const n = Number(rawValue);
      const out = new Uint8Array(2);
      const view = new DataView(out.buffer);
      view.setInt16(0, n, true);
      return out;
    }
    case "i32": {
      const n = Number(rawValue);
      const out = new Uint8Array(4);
      const view = new DataView(out.buffer);
      view.setInt32(0, n, true);
      return out;
    }
    case "i64": {
      const big = BigInt(rawValue as string | number | bigint);
      const out = new Uint8Array(8);
      const view = new DataView(out.buffer);
      view.setBigInt64(0, big, true);
      return out;
    }
    case "bool": {
      const v =
        rawValue === true || rawValue === "true" || Number(rawValue) !== 0;
      return new Uint8Array([v ? 1 : 0]);
    }
    case "pubkey":
      return base58Decode(String(rawValue));
    case "string": {
      const utf8 = new TextEncoder().encode(String(rawValue));
      // Borsh-compatible length-prefixed strings: 4-byte LE length
      // followed by the UTF-8 bytes. Matches @solana/codecs
      // `getUtf8Encoder()` output.
      const out = new Uint8Array(4 + utf8.length);
      const view = new DataView(out.buffer);
      view.setUint32(0, utf8.length, true);
      out.set(utf8, 4);
      return out;
    }
  }
}

export interface BuildInstructionArgs {
  manifest: BlinkManifest;
  /**
   * Request-time query params. Values are always strings (because
   * they come from the blink URL), but the encoder coerces them to
   * the right numeric type via the manifest's argLayout.
   */
  params: Record<string, string>;
  /** Base58 pubkey from `ActionPostRequest.account`. */
  payer: string;
  /**
   * Optional override map for `user-ata` accounts. Keys are account
   * names; values are the base58 mint address that should be used to
   * derive the ATA. When absent for a given ATA account, the builder
   * looks up `manifest.fixedAccounts[accountName + "Mint"]` and falls
   * back to throwing.
   *
   * Typical api/ usage:
   *    `{ userToken: "<rewardMint pubkey>" }`
   *
   * Kept as a separate parameter rather than baked into the manifest
   * because the mint pubkey is often itself a fixed account (e.g.
   * `rewardMint`) whose value is already present in `fixedAccounts`.
   */
  ataMints?: Record<string, string>;
}

/**
 * Builds the target instruction a blink is supposed to produce.
 *
 * Pipeline:
 *
 * 1. Resolve every account in `manifest.accountOrder` to a concrete
 *    base58 pubkey using the classification bucket + manifest tables.
 * 2. Emit an ordered `keys[]` array with the IDL's signer / writable
 *    flags (but forcing `isSigner=true` on the payer account).
 * 3. Pack the `data` buffer: discriminator bytes (1 or 8, depending on
 *    `manifest.discriminatorKind`) followed by each arg in the exact
 *    order `manifest.argLayout` declares.
 *
 * RPC-agnostic: the return value is a plain `{ programId, keys, data }`
 * record. api/ wraps it into a `VersionedTransaction` with
 * compute-budget ixs and any ATA prelude elsewhere.
 */
export function buildInstruction(args: BuildInstructionArgs): BuiltInstruction {
  const { manifest, params, payer, ataMints = {} } = args;

  // Context used by the seeds module when deriving user-pda
  // accounts. Scalar args are pulled from `params` so seed templates
  // can reference them via `{ kind: "scalar_arg", name: ... }`.
  const argTypes: SeedContext["argTypes"] = {};
  const argValues: SeedContext["args"] = {};
  for (const layout of manifest.argLayout) {
    const type = layout.type;
    if (type === "u8" || type === "u16" || type === "u32" || type === "u64") {
      argTypes[layout.name] = type;
    }
    if (layout.name in params) {
      argValues[layout.name] = params[layout.name] as string;
    }
  }

  // We resolve accounts in two passes: first the non-PDA buckets
  // (payer, fixed, user-ata), then the PDAs (so PDA templates can
  // reference any sibling account via `account_ref`).
  const resolved: Record<string, string> = {};

  for (const name of manifest.accountOrder) {
    const bucket = manifest.classification.accounts[name];
    if (bucket === undefined) {
      throw new Error(
        `buildInstruction: account '${name}' has no classification entry`,
      );
    }
    switch (bucket) {
      case "payer":
        resolved[name] = payer;
        break;
      case "fixed": {
        const pubkey = manifest.fixedAccounts[name];
        if (pubkey === undefined) {
          throw new Error(
            `buildInstruction: account '${name}' is classified as 'fixed' but no address is present in manifest.fixedAccounts`,
          );
        }
        resolved[name] = pubkey;
        break;
      }
      case "user-ata": {
        const mint = ataMints[name] ?? manifest.fixedAccounts[`${name}Mint`];
        if (mint === undefined) {
          throw new Error(
            `buildInstruction: user-ata account '${name}' needs a mint pubkey (supply via args.ataMints[name] or manifest.fixedAccounts["${name}Mint"])`,
          );
        }
        const flavour = manifest.mintOwners[name] ?? "legacy";
        resolved[name] = deriveAta(payer, mint, flavour);
        break;
      }
      case "user-pda":
        // Handled in pass two — seed templates may reference other
        // accounts resolved in pass one.
        break;
      case "user-input":
        throw new Error(
          `buildInstruction: account '${name}' is classified as 'user-input' which is only valid for arg classifications`,
        );
    }
  }

  for (const name of manifest.accountOrder) {
    if (manifest.classification.accounts[name] !== "user-pda") continue;
    const template = manifest.pdaSeeds[name];
    if (template === undefined) {
      throw new Error(
        `buildInstruction: user-pda account '${name}' has no seed template in manifest.pdaSeeds`,
      );
    }
    const ctx: SeedContext = {
      payer,
      accountRefs: resolved,
      args: argValues,
      argTypes,
    };
    resolved[name] = derivePda(manifest.programId, template, ctx).pda;
  }

  // Assemble the AccountMeta array in the exact IDL-declared order.
  const keys: BuiltInstruction["keys"] = manifest.accountOrder.map((name) => {
    const pubkey = resolved[name];
    if (pubkey === undefined) {
      throw new Error(`buildInstruction: failed to resolve account '${name}'`);
    }
    const flags = manifest.accountFlags[name];
    if (flags === undefined) {
      throw new Error(
        `buildInstruction: missing accountFlags entry for '${name}'`,
      );
    }
    const isPayer = manifest.classification.accounts[name] === "payer";
    return {
      pubkey,
      // The payer is always a signer regardless of what the IDL says
      // — the spec guarantees exactly one signer per blink.
      isSigner: isPayer ? true : flags.isSigner,
      isWritable: flags.isWritable,
    };
  });

  // Pack the data buffer: discriminator first, then every arg in
  // manifest.argLayout order.
  const dataChunks: Uint8Array[] = [new Uint8Array(manifest.discriminator)];
  for (const layout of manifest.argLayout) {
    const argBucket = manifest.classification.args[layout.name];
    if (argBucket === "user-input") {
      const raw = params[layout.name];
      if (raw === undefined) {
        throw new Error(
          `buildInstruction: missing user-input arg '${layout.name}' in params`,
        );
      }
      dataChunks.push(encScalar(layout.type, raw));
      continue;
    }
    if (argBucket === "fixed") {
      const raw = manifest.fixedAccounts[layout.name];
      if (raw === undefined) {
        throw new Error(
          `buildInstruction: fixed arg '${layout.name}' has no value in manifest.fixedAccounts`,
        );
      }
      dataChunks.push(encScalar(layout.type, raw));
      continue;
    }
    // Any other bucket (payer/user-pda/user-ata) is a classification
    // bug for arguments — reject loudly rather than produce a silent
    // zero-filled byte.
    throw new Error(
      `buildInstruction: arg '${layout.name}' has invalid bucket '${String(argBucket)}' (must be user-input or fixed)`,
    );
  }

  return {
    programId: manifest.programId,
    keys,
    data: concat(...dataChunks),
  };
}
