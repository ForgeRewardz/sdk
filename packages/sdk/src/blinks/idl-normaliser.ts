/**
 * IDL normaliser for the @rewardz/sdk/blinks subpath.
 *
 * Accepts either a Codama root-node JSON blob or an Anchor IDL JSON
 * blob and returns a canonical Codama {@link RootNode}. For drift
 * detection on re-upload, {@link normaliseIdl} also returns a stable
 * SHA-256 hash computed over a key-sorted JSON stringification.
 *
 * See TODO-0015 §15G "SDK note" for the authoritative spec.
 */

import { createHash } from "node:crypto";
import { rootNodeFromAnchor, type AnchorIdl } from "@codama/nodes-from-anchor";
import type { RootNode } from "codama";

/**
 * Re-export of the Codama root-node type under a more descriptive
 * name. Other modules in this subpath import `CodamaRootNode` so the
 * domain intent is obvious at the call site.
 */
export type CodamaRootNode = RootNode;

/** The three shapes `parseIdl` knows how to recognise. */
export type IdlKind = "codama" | "anchor" | "unknown";

/**
 * Cheap structural check to decide which parser to dispatch to.
 *
 * - Codama root nodes always have `{ kind: "rootNode", standard: "codama" }`
 *   at the top level.
 * - Anchor v0.1.0 IDLs have top-level `name`, `version`, and
 *   `instructions[]`.
 * - Anchor v0.30+ IDLs nest `name` and `version` under a `metadata`
 *   block and typically carry a top-level `address` field. Both
 *   shapes are matched as "anchor".
 * - Anything else is `unknown` and will cause `parseIdl` to throw.
 */
export function detectIdlKind(raw: unknown): IdlKind {
  if (raw === null || typeof raw !== "object") return "unknown";
  const obj = raw as Record<string, unknown>;
  if (obj.kind === "rootNode" && obj.standard === "codama") {
    return "codama";
  }
  if (!Array.isArray(obj.instructions)) {
    return "unknown";
  }
  // v0.1.0: top-level name + version.
  if (typeof obj.name === "string" && typeof obj.version === "string") {
    return "anchor";
  }
  // v0.30+: name + version live under `metadata`, often alongside a
  // top-level `address` field.
  const metadata = obj.metadata;
  if (
    metadata !== null &&
    typeof metadata === "object" &&
    typeof (metadata as Record<string, unknown>).name === "string" &&
    typeof (metadata as Record<string, unknown>).version === "string"
  ) {
    return "anchor";
  }
  return "unknown";
}

/**
 * Parses a raw IDL JSON blob into a canonical Codama {@link RootNode}.
 *
 * Codama blobs are passed through unchanged. Anchor blobs go through
 * `@codama/nodes-from-anchor` which handles both v0.1.0 and v0.30+
 * shapes.
 *
 * @throws If `raw` is neither a valid Codama root node nor an Anchor
 * IDL shape this recognises.
 */
export function parseIdl(raw: unknown): CodamaRootNode {
  const kind = detectIdlKind(raw);
  switch (kind) {
    case "codama":
      // Passthrough — we trust Codama root nodes on input. A stricter
      // validator lives in @codama/validators but the publish endpoint
      // should run that separately.
      return raw as CodamaRootNode;
    case "anchor":
      return rootNodeFromAnchor(raw as AnchorIdl);
    case "unknown":
      throw new Error(
        "parseIdl: unrecognised IDL shape — expected a Codama rootNode or an Anchor IDL JSON blob",
      );
  }
}

/**
 * Recursively canonicalises a JSON-compatible value by sorting object
 * keys ascending. Arrays preserve their element order because Codama
 * IDLs treat ordering as semantically meaningful (e.g. instruction
 * argument order matches the wire format).
 */
function canonicalise(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalise);
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    out[key] = canonicalise(obj[key]);
  }
  return out;
}

/**
 * Parses an IDL and returns the normalised Codama root plus a stable
 * SHA-256 hash derived from a key-sorted JSON canonicalisation.
 *
 * api/ uses the `hash` field as the `idl_hash` column value and as
 * the drift-detection key when a protocol re-uploads an IDL.
 */
export function normaliseIdl(raw: unknown): {
  node: CodamaRootNode;
  hash: string;
} {
  const node = parseIdl(raw);
  const canonicalJson = JSON.stringify(canonicalise(node));
  const hash = createHash("sha256").update(canonicalJson, "utf8").digest("hex");
  return { node, hash };
}
