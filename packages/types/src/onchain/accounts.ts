// ---------------------------------------------------------------------------
// @rewardz/types — On-chain Account Interfaces
//
// TypeScript representations of the 8 on-chain accounts defined in the
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
 * GameConfig — singleton mining-game config PDA.
 * Seeds: ["game_config"]
 * Discriminator: 7, Size: 193 bytes
 */
export interface GameConfig {
  admin: string;
  rewardMint: string;
  treasury: string;
  gameFeeLamports: bigint;
  tokensPerRound: bigint;
  motherlodePool: bigint;
  motherlodeMinThreshold: bigint;
  currentRoundId: bigint;
  roundSlots: bigint;
  intermissionSlots: bigint;
  hitRateBps: number;
  hitPoolBps: number;
  motherlodeProbabilityBps: number;
  bump: number;
  reserved: Uint8Array;
}

/**
 * GameRound — on-chain settlement record for one mining-game round.
 * Seeds: ["game_round", round_id_le_bytes]
 * Discriminator: 8, Size: 168 bytes
 */
export interface GameRound {
  roundId: bigint;
  startSlot: bigint;
  endSlot: bigint;
  playerCount: number;
  totalPointsDeployed: bigint;
  totalFeeCollected: bigint;
  settled: boolean;
  settleSlotHash: Uint8Array;
  hitCount: number;
  totalHitPoints: bigint;
  tokensMinted: bigint;
  motherlodeTriggered: boolean;
  motherlodeAmount: bigint;
  rentPayer: string;
  bump: number;
  reserved: Uint8Array;
}

/**
 * PlayerDeployment — record of a user's deployment into a game round.
 * Seeds: ["deployment", round_id_le_bytes, authority]
 * Discriminator: 9, Size: 93 bytes
 */
export interface PlayerDeployment {
  authority: string;
  roundId: bigint;
  pointsDeployed: bigint;
  feePaid: bigint;
  deployedAt: bigint;
  isHit: boolean;
  rewardAmount: bigint;
  motherlodeShare: bigint;
  claimed: boolean;
  settled: boolean;
  bump: number;
  reserved: Uint8Array;
}
