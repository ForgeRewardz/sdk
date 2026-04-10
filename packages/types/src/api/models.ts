// ---------------------------------------------------------------------------
// @rewardz/types — API Models
// ---------------------------------------------------------------------------

import type {
  IntentAction,
  CompletionStatus,
  PointEventType,
  ProtocolStatus,
  CampaignStatus,
  QuestType,
  SubscriptionFrequency,
  DelegationTriggerType,
  TweetSubmissionStatus,
  LeaderboardSnapshotType,
  MarketingSpendType,
} from "./enums.js";

// ---------------------------------------------------------------------------
// Ported from api/src/types/index.ts
// ---------------------------------------------------------------------------

/** Base user record */
export interface User {
  wallet_address: string;
  total_points: bigint;
  synced_points: bigint;
  updated_at: Date;
}

/** User balance record */
export interface UserBalance {
  wallet_address: string;
  total_earned: bigint;
  total_pending: bigint;
  total_spent: bigint;
  total_reserved: bigint;
  usable_balance: bigint;
  updated_at: Date;
}

/** Protocol record */
export interface Protocol {
  id: string;
  admin_wallet: string;
  name: string;
  description: string | null;
  blink_base_url: string | null;
  supported_actions: string[];
  trust_score: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

/** Campaign record */
export interface Campaign {
  campaign_id: string;
  protocol_id: string;
  name: string;
  description: string | null;
  action_type: string;
  points_per_completion: number;
  max_per_user_per_day: number;
  budget_total: bigint | null;
  budget_spent: bigint;
  status: string;
  start_at: Date;
  end_at: Date | null;
  created_at: Date;
}

/** Point event record */
export interface PointEvent {
  id: string;
  user_wallet: string;
  protocol_id: string | null;
  type: PointEventType;
  amount: bigint;
  completion_id: string | null;
  source_signature: string | null;
  source_reference: string | null;
  reason: string | null;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// From sdk-design.md
// ---------------------------------------------------------------------------

/** Intent — a user's desired action */
export interface Intent {
  intentId: string;
  wallet: string;
  actionType: IntentAction;
  params: Record<string, string>;
  resolverType: "ai" | "rules" | "hybrid";
  resolverConfidence?: number;
  source: "manual" | "subscription" | "composable" | "quest";
  subscriptionId?: string;
  questId?: string;
}

/** Protocol manifest describing supported intents */
export interface ProtocolManifest {
  protocolId: string;
  name: string;
  domain: string;
  actionsJsonUrl: string;
  intents: IntentSupport[];
  status: "active" | "paused" | "onboarding";
}

/** How a protocol supports a specific intent type */
export interface IntentSupport {
  intentType: IntentAction;
  actionUrlTemplate: string;
  verificationAdapter: string;
  rewardPolicyId: string;
}

/** Reward policy governing point issuance */
export interface RewardPolicy {
  policyId: string;
  protocolId: string;
  intentType: IntentAction;
  basePoints: number;
  multiplierRules: MultiplierRule[];
  eligibility: EligibilityRules;
  budget: { maxAwards: number; awardedCount: number };
  period: { startAt: Date; endAt: Date };
}

/** A multiplier rule for reward computation */
export interface MultiplierRule {
  type: "streak" | "tier" | "volume" | "referral";
  thresholds: { min: number; multiplier: number }[];
}

/** Eligibility constraints for reward policies */
export interface EligibilityRules {
  minAmountUsd?: number;
  maxAmountUsd?: number;
  frequencyLimit?: { count: number; windowSeconds: number };
  newUserOnly?: boolean;
}

/** Subscription — recurring intent execution */
export interface Subscription {
  subscriptionId: string;
  wallet: string;
  intent: Omit<Intent, "intentId" | "source" | "subscriptionId">;
  schedule: CronSchedule;
  status: "active" | "paused" | "cancelled" | "expired";
  streak: {
    current: number;
    longest: number;
    lastExecutedAt: Date;
  };
  createdAt: Date;
}

/** Cron schedule for subscriptions */
export interface CronSchedule {
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  preferredHour?: number;
  preferredDay?: number;
}

/** Quest — a time-bound challenge or composable multi-step chain */
export interface Quest {
  questId: string;
  name: string;
  description: string;
  questType:
    | "hold"
    | "engagement"
    | "newcomer"
    | "composable"
    | "streak"
    | "subscription";
  conditions: QuestCondition[];
  rewardPoints: number;
  bonusMultiplier?: number;
  startAt: Date;
  endAt: Date;
  maxParticipants?: number;
  status: "active" | "completed" | "expired";
  steps?: QuestStep[];
  bonusPoints?: number;
  compositionMode?: "open" | "invite_only" | "closed";
  createdBy?: string;
  collaborators?: QuestCollaborator[];
}

/** A single step in a composable quest */
export interface QuestStep {
  stepId: string;
  questId: string;
  stepIndex: number;
  intentType: IntentAction;
  protocolId: string;
  params: Record<string, string>;
  rewardPolicyId: string;
  points: number;
  dependsOn: number | null;
}

/** A collaborating protocol in a composable quest */
export interface QuestCollaborator {
  collaboratorId: string;
  questId: string;
  protocolId: string;
  stepIndex: number;
  role: "creator" | "step_provider" | "sponsor";
  rewardPolicyId: string;
  points: number;
  status: "invited" | "active" | "declined" | "removed";
  invitedBy: string;
  joinedAt?: Date;
}

/** A condition for quest eligibility or completion */
export interface QuestCondition {
  type:
    | "unique_protocol_count"
    | "min_balance_hold"
    | "composable_completion"
    | "subscription_streak"
    | "action_count";
  target: number;
  windowDays?: number;
  protocolId?: string;
  questId?: string;
}

/** Progress tracking for a user's quest participation */
export interface QuestProgress {
  questProgressId: string;
  questId: string;
  wallet: string;
  conditionsMet: {
    type: string;
    current: number;
    target: number;
  }[];
  stepsCompleted?: number[];
  stepsPending?: number[];
  bonusAwarded?: boolean;
  completed: boolean;
  completedAt?: Date;
  startedAt: Date;
}

/** Completion record linking intent execution to reward */
export interface Completion {
  completionId: string;
  offerId: string;
  intentId: string;
  wallet: string;
  protocolId: string;
  policyId: string;
  expectedReference: string;
  status: CompletionStatus;
  award?: PointEvent;
  createdAt: Date;
}

/** A ranked offer returned by intent resolution */
export interface IntentOffer {
  offerId: string;
  protocolId: string;
  protocolName: string;
  actionUrl: string;
  intentType: IntentAction;
  estimatedReward: number;
  score: number;
  rewardPolicyId: string;
}

// ---------------------------------------------------------------------------
// New types (not yet in API)
// ---------------------------------------------------------------------------

/**
 * Season — a time-bounded leaderboard period.
 *
 * Timestamps are serialised as ISO-8601 strings over the wire (JSON can't
 * carry native `Date`). Callers may coerce to `Date` in-memory if they need
 * arithmetic or formatting.
 */
export interface Season {
  seasonId: string;
  name: string;
  description: string | null;
  /** ISO-8601 timestamp string (wire format). */
  startAt: string;
  /** ISO-8601 timestamp string, or `null` for an open-ended season. */
  endAt: string | null;
  status: "upcoming" | "active" | "completed";
  /** True once the admin snapshot has been taken for this season. */
  snapshotTaken: boolean;
}

/**
 * Per-channel points breakdown — shared between {@link UserRank} and
 * {@link ProtocolRank}.
 *
 * All values are **`string`** over the wire because JSON cannot serialise
 * `bigint`. Consumers that need arithmetic should coerce with `BigInt(value)`
 * in-memory.
 *
 * NOTE: The underlying point-event `channel` enum has five members —
 * `'api' | 'webhook' | 'blink' | 'completion' | 'tweet'` — but the
 * user-facing leaderboard breakdown only surfaces four. `completion` is
 * rolled up into `blink` at the surface because completion events are the
 * on-chain acknowledgement of a preceding blink interaction, so splitting
 * them would double-count. If you need the raw five-way split, query the
 * `point_events` table directly.
 */
export interface PointsBreakdown {
  /** Points earned via tweet submissions (bigint as string). */
  tweet: string;
  /** Points awarded via direct API award/batch calls (bigint as string). */
  api: string;
  /** Points awarded via webhook integrations, e.g. Zealy (bigint as string). */
  webhook: string;
  /** Points awarded via blink interactions — includes rolled-up `completion` channel (bigint as string). */
  blink: string;
}

/**
 * User rank within a season (TODO-0016 §16C shape).
 *
 * `totalPoints` is a **`string`** on the wire because JSON cannot serialise
 * `bigint`. Coerce with `BigInt(entry.totalPoints)` if arithmetic is needed.
 * See Klaus R7.
 */
export interface UserRank {
  wallet: string;
  rank: number;
  /** Total points across all channels (bigint as string). */
  totalPoints: string;
  breakdown: PointsBreakdown;
  seasonId: string;
}

/**
 * Protocol rank within a season (TODO-0016 §16C shape).
 *
 * `totalPointsIssued` is a **`string`** on the wire (same bigint→string
 * rationale as {@link UserRank.totalPoints}).
 */
export interface ProtocolRank {
  protocolId: string;
  protocolName: string;
  protocolLogo: string | null;
  rank: number;
  /** Total points issued by this protocol across all channels (bigint as string). */
  totalPointsIssued: string;
  breakdown: PointsBreakdown;
  uniqueUsersRewarded: number;
  seasonId: string;
}

/**
 * Paginated user rankings response (TODO-0016 spec).
 *
 * `entries + total + seasonId` — no page/limit in the body; pagination is
 * controlled by request query params and the server returns the requested
 * window in `entries`, with `total` as the full count for the season.
 */
export interface UserRankingsResponse {
  entries: UserRank[];
  total: number;
  seasonId: string;
}

/**
 * Paginated protocol rankings response (TODO-0016 spec).
 *
 * Same shape contract as {@link UserRankingsResponse} — see that type for
 * pagination semantics.
 */
export interface ProtocolRankingsResponse {
  entries: ProtocolRank[];
  total: number;
  seasonId: string;
}

/** Tweet submission record */
export interface TweetSubmission {
  submissionId: string;
  tweetUrl: string;
  wallet: string;
  protocolId: string | null;
  status: TweetSubmissionStatus;
  points: number | null;
  createdAt: Date;
}

/** Rule for verifying tweet eligibility */
export interface TweetVerificationRule {
  ruleId: string;
  protocolId: string;
  hashtags: string[];
  mentions: string[];
  cashtags: string[];
  basePoints: number;
  bonusPerLike: number;
  allRequired: boolean;
}

/** Result of a points award operation */
export interface AwardResult {
  eventId: string;
  wallet: string;
  amount: bigint;
  reason: string;
  createdAt: Date;
}

/** Zealy integration config */
export interface ZealyIntegration {
  integrationId: string;
  protocolId: string;
  spaceId: string;
  webhookUrl: string;
  questMappings: Record<string, string>;
  status: "active" | "paused" | "disconnected";
}

/** Audit log entry for delegation actions */
export interface AuditLogEntry {
  entryId: string;
  delegationId: string;
  action: string;
  timestamp: Date;
  details: Record<string, unknown>;
}

/** Pagination options for list queries */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Agent delegation types
// ---------------------------------------------------------------------------

/** Agent delegation — user grants an agent permission to act */
export interface AgentDelegation {
  delegationId: string;
  wallet: string;
  agentId: string;
  permissions: Record<string, boolean>;
  triggers: AgentTrigger[];
  status: "active" | "paused" | "revoked";
  createdAt: Date;
  updatedAt: Date;
}

/** A trigger condition for an agent delegation */
export interface AgentTrigger {
  triggerId: string;
  type: DelegationTriggerType;
  config: Record<string, unknown>;
  enabled: boolean;
}

/** Configuration for setting up an agent delegation */
export interface DelegationConfig {
  agentId: string;
  permissions: Record<string, boolean>;
  maxSpendPerAction: number;
  dailyLimit: number;
  allowedActions: IntentAction[];
  expiresAt: Date;
}
