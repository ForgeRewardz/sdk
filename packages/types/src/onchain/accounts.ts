// ---------------------------------------------------------------------------
// @rewardz/types — On-chain Account Interfaces
//
// TypeScript representations of the 6 on-chain accounts defined in the
// rewardz-mvp IDL. Field names match the IDL exactly.
//
// Type mapping:
//   publicKey  -> string (base58)
//   u64 / i64  -> bigint
//   u128       -> bigint
//   u16        -> number
//   u8         -> number
//   bool       -> boolean
//   [u8; 32]   -> Uint8Array
// ---------------------------------------------------------------------------

/**
 * GlobalConfig — singleton program config PDA.
 * Seeds: ["config"]
 * Discriminator: 1, Size: 162 bytes
 */
export interface GlobalConfig {
  admin: string;
  opsAuthority: string;
  rewardMint: string;
  minUserStake: bigint;
  minProtocolStake: bigint;
  mintDifficulty: bigint;
  mintCostPoints: bigint;
  totalUserStaked: bigint;
  totalProtocolStaked: bigint;
  totalMinted: bigint;
  rentalFeeBps: number;
  bump: number;
}

/**
 * UserStake — per-user staking account.
 * Seeds: ["user_stake", authority]
 * Discriminator: 2, Size: 106 bytes
 */
export interface UserStake {
  authority: string;
  stakedAmount: bigint;
  availableForRental: bigint;
  totalRentedOut: bigint;
  totalRentalEarned: bigint;
  pointsBalance: bigint;
  stakedAt: bigint;
  lastActionAt: bigint;
  bump: number;
  pointsTotalSynced: bigint;
}

/**
 * ProtocolStake — per-protocol staking account.
 * Seeds: ["protocol_stake", authority]
 * Discriminator: 3, Size: 90 bytes
 */
export interface ProtocolStake {
  authority: string;
  directStake: bigint;
  rentedStake: bigint;
  issuancePower: bigint;
  stakedAt: bigint;
  totalPointsIssued: bigint;
  trustScore: number;
  status: number;
  bump: number;
}

/**
 * RentalAgreement — rental between a user and a protocol.
 * Seeds: ["rental", user_authority, protocol_authority]
 * Discriminator: 4, Size: 146 bytes
 */
export interface RentalAgreement {
  userAuthority: string;
  protocolAuthority: string;
  rewardTokenMint: string;
  rentedAmount: bigint;
  rewardRatePerEpoch: bigint;
  totalEarned: bigint;
  lastSettledAt: bigint;
  createdAt: bigint;
  status: number;
  bump: number;
}

/**
 * PointRoot — singleton Merkle root for off-chain points.
 * Seeds: ["point_root"]
 * Discriminator: 5, Size: 106 bytes
 */
export interface PointRoot {
  authority: string;
  root: Uint8Array;
  epoch: bigint;
  updatedAt: bigint;
  totalIssued: bigint;
  bump: number;
}

/**
 * MintAttempt — record of a single burn-to-mint attempt.
 * Seeds: ["mint_attempt", authority, nonce_le_bytes]
 * Discriminator: 6, Size: 106 bytes
 */
export interface MintAttempt {
  authority: string;
  hash: Uint8Array;
  pointsBurned: bigint;
  nonce: bigint;
  mintAmount: bigint;
  createdAt: bigint;
  success: boolean;
  claimed: boolean;
  bump: number;
}
