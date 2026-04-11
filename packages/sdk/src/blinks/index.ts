/**
 * `@rewardz/sdk/blinks` — pure, RPC-agnostic IDL → BlinkManifest → instruction
 * primitives consumed by both the api/ runtime and the protocol-console wizard.
 *
 * See `mobileSpecs/TODO-0015-protocol-console.md` §15G for the authoritative
 * spec and five-bucket account taxonomy. This subpath deliberately avoids any
 * runtime dependency on `@solana/kit` / `@solana/web3.js` — the api composes
 * the final `VersionedTransaction` from the `BuiltInstruction` this module
 * emits.
 */

export * from "./types.js";
export * from "./idl-normaliser.js";
export * from "./seeds.js";
export * from "./classifier.js";
export * from "./manifest.js";
export * from "./instruction-builder.js";
