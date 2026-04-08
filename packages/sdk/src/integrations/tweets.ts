// ---------------------------------------------------------------------------
// @rewardz/sdk/integrations — Tweet Integration
//
// Two classes:
//  - TweetClient  (user-facing, WalletAuth) — submit tweets, check status
//  - TweetConfig  (protocol-facing, ApiKeyAuth) — manage verification campaigns
// ---------------------------------------------------------------------------

import type { HttpClient } from "../core/http.js";
import type {
  TweetSubmission,
  TweetVerificationRule,
  PaginatedResponse,
  PaginationOptions,
} from "@rewardz/types";
import {
  API_TWEETS_SUBMIT,
  API_TWEETS_STATUS,
  API_TWEETS_SUBMISSIONS,
  API_TWEETS_RULES,
  API_TWEETS_CAMPAIGNS,
  API_TWEETS_CAMPAIGNS_BY_ID,
} from "@rewardz/types";

/* -------------------------------------------------------------------------- */
/*  TweetClient — user-facing (WalletAuth)                                    */
/* -------------------------------------------------------------------------- */

/**
 * Submit and track tweet submissions.
 *
 * Intended for end-users authenticating via WalletAuth. The `HttpClient`
 * instance should already have wallet auth headers configured.
 */
export class TweetClient {
  constructor(private readonly http: HttpClient) {}

  /**
   * Submit a tweet URL for verification and point rewards.
   *
   * @param tweetUrl - Full URL to the tweet (e.g. https://x.com/user/status/123)
   * @param wallet - Wallet address of the submitting user
   * @param protocolId - Optional protocol to associate with the submission
   */
  async submit(
    tweetUrl: string,
    wallet: string,
    protocolId?: string,
  ): Promise<TweetSubmission> {
    return this.http.post<TweetSubmission>(API_TWEETS_SUBMIT, {
      tweet_url: tweetUrl,
      wallet_address: wallet,
      protocol_id: protocolId,
    });
  }

  /**
   * Get the current status of a tweet submission.
   *
   * @param submissionId - The submission ID returned from `submit()`
   */
  async getStatus(submissionId: string): Promise<TweetSubmission> {
    const path = API_TWEETS_STATUS.replace(":submission_id", submissionId);
    return this.http.get<TweetSubmission>(path);
  }

  /**
   * List all tweet submissions for a wallet.
   *
   * @param wallet - Wallet address to query
   * @param pagination - Optional pagination params (limit, page)
   */
  async listSubmissions(
    wallet: string,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResponse<TweetSubmission>> {
    const params: Record<string, string> = { wallet };

    if (pagination?.limit != null) {
      params.limit = String(pagination.limit);
    }
    if (pagination?.page != null) {
      // API uses offset-based pagination; convert page to offset
      const limit = pagination.limit ?? 20;
      params.offset = String((pagination.page - 1) * limit);
    }

    return this.http.get<PaginatedResponse<TweetSubmission>>(
      API_TWEETS_SUBMISSIONS,
      params,
    );
  }

  /**
   * List active tweet verification rules.
   *
   * @param protocolId - Optional protocol filter
   */
  async listRules(protocolId?: string): Promise<TweetVerificationRule[]> {
    const params: Record<string, string> = {};
    if (protocolId) {
      params.protocolId = protocolId;
    }

    const response = await this.http.get<{ rules: TweetVerificationRule[] }>(
      API_TWEETS_RULES,
      params,
    );
    return response.rules;
  }
}

/* -------------------------------------------------------------------------- */
/*  TweetConfig — protocol-facing (ApiKeyAuth)                                */
/* -------------------------------------------------------------------------- */

/** Parameters for creating a tweet verification campaign. */
export interface CreateCampaignConfig {
  hashtags?: string[];
  mentions?: string[];
  cashtags?: string[];
  basePoints: number;
  bonusPerLike?: number;
  allRequired?: boolean;
}

/** Parameters for updating an existing campaign. */
export interface UpdateCampaignConfig {
  hashtags?: string[];
  mentions?: string[];
  cashtags?: string[];
  basePoints?: number;
  bonusPerLike?: number;
  allRequired?: boolean;
}

/**
 * Manage tweet verification campaigns for a protocol.
 *
 * Intended for protocol partners authenticating via ApiKeyAuth. The
 * `HttpClient` instance should already have API key headers configured.
 */
export class TweetConfig {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a new tweet verification campaign (rule).
   *
   * @param config - Campaign configuration (hashtags, mentions, points, etc.)
   */
  async configureCampaign(
    config: CreateCampaignConfig,
  ): Promise<TweetVerificationRule> {
    return this.http.post<TweetVerificationRule>(API_TWEETS_CAMPAIGNS, config);
  }

  /**
   * List all campaigns owned by this protocol.
   */
  async listCampaigns(): Promise<TweetVerificationRule[]> {
    const response = await this.http.get<{ rules: TweetVerificationRule[] }>(
      API_TWEETS_CAMPAIGNS,
    );
    return response.rules;
  }

  /**
   * Update an existing campaign rule.
   *
   * @param ruleId - The rule/campaign ID to update
   * @param update - Fields to update
   */
  async updateCampaign(
    ruleId: string,
    update: UpdateCampaignConfig,
  ): Promise<TweetVerificationRule> {
    const path = API_TWEETS_CAMPAIGNS_BY_ID.replace(":rule_id", ruleId);
    return this.http.patch<TweetVerificationRule>(path, update);
  }
}
