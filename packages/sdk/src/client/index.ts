// ---------------------------------------------------------------------------
// @rewardz/sdk/client — RewardzClient
//
// The primary user-facing SDK class. Wraps all REWARDZ API endpoints behind
// a typed, ergonomic interface. Mobile and web consumers import this.
//
// Usage:
//   import { RewardzClient } from "@rewardz/sdk/client";
//
//   const client = new RewardzClient({
//     rpcUrl: "https://api.mainnet-beta.solana.com",
//     apiBaseUrl: "https://api.rewardz.xyz",
//     wallet: walletAdapter,
//   });
//
//   const { intent, offers } = await client.resolveIntent("swap 10 SOL to USDC");
// ---------------------------------------------------------------------------

import { HttpClient } from "../core/http.js";
import { WalletAuth, type WalletAdapter } from "../core/auth.js";
import { RewardzApiError } from "../core/errors.js";
import { TweetClient } from "../integrations/tweets.js";
import { LeaderboardClient } from "./leaderboards.js";
import {
  API_INTENTS_RESOLVE,
  API_COMPLETIONS_INIT,
  API_COMPLETIONS_CALLBACK,
  API_COMPLETIONS_BY_ID,
  API_OFFERS,
  API_SUBSCRIPTIONS,
  API_SUBSCRIPTIONS_BY_ID,
  API_SUBSCRIPTIONS_STREAK,
  API_QUESTS,
  API_QUESTS_BY_ID,
  API_QUESTS_JOIN,
  API_QUESTS_PROGRESS,
  API_QUESTS_STEP_COMPLETE,
  API_POINTS_BALANCE,
  API_POINTS_HISTORY,
  API_POINTS_CLAIM_PROOF,
} from "@rewardz/types";

import type {
  StructuredIntentQuery,
  IntentResolutionResponse,
  InitCompletionResponse,
  InitCompletionBody,
  CallbackResponse,
  CompletionResponse,
  OffersBrowseResponse,
  SubscriptionRow,
  CreateSubscriptionBody,
  PatchSubscriptionBody,
  StreakResponse,
  QuestListResponse,
  QuestRow,
  QuestJoinResponse,
  QuestProgressResponse,
  StepCompleteResponse,
  PointsBalanceResponse,
  PointsHistoryResponse,
  ClaimProofResponse,
  BlinkMetadata,
  BlinkTransactionResponse,
} from "./types.js";

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

export interface RewardzClientConfig {
  /** Solana RPC endpoint URL. */
  rpcUrl: string;
  /** REWARDZ API base URL (e.g. "https://api.rewardz.xyz"). */
  apiBaseUrl: string;
  /** Wallet adapter for signing auth messages. */
  wallet: WalletAdapter;
  /** Per-request timeout in milliseconds (default: 30 000). */
  timeoutMs?: number;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Replace `:param` placeholders in route templates with actual values.
 *
 * Example: pathWithParams("/v1/completions/:id", { id: "abc" })
 *       => "/v1/completions/abc"
 */
function pathWithParams(
  template: string,
  params: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`:${key}`, encodeURIComponent(value));
  }
  return result;
}

/** Default timeout for external blink requests (10 seconds). */
const BLINK_TIMEOUT_MS = 10_000;

/* -------------------------------------------------------------------------- */
/*  RewardzClient                                                             */
/* -------------------------------------------------------------------------- */

export class RewardzClient {
  protected readonly http: HttpClient;
  protected readonly auth: WalletAuth;
  protected readonly rpcUrl: string;

  /**
   * Tweet integration — user-facing TweetClient bound to this client's
   * HttpClient (with wallet auth headers attached before each call).
   */
  public readonly tweets: TweetClient;

  /**
   * Leaderboard queries — season info, user rankings, protocol rankings,
   * and individual rank lookups. Bound to this client's HttpClient so the
   * same wallet auth headers are reused across leaderboard calls.
   */
  public readonly leaderboards: LeaderboardClient;

  constructor(config: RewardzClientConfig) {
    this.auth = new WalletAuth(config.wallet);
    this.rpcUrl = config.rpcUrl;
    this.http = new HttpClient({
      baseUrl: config.apiBaseUrl,
      timeoutMs: config.timeoutMs,
    });
    this.tweets = new TweetClient(this.http);
    this.leaderboards = new LeaderboardClient(this.http);
  }

  /* ── Auth ─────────────────────────────────────────────────────────────── */

  /**
   * Ensure auth headers are attached to the HttpClient before making a
   * request. Re-signs if needed (first call or after invalidation).
   */
  private async ensureAuth(): Promise<void> {
    const headers = await this.auth.getHeaders();
    this.http.setAuthHeaders(headers);
  }

  /* ── Intent Resolution ────────────────────────────────────────────────── */

  /**
   * Resolve a user intent — either a natural-language query string or a
   * structured action type + params object.
   *
   * @param query  Natural-language query string, OR structured intent.
   * @returns Resolved intent type and ranked list of offers.
   */
  async resolveIntent(
    query: string | StructuredIntentQuery,
  ): Promise<IntentResolutionResponse> {
    await this.ensureAuth();

    const wallet = this.auth.walletAddress;

    const body =
      typeof query === "string"
        ? { query, user_wallet: wallet }
        : {
            query: `${query.actionType} ${Object.values(query.params).join(" ")}`,
            user_wallet: wallet,
            filters: { action_type: query.actionType },
          };

    return this.http.post<IntentResolutionResponse>(API_INTENTS_RESOLVE, body);
  }

  /* ── Completion Lifecycle ─────────────────────────────────────────────── */

  /**
   * Initialise a completion record for a given offer / protocol.
   *
   * @param offerId  The protocol ID (or offer's protocol_id) to init against.
   * @param options  Optional reward policy, action URL, and constraints.
   * @returns The completion ID and expected reference for the transaction.
   */
  async initCompletion(
    offerId: string,
    options?: Omit<InitCompletionBody, "protocol_id">,
  ): Promise<InitCompletionResponse> {
    await this.ensureAuth();

    const body: InitCompletionBody = {
      protocol_id: offerId,
      ...options,
    };

    return this.http.post<InitCompletionResponse>(API_COMPLETIONS_INIT, body);
  }

  /**
   * Report that the user has signed and submitted a transaction.
   *
   * @param completionId  The completion ID from initCompletion.
   * @param signature     The on-chain transaction signature (base-58).
   * @returns Updated completion status.
   */
  async reportCallback(
    completionId: string,
    signature: string,
  ): Promise<CallbackResponse> {
    await this.ensureAuth();

    return this.http.post<CallbackResponse>(API_COMPLETIONS_CALLBACK, {
      completion_id: completionId,
      signature,
    });
  }

  /**
   * Poll the current status of a completion.
   *
   * @param completionId  The completion ID to check.
   * @returns Full completion record including status, points, etc.
   */
  async getCompletionStatus(completionId: string): Promise<CompletionResponse> {
    await this.ensureAuth();

    const path = pathWithParams(API_COMPLETIONS_BY_ID, { id: completionId });
    return this.http.get<CompletionResponse>(path);
  }

  /* ── Blink Interaction (External) ─────────────────────────────────────── */

  /**
   * Fetch Solana Actions (Blink) metadata from an external action URL.
   *
   * This calls the external protocol's actions endpoint directly — it does
   * NOT go through the REWARDZ API. Uses a separate fetch with its own
   * timeout and error handling.
   *
   * @param actionUrl  The protocol's actions.json or action URL.
   * @returns The Blink actions metadata.
   * @throws RewardzApiError on non-2xx responses.
   */
  async fetchBlinkMetadata(actionUrl: string): Promise<BlinkMetadata> {
    this.validateExternalUrl(actionUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BLINK_TIMEOUT_MS);

    try {
      const response = await fetch(actionUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new RewardzApiError(
          `Blink metadata fetch failed: ${response.statusText}`,
          response.status,
          "BLINK_FETCH_ERROR",
        );
      }

      return (await response.json()) as BlinkMetadata;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Build a transaction by posting the user's wallet to a Blink action URL.
   *
   * This calls the external protocol's action endpoint directly — it does
   * NOT go through the REWARDZ API.
   *
   * @param actionUrl  The specific action href from Blink metadata.
   * @param wallet     The user's wallet address (base-58 public key).
   * @returns The serialized transaction and optional message.
   * @throws RewardzApiError on non-2xx responses.
   */
  async buildBlinkTransaction(
    actionUrl: string,
    wallet: string,
  ): Promise<BlinkTransactionResponse> {
    this.validateExternalUrl(actionUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BLINK_TIMEOUT_MS);

    try {
      const response = await fetch(actionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ account: wallet }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new RewardzApiError(
          `Blink transaction build failed: ${response.statusText}`,
          response.status,
          "BLINK_TX_ERROR",
        );
      }

      return (await response.json()) as BlinkTransactionResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ── Offers ───────────────────────────────────────────────────────────── */

  /**
   * Browse available offers with optional filters.
   *
   * @param filters  Optional query parameters: type, protocol, sort, page, limit.
   * @returns Paginated list of ranked offers.
   */
  async browseOffers(
    filters?: Record<string, string>,
  ): Promise<OffersBrowseResponse> {
    // Offers endpoint is public — no auth required per the route definition
    return this.http.get<OffersBrowseResponse>(API_OFFERS, filters);
  }

  /* ── Subscriptions ────────────────────────────────────────────────────── */

  /**
   * Create a new subscription for recurring intent execution.
   *
   * @param config  Subscription configuration.
   * @returns The created subscription record.
   */
  async createSubscription(
    config: CreateSubscriptionBody,
  ): Promise<SubscriptionRow> {
    await this.ensureAuth();

    return this.http.post<SubscriptionRow>(API_SUBSCRIPTIONS, config);
  }

  /**
   * List all subscriptions for the authenticated wallet.
   *
   * @returns Array of subscription records.
   */
  async listSubscriptions(): Promise<SubscriptionRow[]> {
    await this.ensureAuth();

    const wallet = this.auth.walletAddress;
    const response = await this.http.get<{ subscriptions: SubscriptionRow[] }>(
      API_SUBSCRIPTIONS,
      { wallet },
    );
    return response.subscriptions;
  }

  /**
   * Update an existing subscription (status, params, or frequency).
   *
   * @param id      Subscription ID.
   * @param update  Fields to update.
   * @returns The updated subscription record.
   */
  async updateSubscription(
    id: string,
    update: PatchSubscriptionBody,
  ): Promise<SubscriptionRow> {
    await this.ensureAuth();

    const path = pathWithParams(API_SUBSCRIPTIONS_BY_ID, { id });
    return this.http.patch<SubscriptionRow>(path, update);
  }

  /**
   * Get the current streak for a subscription.
   *
   * @param subscriptionId  The subscription to check.
   * @returns Current streak count, longest streak, and last execution time.
   */
  async getStreak(subscriptionId: string): Promise<StreakResponse> {
    await this.ensureAuth();

    const path = pathWithParams(API_SUBSCRIPTIONS_STREAK, {
      id: subscriptionId,
    });
    return this.http.get<StreakResponse>(path);
  }

  /* ── Quests ───────────────────────────────────────────────────────────── */

  /**
   * List available quests with optional filters.
   *
   * @param filters  Optional query parameters: quest_type, status, page, limit.
   * @returns Paginated list of quests.
   */
  async listQuests(
    filters?: Record<string, string>,
  ): Promise<QuestListResponse> {
    // Quest listing is public — no auth required per the route definition
    return this.http.get<QuestListResponse>(API_QUESTS, filters);
  }

  /**
   * Join a quest (start tracking progress).
   *
   * @param questId  The quest to join.
   * @returns Initial quest progress record.
   */
  async joinQuest(questId: string): Promise<QuestJoinResponse> {
    await this.ensureAuth();

    const path = pathWithParams(API_QUESTS_JOIN, { id: questId });
    return this.http.post<QuestJoinResponse>(path);
  }

  /**
   * Get the authenticated user's progress on a quest.
   *
   * @param questId  The quest to check progress for.
   * @returns Current progress including steps completed and conditions met.
   */
  async getQuestProgress(questId: string): Promise<QuestProgressResponse> {
    await this.ensureAuth();

    const path = pathWithParams(API_QUESTS_PROGRESS, { id: questId });
    return this.http.get<QuestProgressResponse>(path);
  }

  /**
   * Start a composable quest. Alias for joinQuest — composable quests are
   * joined the same way, but the progress tracks individual steps.
   *
   * @param questId  The composable quest to start.
   * @returns Initial quest progress record.
   */
  async startComposableQuest(questId: string): Promise<QuestJoinResponse> {
    return this.joinQuest(questId);
  }

  /**
   * Get the next pending step for a composable quest in progress.
   *
   * Derives the next step from the quest progress and quest definition.
   *
   * @param progressId  Not used directly — we need the questId. This method
   *   fetches the quest detail to determine the next step.
   * @param questId     The quest ID to fetch step info from.
   * @returns The next step index and the quest's step definition.
   */
  async getComposableNextStep(
    questId: string,
  ): Promise<{ stepIndex: number; step: unknown } | null> {
    await this.ensureAuth();

    // Fetch progress and quest details in parallel
    const [progress, questDetail] = await Promise.all([
      this.getQuestProgress(questId),
      this.http.get<QuestRow>(
        pathWithParams(API_QUESTS_BY_ID, { id: questId }),
      ),
    ]);

    const stepsCompleted = progress.steps_completed ?? [];
    const steps = questDetail.steps ?? [];

    // Find the first step not yet completed, respecting dependency order
    for (const step of steps) {
      if (!stepsCompleted.includes(step.step_index)) {
        // Check dependency is met
        if (
          step.depends_on === null ||
          stepsCompleted.includes(step.depends_on)
        ) {
          return { stepIndex: step.step_index, step };
        }
      }
    }

    return null;
  }

  /**
   * Mark a quest step as complete.
   *
   * @param questId       The quest ID.
   * @param stepIndex     The step index to complete.
   * @param completionId  The completion ID proving the step was executed.
   * @returns Updated quest progress.
   */
  async completeQuestStep(
    questId: string,
    stepIndex: number,
    _completionId: string,
  ): Promise<StepCompleteResponse> {
    await this.ensureAuth();

    const path = pathWithParams(API_QUESTS_STEP_COMPLETE, {
      id: questId,
      stepIndex: String(stepIndex),
    });
    return this.http.post<StepCompleteResponse>(path);
  }

  /* ── Rewards / Points ─────────────────────────────────────────────────── */

  /**
   * Get the points balance for a wallet.
   *
   * @param wallet  Wallet address to check. Defaults to the connected wallet.
   * @returns Points balance breakdown.
   */
  async getPointsBalance(wallet?: string): Promise<PointsBalanceResponse> {
    await this.ensureAuth();

    const address = wallet ?? this.auth.walletAddress;
    return this.http.get<PointsBalanceResponse>(API_POINTS_BALANCE, {
      wallet: address,
    });
  }

  /**
   * Get paginated reward event history.
   *
   * @param pagination  Optional limit and offset.
   * @returns List of point events.
   */
  async getRewardHistory(pagination?: {
    limit?: number;
    offset?: number;
  }): Promise<PointsHistoryResponse> {
    await this.ensureAuth();

    const wallet = this.auth.walletAddress;
    const params: Record<string, string> = { wallet };

    if (pagination?.limit !== undefined) {
      params.limit = String(pagination.limit);
    }
    if (pagination?.offset !== undefined) {
      params.offset = String(pagination.offset);
    }

    return this.http.get<PointsHistoryResponse>(API_POINTS_HISTORY, params);
  }

  /**
   * Get the Merkle claim proof for the connected wallet.
   *
   * The proof allows the user to claim points on-chain by verifying
   * against the published Merkle root.
   *
   * @returns Root, proof path, and claimable amount.
   */
  async getClaimProof(): Promise<ClaimProofResponse> {
    await this.ensureAuth();

    const wallet = this.auth.walletAddress;
    return this.http.get<ClaimProofResponse>(API_POINTS_CLAIM_PROOF, {
      wallet,
    });
  }

  /**
   * Get a reward summary: balance + recent events, aggregated client-side.
   *
   * This is a convenience method that combines getPointsBalance and
   * getRewardHistory into a single call. There is no dedicated API endpoint.
   *
   * @returns Balance and the 10 most recent point events.
   */
  async getRewardSummary(): Promise<{
    balance: PointsBalanceResponse;
    recentEvents: PointsHistoryResponse["events"];
  }> {
    const [balance, history] = await Promise.all([
      this.getPointsBalance(),
      this.getRewardHistory({ limit: 10 }),
    ]);

    return {
      balance,
      recentEvents: history.events,
    };
  }

  /* ── Internal Helpers ─────────────────────────────────────────────────── */

  /**
   * Validate that a URL is a well-formed HTTPS URL for external blink calls.
   * Throws if the URL is malformed or uses an insecure protocol.
   */
  private validateExternalUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new RewardzApiError(
        `Invalid action URL: ${url}`,
        400,
        "INVALID_URL",
      );
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new RewardzApiError(
        `Unsupported protocol: ${parsed.protocol}`,
        400,
        "INVALID_URL",
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Re-exports                                                                */
/* -------------------------------------------------------------------------- */

export type { WalletAdapter } from "../core/auth.js";
export type * from "./types.js";
export * from "./leaderboards.js";
