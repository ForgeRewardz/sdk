// ---------------------------------------------------------------------------
// @rewardz/types — API Enums
// ---------------------------------------------------------------------------

/** Supported intent actions for the protocol */
export type IntentAction =
  | "swap"
  | "stake"
  | "lend"
  | "borrow"
  | "transfer"
  | "vote"
  | "mint"
  | "burn"
  | "tweet"
  | "custom";

/** Completion status for protocol completions */
export enum CompletionStatus {
  AwaitingSignature = "awaiting_signature",
  Submitted = "submitted",
  Verified = "verified",
  Rejected = "rejected",
  Expired = "expired",
}

/** Types of point events */
export enum PointEventType {
  Awarded = "awarded",
  Bonus = "bonus",
  Penalty = "penalty",
  Refund = "refund",
  Transfer = "transfer",
  Reservation = "reservation",
  Release = "release",
}

/** Protocol status */
export enum ProtocolStatus {
  Pending = "pending",
  Active = "active",
  Suspended = "suspended",
  Revoked = "revoked",
}

/** Campaign status */
export enum CampaignStatus {
  Active = "active",
  Paused = "paused",
  Completed = "completed",
  Cancelled = "cancelled",
}

/** Quest types */
export enum QuestType {
  Single = "single",
  Composable = "composable",
  Recurring = "recurring",
}

/** Subscription frequency */
export enum SubscriptionFrequency {
  Daily = "daily",
  Weekly = "weekly",
  Monthly = "monthly",
}

/** Delegation trigger types */
export enum DelegationTriggerType {
  Schedule = "schedule",
  PriceThreshold = "price_threshold",
  Event = "event",
}

/** Tweet submission status */
export enum TweetSubmissionStatus {
  Pending = "pending",
  Approved = "approved",
  Rejected = "rejected",
}

/** Leaderboard snapshot type */
export enum LeaderboardSnapshotType {
  User = "user",
  Protocol = "protocol",
}

/** Marketing spend type */
export enum MarketingSpendType {
  Points = "points",
  Tokens = "tokens",
  SOL = "sol",
}
