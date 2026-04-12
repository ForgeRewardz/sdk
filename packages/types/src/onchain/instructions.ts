// ---------------------------------------------------------------------------
// @rewardz/types — On-chain Instruction Discriminators & Arg Types
//
// All game-enabled instructions from the rewardz-mvp IDL.
// ---------------------------------------------------------------------------

// ── Instruction discriminator constants ────────────────────────────────────

export const IX_INITIALIZE_CONFIG = 0 as const;
export const IX_SET_ADMIN = 1 as const;
export const IX_SET_OPS_AUTHORITY = 2 as const;
export const IX_SET_MINT_DIFFICULTY = 3 as const;
export const IX_SET_MIN_STAKES = 4 as const;
export const IX_USER_STAKE = 5 as const;
export const IX_USER_ADD_STAKE = 6 as const;
export const IX_USER_UNSTAKE = 7 as const;
export const IX_PROTOCOL_STAKE = 8 as const;
export const IX_PROTOCOL_ADD_STAKE = 9 as const;
export const IX_PROTOCOL_UNSTAKE = 10 as const;
export const IX_CREATE_RENTAL = 11 as const;
export const IX_ACCEPT_RENTAL = 12 as const;
export const IX_SETTLE_RENTAL = 13 as const;
export const IX_CLOSE_RENTAL = 14 as const;
export const IX_SET_POINT_ROOT = 15 as const;
export const IX_SYNC_POINTS = 16 as const;
export const IX_START_ROUND = 19 as const;
export const IX_DEPLOY_TO_ROUND = 20 as const;
export const IX_SETTLE_ROUND = 21 as const;
export const IX_CLAIM_ROUND_REWARD = 22 as const;
export const IX_SET_GAME_CONFIG = 23 as const;
export const IX_INITIALIZE_GAME = 24 as const;

// ── Instruction arg interfaces ─────────────────────────────────────────────

export interface InitializeConfigArgs {
  minUserStake: bigint;
  minProtocolStake: bigint;
  rentalFeeBps: number;
  mintDifficulty: bigint;
  mintCostPoints: bigint;
}

export interface SetAdminArgs {
  newAdmin: string;
}

export interface SetOpsAuthorityArgs {
  newOpsAuthority: string;
}

export interface SetMintDifficultyArgs {
  newDifficulty: bigint;
}

export interface SetMinStakesArgs {
  minUserStake: bigint;
  minProtocolStake: bigint;
}

export interface UserStakeArgs {
  amount: bigint;
}

export interface UserAddStakeArgs {
  amount: bigint;
}

export interface UserUnstakeArgs {
  amount: bigint;
}

export interface ProtocolStakeArgs {
  amount: bigint;
  trustScore: number;
}

export interface ProtocolAddStakeArgs {
  amount: bigint;
}

export interface ProtocolUnstakeArgs {
  amount: bigint;
}

export interface CreateRentalArgs {
  amount: bigint;
  rewardRatePerEpoch: bigint;
}

// AcceptRental — no args
// SettleRental — no args
// CloseRental — no args

export interface SetPointRootArgs {
  root: Uint8Array;
  epoch: bigint;
  totalIssued: bigint;
}

export interface SyncPointsMerkleData {
  numProofs: number;
  proofHashes: Uint8Array[];
}

export interface SyncPointsReceiptData {
  nonce: bigint;
  expiry: bigint;
}

export interface SyncPointsArgs {
  mode: number;
  pointsAmount: bigint;
  merkleData?: SyncPointsMerkleData;
  receiptData?: SyncPointsReceiptData;
}

// StartRound — no args

export interface DeployToRoundArgs {
  points: bigint;
}

// SettleRound — no args
// ClaimRoundReward — no args

export interface SetGameConfigArgs {
  gameFeeLamports: bigint;
  hitRateBps: number;
  tokensPerRound: bigint;
  hitPoolBps: number;
  motherlodeMinThreshold: bigint;
  motherlodeProbabilityBps: number;
  roundSlots: bigint;
  intermissionSlots: bigint;
}

// InitializeGame — no args
