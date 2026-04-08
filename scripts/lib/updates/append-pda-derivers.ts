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
 *   mintAttempt       → ["mint_attempt", authority, nonce_bytes]
 *
 * NOTE: mintAttempt nonce seed is a u64 serialised as 8 little-endian bytes.
 * Callers must pre-serialise the nonce before passing to findProgramAddress.
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

        // Per-attempt burn-to-mint record.
        //
        // ⚠️  FOOTGUN — nonce seed serialisation:
        //
        //   The `nonceBytes` seed is the u64 nonce encoded as 8 little-endian
        //   bytes.  Codama types this as `fixedSizeTypeNode(bytesTypeNode(), 8)`
        //   so the generated `findMintAttemptPda` expects a `Uint8Array` of
        //   exactly 8 bytes — NOT a plain `bigint`.
        //
        //   You MUST serialise before calling:
        //
        //     import { getU64Encoder } from '@solana/kit';
        //     const nonceBytes = getU64Encoder().encode(nonce);   // Uint8Array(8)
        //     const [pda] = await findMintAttemptPda({ authority, nonceBytes });
        //
        //   Passing a raw number/bigint will cause `getProgramDerivedAddress`
        //   to throw (wrong type) or silently use a different address.
        {
          name: 'mintAttempt',
          seeds: [
            constantPdaSeedNode(stringTypeNode('utf8'), stringValueNode('mint_attempt')),
            variablePdaSeedNode('authority', publicKeyTypeNode()),
            variablePdaSeedNode('nonceBytes', fixedSizeTypeNode(bytesTypeNode(), 8)),
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
      ],
    }),
  );
  return codama;
}
