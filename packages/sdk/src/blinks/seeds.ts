/**
 * Seed encoding and PDA derivation for the @rewardz/sdk/blinks
 * subpath.
 *
 * RPC-agnostic: the only runtime deps introduced here are Node's
 * built-in `node:crypto` (for SHA-256) and `@noble/curves/ed25519`
 * (for the on-curve check used by `findProgramAddressSync`). No
 * `@solana/kit` or `@solana/web3.js` imports — keeps the subpath
 * isolated from wallet/RPC concerns so that api/, protocol-console/,
 * and the future @rewardz/cli can all consume it.
 *
 * See TODO-0015 §15G "SDK note" for the authoritative spec.
 */

import { createHash } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";

import type { PdaSeedTemplate, SeedSource } from "./types.js";

/**
 * The fully-resolved context `encodeSeed` and `derivePda` need to
 * turn a seed template into raw bytes:
 *
 * - `payer`       — base58 pubkey of the transaction signer.
 * - `accountRefs` — base58 pubkeys of any sibling accounts the
 *                   template references via `{ kind: "account_ref" }`.
 * - `args`        — scalar values for any `{ kind: "scalar_arg" }`
 *                   seeds. Values may be `string` (stringified numbers
 *                   from query params), `number`, or `bigint`. The
 *                   encoder coerces to `BigInt` for 64-bit widths and
 *                   `Number` for 8/16/32-bit widths.
 * - `argTypes`    — IDL numeric types, keyed by arg name. Required so
 *                   scalar_arg seeds know the exact byte width to emit.
 */
export interface SeedContext {
  payer: string;
  accountRefs: Record<string, string>;
  args: Record<string, string | number | bigint>;
  argTypes: Record<string, "u8" | "u16" | "u32" | "u64">;
}

// ─── Minimal base58 decoder ────────────────────────────────────────
// Inlined so the blinks subpath has zero extra runtime deps beyond
// codama / actions-spec / noble-curves. Implementation is the
// standard big-integer radix conversion used by bs58 / bitcoin.

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const BASE58_LOOKUP: Record<string, number> = {};
for (let i = 0; i < BASE58_ALPHABET.length; i++) {
  BASE58_LOOKUP[BASE58_ALPHABET[i] as string] = i;
}

/**
 * Decodes a base58 string into raw bytes. Throws on invalid characters.
 * Used for every pubkey argument in the seed system.
 *
 * Note: the big-integer accumulator starts as an EMPTY array, not
 * `[0]`. Seeding with a zero byte would be double-counted against the
 * leading-'1' zero-preservation loop — a 32-char string of '1's (e.g.
 * the system program pubkey) would decode to 33 zero bytes instead of
 * 32 because the initial accumulator zero is never overwritten when
 * every input digit is 0.
 */
export function base58Decode(source: string): Uint8Array {
  if (source.length === 0) return new Uint8Array();
  const bytes: number[] = [];
  for (let i = 0; i < source.length; i++) {
    const char = source[i] as string;
    const value = BASE58_LOOKUP[char];
    if (value === undefined) {
      throw new Error(`base58Decode: invalid character '${char}'`);
    }
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      const next = (bytes[j] as number) * 58 + carry;
      bytes[j] = next & 0xff;
      carry = next >> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Preserve leading zeros (every leading '1' in source → one zero byte).
  for (let i = 0; i < source.length && source[i] === "1"; i++) {
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

/**
 * Encodes raw bytes to base58. Used when the PDA derivation result
 * needs to be handed back as a standard Solana address string.
 *
 * Note: `digits` starts as an EMPTY array rather than `[0]`. Seeding
 * with a zero digit would be double-counted against the leading-zero
 * '1'-preservation loop — 32 zero bytes would encode to a 33-char '1'
 * string because the initial zero digit contributes one extra trailing
 * '1' that the decoder then interprets as a 33rd leading zero.
 */
export function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const digits: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i] as number;
    for (let j = 0; j < digits.length; j++) {
      const next = (digits[j] as number) * 256 + carry;
      digits[j] = next % 58;
      carry = (next / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = "";
  // Leading-zero bytes become leading '1's in base58.
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    result += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i] as number];
  }
  return result;
}

// ─── Scalar encoders ───────────────────────────────────────────────

function encodeU8(value: number | bigint): Uint8Array {
  const v = typeof value === "bigint" ? Number(value) : value;
  const out = new Uint8Array(1);
  out[0] = v & 0xff;
  return out;
}

function encodeU16LE(value: number | bigint): Uint8Array {
  const v = typeof value === "bigint" ? Number(value) : value;
  const out = new Uint8Array(2);
  out[0] = v & 0xff;
  out[1] = (v >> 8) & 0xff;
  return out;
}

function encodeU32LE(value: number | bigint): Uint8Array {
  const v = typeof value === "bigint" ? Number(value) : value;
  const out = new Uint8Array(4);
  // Use >>> 0 to stay in unsigned 32-bit territory.
  const unsigned = v >>> 0;
  out[0] = unsigned & 0xff;
  out[1] = (unsigned >> 8) & 0xff;
  out[2] = (unsigned >> 16) & 0xff;
  out[3] = (unsigned >> 24) & 0xff;
  return out;
}

function encodeU64LE(value: number | bigint | string): Uint8Array {
  const big =
    typeof value === "bigint"
      ? value
      : typeof value === "number"
        ? BigInt(value)
        : BigInt(value);
  const out = new Uint8Array(8);
  const view = new DataView(out.buffer);
  view.setBigUint64(0, big, true);
  return out;
}

/**
 * Resolves a single {@link SeedSource} to the raw bytes it represents.
 *
 * The encoding rules match the Solana PDA seed conventions:
 *
 * - `literal`      — UTF-8 bytes of the string value.
 * - `payer`        — 32 bytes of the payer's pubkey (base58-decoded).
 * - `scalar_arg`   — little-endian bytes of the arg's value, width
 *                    determined by `argTypes[name]`.
 * - `account_ref`  — 32 bytes of the referenced account pubkey.
 * - `const_pubkey` — 32 bytes of the hard-coded base58 pubkey.
 */
export function encodeSeed(
  source: SeedSource,
  context: SeedContext,
): Uint8Array {
  switch (source.kind) {
    case "literal":
      return new TextEncoder().encode(source.value);
    case "payer":
      return base58Decode(context.payer);
    case "scalar_arg": {
      const raw = context.args[source.name];
      if (raw === undefined) {
        throw new Error(
          `encodeSeed: missing scalar_arg '${source.name}' in context.args`,
        );
      }
      const type = context.argTypes[source.name];
      if (type === undefined) {
        throw new Error(
          `encodeSeed: missing type declaration for scalar_arg '${source.name}' in context.argTypes`,
        );
      }
      switch (type) {
        case "u8":
          return encodeU8(raw as number | bigint);
        case "u16":
          return encodeU16LE(raw as number | bigint);
        case "u32":
          return encodeU32LE(raw as number | bigint);
        case "u64":
          return encodeU64LE(raw);
      }
      // Exhaustiveness guard (unreachable at runtime — caught by tsc).
      throw new Error(
        `encodeSeed: unsupported scalar_arg type '${String(type)}'`,
      );
    }
    case "account_ref": {
      const pubkey = context.accountRefs[source.name];
      if (pubkey === undefined) {
        throw new Error(
          `encodeSeed: missing account_ref '${source.name}' in context.accountRefs`,
        );
      }
      return base58Decode(pubkey);
    }
    case "const_pubkey":
      return base58Decode(source.value);
  }
}

// ─── PDA derivation ────────────────────────────────────────────────

const PDA_MARKER_BYTES = new TextEncoder().encode("ProgramDerivedAddress");

/**
 * Returns true if a 32-byte value decodes to a valid ed25519 curve
 * point — i.e. is a "regular" Solana keypair pubkey rather than a
 * program-derived address. We use `@noble/curves/ed25519`'s
 * `isValidPublicKey` so the check matches
 * `PublicKey.findProgramAddressSync`'s notion of "off curve".
 */
function isOnCurve(bytes: Uint8Array): boolean {
  try {
    // `isValidPublicKey` returns a boolean for decodable inputs and
    // throws for malformed length — we catch to report false in the
    // latter case because a malformed input is trivially "not on the
    // curve as a valid pubkey".
    return ed25519.utils.isValidPublicKey(bytes, true);
  } catch {
    return false;
  }
}

function sha256Bytes(...parts: Uint8Array[]): Uint8Array {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part);
  return new Uint8Array(hash.digest());
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Derives a program-derived address for the given program, seed
 * template, and request-time context. Mirrors Solana's
 * `findProgramAddressSync` / `PublicKey.findProgramAddress`:
 *
 * 1. Resolve all `template.seeds` entries to raw bytes via `encodeSeed`.
 * 2. For `bump` from 255 down to 0, compute
 *    `sha256(seeds... || [bump] || programId || "ProgramDerivedAddress")`.
 * 3. The first hash that does NOT lie on the ed25519 curve is the PDA.
 *
 * Returns the base58 PDA string and the bump byte that produced it.
 *
 * When `template.withBump === false` the bump loop is skipped and the
 * seeds are used as-is. Callers who set this must guarantee the result
 * is off-curve; otherwise the derivation throws.
 */
export function derivePda(
  programId: string,
  template: PdaSeedTemplate,
  context: SeedContext,
): { pda: string; bump: number } {
  const programBytes = base58Decode(programId);
  const baseSeeds = template.seeds.map((s) => encodeSeed(s, context));
  const withBump = template.withBump !== false;

  if (!withBump) {
    const candidate = sha256Bytes(
      ...baseSeeds,
      programBytes,
      PDA_MARKER_BYTES,
    );
    if (isOnCurve(candidate)) {
      throw new Error(
        "derivePda: supplied seeds produced an on-curve address (withBump=false forbids bump search)",
      );
    }
    return { pda: base58Encode(candidate), bump: 0 };
  }

  for (let bump = 255; bump >= 0; bump--) {
    const bumpBytes = new Uint8Array([bump]);
    const candidate = sha256Bytes(
      ...baseSeeds,
      bumpBytes,
      programBytes,
      PDA_MARKER_BYTES,
    );
    if (!isOnCurve(candidate)) {
      return { pda: base58Encode(candidate), bump };
    }
  }

  throw new Error(
    "derivePda: exhausted all 256 bumps without finding an off-curve address",
  );
}
