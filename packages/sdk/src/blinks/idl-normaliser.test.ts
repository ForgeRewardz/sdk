/**
 * Tests for idl-normaliser.ts — the IDL detection + normalisation layer.
 *
 * Dual-fixture matrix: a Codama root node (rewardz-mvp) and a hand-
 * crafted Anchor IDL (anchor-sample) prove both entry paths work and
 * produce stable SHA-256 hashes for drift detection.
 */

import { describe, it, expect } from "vitest";

import { detectIdlKind, normaliseIdl, parseIdl } from "./idl-normaliser.js";
import rewardzMvp from "./__fixtures__/rewardz-mvp.json" with { type: "json" };
import anchorSample from "./__fixtures__/anchor-sample.json" with { type: "json" };

describe("detectIdlKind", () => {
  it("recognises a Codama root node", () => {
    expect(detectIdlKind(rewardzMvp)).toBe("codama");
  });

  it("recognises an Anchor IDL JSON blob", () => {
    expect(detectIdlKind(anchorSample)).toBe("anchor");
  });

  it("returns 'unknown' for null", () => {
    expect(detectIdlKind(null)).toBe("unknown");
  });

  it("returns 'unknown' for an empty object", () => {
    expect(detectIdlKind({})).toBe("unknown");
  });

  it("returns 'unknown' for a non-object input", () => {
    expect(detectIdlKind("not-an-idl")).toBe("unknown");
    expect(detectIdlKind(42)).toBe("unknown");
    expect(detectIdlKind(undefined)).toBe("unknown");
  });

  it("returns 'unknown' for a partial Anchor shape missing instructions", () => {
    expect(
      detectIdlKind({ name: "incomplete", version: "0.1.0" }),
    ).toBe("unknown");
  });
});

describe("parseIdl", () => {
  it("passes Codama root nodes through unchanged", () => {
    const parsed = parseIdl(rewardzMvp);
    expect(parsed.kind).toBe("rootNode");
    expect(parsed.program.name).toBe("rewardzMvp");
    expect(parsed.program.instructions.length).toBeGreaterThan(0);
  });

  it("converts Anchor IDLs to Codama root nodes", () => {
    const parsed = parseIdl(anchorSample);
    expect(parsed.kind).toBe("rootNode");
    // @codama/nodes-from-anchor camelCases the name.
    expect(parsed.program.name).toBe("anchorSample");
    expect(parsed.program.instructions.length).toBe(1);
    const transfer = parsed.program.instructions[0];
    expect(transfer?.name).toBe("transfer");
  });

  it("throws for an unrecognised shape", () => {
    expect(() => parseIdl({ foo: "bar" })).toThrow(/unrecognised IDL shape/);
  });
});

describe("normaliseIdl", () => {
  it("returns a stable sha256 hash for the Codama fixture", () => {
    const { hash } = normaliseIdl(rewardzMvp);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns a stable sha256 hash for the Anchor fixture", () => {
    const { hash } = normaliseIdl(anchorSample);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same input produces same hash", () => {
    const a = normaliseIdl(rewardzMvp);
    const b = normaliseIdl(rewardzMvp);
    expect(a.hash).toBe(b.hash);
  });

  it("produces different hashes for different IDLs", () => {
    const rewardz = normaliseIdl(rewardzMvp);
    const anchor = normaliseIdl(anchorSample);
    expect(rewardz.hash).not.toBe(anchor.hash);
  });
});
