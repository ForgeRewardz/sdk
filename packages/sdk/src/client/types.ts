// ---------------------------------------------------------------------------
// @rewardz/sdk/client — Client-specific types
//
// Types used by RewardzClient that aren't in @rewardz/types. These cover
// API request/response shapes specific to the client layer.
// ---------------------------------------------------------------------------

/** Structured intent query for resolveIntent */
export interface StructuredIntentQuery {
  actionType: string;
  params: Record<string, string>;
}

/** Response from the intent resolution endpoint */
export interface IntentResolutionResponse {
  intent: string;
  resolver_type: string;
  resolver_confidence: number;
  offers: IntentOfferRow[];
  composable_suggestions: unknown[];
}

/** Offer row as returned by the API (snake_case) */
export interface IntentOfferRow {
  protocol_id: string;
  action_type: string;
  points: number;
  trust_score: number;
  placement_score: number;
  rank: number;
}

/** Response from POST /completions/init */
export interface InitCompletionResponse {
  completion_id: string;
  expected_reference: string;
  expires_at: string;
  action_url?: string;
  action_type?: string;
  estimated_amount?: string;
}

/** Response from POST /completions/callback */
export interface CallbackResponse {
  completion_id: string;
  status: string;
}

/** Response from GET /completions/:id */
export interface CompletionResponse {
  id: string;
  user_wallet: string;
  protocol_id: string;
  reward_policy_id: string | null;
  expected_action_url: string | null;
  expected_constraints: object | null;
  expected_reference: string;
  signature: string | null;
  status: string;
  rejection_reason: string | null;
  points_awarded: number | null;
  verified_at: string | null;
  expires_at: string;
  created_at: string;
}

/** Init completion request body */
export interface InitCompletionBody {
  protocol_id: string;
  reward_policy_id?: string;
  expected_action_url?: string;
  expected_constraints?: object;
}

/** Subscription as returned by the list endpoint */
export interface SubscriptionRow {
  subscription_id: string;
  wallet_address: string;
  quest_id: string | null;
  action_type: string;
  intent_query: string | null;
  params: object;
  frequency: string;
  preferred_day: number | null;
  preferred_hour: number | null;
  auto_execute: boolean;
  next_due_at: string;
  streak_current: number;
  streak_longest: number;
  last_executed_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/** Create subscription request body */
export interface CreateSubscriptionBody {
  quest_id?: string;
  action_type: string;
  intent_query?: string;
  params: object;
  frequency: "daily" | "weekly" | "monthly";
  preferred_day?: number;
  preferred_hour?: number;
  auto_execute?: boolean;
}

/** Patch subscription request body */
export interface PatchSubscriptionBody {
  status?: string;
  params?: object;
  frequency?: "daily" | "weekly" | "monthly";
}

/** Quest list response */
export interface QuestListResponse {
  quests: QuestRow[];
  pagination: PaginationMeta;
}

/** Quest row as returned by API */
export interface QuestRow {
  quest_id: string;
  created_by: string | null;
  protocol_name: string | null;
  name: string;
  description: string | null;
  quest_type: string;
  reward_points: number;
  max_participants: number | null;
  start_at: string;
  end_at: string;
  status: string;
  created_at: string;
  steps?: QuestStepRow[];
}

/** Quest step row */
export interface QuestStepRow {
  step_index: number;
  intent_type: string;
  protocol_id: string;
  params: object;
  points: number;
  depends_on: number | null;
}

/** Quest join response */
export interface QuestJoinResponse {
  progress_id: string;
  quest_id: string;
  user_wallet: string;
  completed: boolean;
  steps_completed: number[];
  started_at: string;
}

/** Quest progress response */
export interface QuestProgressResponse {
  quest_progress_id: string;
  quest_id: string;
  user_wallet: string;
  conditions_met: object | null;
  steps_completed: number[];
  bonus_awarded: boolean;
  completed: boolean;
  completed_at: string | null;
  started_at: string;
}

/** Step completion response */
export interface StepCompleteResponse {
  quest_id: string;
  step_completed: number;
  steps_completed: number[];
  quest_completed: boolean;
}

/** Offers browse response */
export interface OffersBrowseResponse {
  offers: OfferRow[];
  pagination: PaginationMeta;
}

/** Offer row from browse endpoint */
export interface OfferRow {
  campaign_id: string;
  protocol_id: string;
  protocol_name: string;
  action_type: string;
  name: string;
  description: string | null;
  points_per_completion: number;
  trust_score: number;
  start_at: string;
  end_at: string | null;
  placement_score?: number;
  rank?: number;
}

/** Pagination metadata */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

/** Points balance response (serialized) */
export interface PointsBalanceResponse {
  wallet_address: string;
  total_earned: string;
  total_pending: string;
  total_spent: string;
  total_reserved: string;
  usable_balance: string;
  updated_at: string | null;
}

/** Points history response */
export interface PointsHistoryResponse {
  events: PointEventRow[];
}

/** Point event row as returned by API (amount serialized to string) */
export interface PointEventRow {
  id: string;
  user_wallet: string;
  protocol_id: string | null;
  type: string;
  amount: string;
  completion_id: string | null;
  source_signature: string | null;
  source_reference: string | null;
  reason: string | null;
  created_at: string;
}

/** Merkle claim proof response */
export interface ClaimProofResponse {
  root: string;
  proof: string[];
  amount: string;
}

/** Streak response from subscription streak endpoint */
export interface StreakResponse {
  streak_current: number;
  streak_longest: number;
  last_executed_at: string | null;
}

/** Blink metadata (Actions spec) — intentionally loose, external API */
export interface BlinkMetadata {
  icon: string;
  title: string;
  description: string;
  label?: string;
  links?: {
    actions: Array<{
      label: string;
      href: string;
      parameters?: Array<{
        name: string;
        label?: string;
        required?: boolean;
      }>;
    }>;
  };
  [key: string]: unknown;
}

/** Blink transaction response — intentionally loose, external API */
export interface BlinkTransactionResponse {
  transaction: string;
  message?: string;
  [key: string]: unknown;
}
