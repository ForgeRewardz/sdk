import { type Codama, createFromJson } from 'codama';

import {
  appendAccountDiscriminator,
  appendPdaDerivers,
  setInstructionAccountDefaultValues,
  updateInstructionBumps,
} from './updates/index.js';

/**
 * Fluent builder that applies REWARDZ MVP-specific Codama transforms
 * to the generated IDL before rendering a TypeScript client.
 *
 * Usage:
 *   const codama = createRewardzMvpCodamaBuilder(rawIdl)
 *     .appendAccountDiscriminator()
 *     .appendPdaDerivers()
 *     .setInstructionAccountDefaultValues()
 *     .updateInstructionBumps()
 *     .build();
 */
export class RewardzMvpCodamaBuilder {
  private codama: Codama;

  constructor(idl: unknown) {
    const json = typeof idl === 'string' ? idl : JSON.stringify(idl);
    this.codama = createFromJson(json);
  }

  /** Prepend discriminator + version u8 fields to all account structs. */
  appendAccountDiscriminator(): this {
    this.codama = appendAccountDiscriminator(this.codama);
    return this;
  }

  /** Add PDA derivation nodes for all 6 REWARDZ MVP account types. */
  appendPdaDerivers(): this {
    this.codama = appendPdaDerivers(this.codama);
    return this;
  }

  /** Set program IDs and PDA auto-derivations for common instruction accounts. */
  setInstructionAccountDefaultValues(): this {
    this.codama = setInstructionAccountDefaultValues(this.codama);
    return this;
  }

  /** Set bump default values for PDA-creating instructions. */
  updateInstructionBumps(): this {
    this.codama = updateInstructionBumps(this.codama);
    return this;
  }

  build(): Codama {
    return this.codama;
  }
}

export function createRewardzMvpCodamaBuilder(idl: unknown): RewardzMvpCodamaBuilder {
  return new RewardzMvpCodamaBuilder(idl);
}
