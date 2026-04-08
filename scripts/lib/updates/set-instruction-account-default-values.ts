import {
  type Codama,
  accountValueNode,
  pdaLinkNode,
  pdaSeedValueNode,
  pdaValueNode,
  publicKeyValueNode,
  setInstructionAccountDefaultValuesVisitor,
} from 'codama';

// Update to deployed program address when available.
// Generate with: solana-keygen grind --starts-with Rew:1
const REWARDZ_PROGRAM_ID = 'RewardzMVP11111111111111111111111111111111111';
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

/**
 * Sets default values for common instruction accounts.
 *
 * Covers:
 *   - Program ID constants (rewardzMvpProgram, systemProgram, tokenProgram)
 *   - PDA auto-derivation for singleton accounts (config, pointRoot, stakeVault)
 *   - PDA derivation for per-authority accounts where the signer is the authority
 */
export function setInstructionAccountDefaultValues(codama: Codama): Codama {
  codama.update(
    setInstructionAccountDefaultValuesVisitor([
      // ── Program constants ─────────────────────────────────
      {
        account: 'rewardzMvpProgram',
        defaultValue: publicKeyValueNode(REWARDZ_PROGRAM_ID),
      },
      {
        account: 'systemProgram',
        defaultValue: publicKeyValueNode(SYSTEM_PROGRAM_ID),
      },
      {
        account: 'tokenProgram',
        defaultValue: publicKeyValueNode(TOKEN_PROGRAM_ID),
      },

      // ── Singleton PDAs — no variable seeds ────────────────
      {
        account: 'config',
        defaultValue: pdaValueNode(pdaLinkNode('globalConfig'), []),
      },
      {
        account: 'pointRoot',
        defaultValue: pdaValueNode(pdaLinkNode('pointRoot'), []),
      },
      {
        account: 'stakeVault',
        defaultValue: pdaValueNode(pdaLinkNode('stakeVault'), []),
      },

      // ── Per-signer PDAs ────────────────────────────────────
      // userStake PDA derived from the signing user.
      {
        account: 'userStake',
        defaultValue: pdaValueNode(pdaLinkNode('userStake'), [
          pdaSeedValueNode('authority', accountValueNode('user')),
        ]),
      },

      // protocolStake PDA derived from the signing protocol.
      {
        account: 'protocolStake',
        defaultValue: pdaValueNode(pdaLinkNode('protocolStake'), [
          pdaSeedValueNode('authority', accountValueNode('protocol')),
        ]),
      },
    ]),
  );
  return codama;
}
