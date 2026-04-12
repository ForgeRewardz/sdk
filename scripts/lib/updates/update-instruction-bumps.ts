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

      // DeployToRound creates the playerDeployment PDA; no bump arg in data.
      deployToRound: {
        arguments: {
          // points is user-provided, not a bump.
        },
      },

      // StartRound creates the gameRound and roundVault PDAs; no bump args in data.
      startRound: {
        arguments: {
          // Program derives round_id and bumps internally.
        },
      },
    }),
  );
  return codama;
}
