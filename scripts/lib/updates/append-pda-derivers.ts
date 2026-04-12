import {
  type Codama,
  addPdasVisitor,
  bytesTypeNode,
  constantPdaSeedNode,
  fixedSizeTypeNode,
  numberTypeNode,
  publicKeyTypeNode,
  stringTypeNode,
  stringValueNode,
  variablePdaSeedNode,
} from 'codama';

/**
 * Adds PDA derivation definitions for all REWARDZ MVP account types.
 *
 * PDA seeds:
 *   globalConfig      → ["config"]
 *   userStake         → ["user_stake", authority]
 *   protocolStake     → ["protocol_stake", authority]
 *   rentalAgreement   → ["rental", userAuthority, protocolAuthority]
 *   pointRoot         → ["point_root"]
 *   gameConfig        → ["game_config"]
 *   gameTreasury      → ["game_treasury"]
 *   gameRound         → ["game_round", round_id_bytes]
 *   playerDeployment  → ["deployment", round_id_bytes, authority]
 *   roundVault        → ["round_vault", round_id_bytes]
 *
 * NOTE: u64 PDA seeds are represented as 8 little-endian bytes.
 */
export function appendPdaDerivers(codama: Codama): Codama {
  codama.update(
    addPdasVisitor({
      rewardzMvp: [
        // Singleton — no variable seeds.
        {
          name: 'globalConfig',
          seeds: [
            constantPdaSeedNode(stringTypeNode('utf8'), stringValueNode('config')),
          ],
        },

        // Per-user staking account.
        {
          name: 'userStake',
          seeds: [
            constantPdaSeedNode(stringTypeNode('utf8'), stringValueNode('user_stake')),
            variablePdaSeedNode('authority', publicKeyTypeNode()),
          ],
        },

        // Per-protocol staking account.
        {
          name: 'protocolStake',
          seeds: [
            constantPdaSeedNode(stringTypeNode('utf8'), stringValueNode('protocol_stake')),
            variablePdaSeedNode('authority', publicKeyTypeNode()),
          ],
        },

        // Rental agreement between a user and a protocol.
        {
          name: 'rentalAgreement',
          seeds: [
            constantPdaSeedNode(stringTypeNode('utf8'), stringValueNode('rental')),
            variablePdaSeedNode('userAuthority', publicKeyTypeNode()),
            variablePdaSeedNode('protocolAuthority', publicKeyTypeNode()),
          ],
        },

        // Singleton Merkle root account.
        {
          name: 'pointRoot',
          seeds: [
            constantPdaSeedNode(stringTypeNode('utf8'), stringValueNode('point_root')),
          ],
        },

        // Stake vault — single shared token account for all staked tokens.
        {
          name: 'stakeVault',
          seeds: [
            constantPdaSeedNode(stringTypeNode('utf8'), stringValueNode('stake_vault')),
          ],
        },

        // Rental escrow token account funded by the accepting protocol.
        {
          name: 'rentalEscrow',
          seeds: [
            constantPdaSeedNode(stringTypeNode('utf8'), stringValueNode('rental_escrow')),
            variablePdaSeedNode('userAuthority', publicKeyTypeNode()),
            variablePdaSeedNode('protocolAuthority', publicKeyTypeNode()),
          ],
        },

        // Mining game singleton config.
        {
          name: 'gameConfig',
          seeds: [
            constantPdaSeedNode(stringTypeNode('utf8'), stringValueNode('game_config')),
          ],
        },

        // Mining game SOL treasury.
        {
          name: 'gameTreasury',
          seeds: [
            constantPdaSeedNode(stringTypeNode('utf8'), stringValueNode('game_treasury')),
          ],
        },

        // Per-round game state. `roundIdBytes` is u64 little-endian.
        {
          name: 'gameRound',
          seeds: [
            constantPdaSeedNode(stringTypeNode('utf8'), stringValueNode('game_round')),
            variablePdaSeedNode('roundIdBytes', fixedSizeTypeNode(bytesTypeNode(), 8)),
          ],
        },

        // Per-round Token-2022 reward vault. `roundIdBytes` is u64 little-endian.
        {
          name: 'roundVault',
          seeds: [
            constantPdaSeedNode(stringTypeNode('utf8'), stringValueNode('round_vault')),
            variablePdaSeedNode('roundIdBytes', fixedSizeTypeNode(bytesTypeNode(), 8)),
          ],
        },

        // Per-player deployment for a round. `roundIdBytes` is u64 little-endian.
        {
          name: 'playerDeployment',
          seeds: [
            constantPdaSeedNode(stringTypeNode('utf8'), stringValueNode('deployment')),
            variablePdaSeedNode('roundIdBytes', fixedSizeTypeNode(bytesTypeNode(), 8)),
            variablePdaSeedNode('authority', publicKeyTypeNode()),
          ],
        },
      ],
    }),
  );
  return codama;
}
