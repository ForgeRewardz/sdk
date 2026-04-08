import { type Codama, accountBumpValueNode, updateInstructionsVisitor } from 'codama';

/**
 * Sets bump default values for instructions that create PDA accounts.
 *
 * The bump is derived from the PDA and passed as an instruction argument
 * so the on-chain program can create the account with the correct seeds.
 */
export function updateInstructionBumps(codama: Codama): Codama {
  codama.update(
    updateInstructionsVisitor({
      // InitializeConfig creates the config PDA and vault PDA.
      // The config bump is stored in the account; vault bump is ephemeral.
      // Codama only supports one bump per instruction default — use config bump.
      initializeConfig: {
        arguments: {
          // No standard bump arg in the instruction data for this instruction;
          // the program derives bumps internally. Nothing to set here.
        },
      },

      // UserStake creates the userStake PDA.
      userStake: {
        arguments: {
          // No bump arg exposed in the instruction data for user_stake.
        },
      },

      // ProtocolStake creates the protocolStake PDA.
      protocolStake: {
        arguments: {
          // No bump arg exposed in the instruction data for protocol_stake.
        },
      },

      // CreateRental creates the rentalAgreement PDA.
      createRental: {
        arguments: {
          // No bump arg exposed in the instruction data for create_rental.
        },
      },

      // BurnToMint creates the mintAttempt PDA; no bump arg in data.
      burnToMint: {
        arguments: {
          // nonce is a user-provided value, not a bump.
        },
      },
    }),
  );
  return codama;
}
