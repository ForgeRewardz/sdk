// ---------------------------------------------------------------------------
// @rewardz/sdk/protocol — ProtocolAdapter
//
// High-level class for protocol partners. Handles registration, reward policy
// management, quest CRUD, protocol composition, and (stubbed) analytics.
//
// Auth: API key via `x-api-key` header (ApiKeyAuth).
// ---------------------------------------------------------------------------

import { HttpClient } from "../core/http.js";
import { ApiKeyAuth } from "../core/auth.js";
import { RewardzApiError } from "../core/errors.js";

import type {
  Protocol,
  ProtocolManifest,
  RewardPolicy,
  Campaign,
  Quest,
  QuestStep,
  QuestCollaborator,
} from "@rewardz/types";

import {
  API_PROTOCOLS_REGISTER,
  API_PROTOCOLS_BY_ID,
  API_PROTOCOLS_QUESTS,
  API_QUESTS,
  API_QUESTS_BY_ID,
  API_QUESTS_JOIN,
} from "@rewardz/types";

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

export interface ProtocolAdapterConfig {
  /** API key issued during protocol registration. */
  apiKey: string;
  /** Base URL for the REWARDZ API (e.g. "https://api.rewardz.xyz"). */
  apiBaseUrl: string;
  /** Per-request timeout in milliseconds (default: 30 000). */
  timeoutMs?: number;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Replace `:param` placeholders in a path template.
 *
 * e.g. pathWithParams("/v1/protocols/:id", { id: "abc" }) => "/v1/protocols/abc"
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

/* -------------------------------------------------------------------------- */
/*  ProtocolAdapter                                                           */
/* -------------------------------------------------------------------------- */

export class ProtocolAdapter {
  private readonly http: HttpClient;
  private readonly auth: ApiKeyAuth;

  constructor(config: ProtocolAdapterConfig) {
    this.auth = new ApiKeyAuth(config.apiKey);
    this.http = new HttpClient({
      baseUrl: config.apiBaseUrl,
      timeoutMs: config.timeoutMs,
    });

    // Apply API key headers immediately so every request is authenticated.
    // ApiKeyAuth.getHeaders() is synchronous in practice (returns a resolved
    // promise), but we call it eagerly here and set the header directly.
    this.http.setAuthHeaders({ "x-api-key": config.apiKey });
  }

  /* ── Protocol Registration ─────────────────────────────────────────────── */

  /**
   * Register a new protocol manifest with the REWARDZ API.
   *
   * Maps to `POST /v1/protocols/register`.
   */
  async registerManifest(
    manifest: Partial<ProtocolManifest>,
  ): Promise<Protocol> {
    return this.http.post<Protocol>(API_PROTOCOLS_REGISTER, manifest);
  }

  /**
   * Update an existing protocol's manifest.
   *
   * Maps to `PATCH /v1/protocols/:id`.
   */
  async updateManifest(
    protocolId: string,
    update: Partial<ProtocolManifest>,
  ): Promise<Protocol> {
    const path = pathWithParams(API_PROTOCOLS_BY_ID, { id: protocolId });
    return this.http.patch<Protocol>(path, update);
  }

  /* ── Reward Policy Management ──────────────────────────────────────────── */

  /**
   * Create a reward policy (campaign) for this protocol.
   *
   * Maps to `POST /v1/protocols/:id/quests` with campaign-style payload.
   *
   * Note: The current API models campaigns as quests with reward policies
   * embedded. This method posts to the protocol's quest endpoint with
   * reward-policy-focused fields.
   */
  async createRewardPolicy(policy: Partial<RewardPolicy>): Promise<Campaign> {
    if (!policy.protocolId) {
      throw new RewardzApiError(
        "protocolId is required to create a reward policy",
        400,
        "VALIDATION_ERROR",
      );
    }
    const path = pathWithParams(API_PROTOCOLS_QUESTS, {
      id: policy.protocolId,
    });
    return this.http.post<Campaign>(path, policy);
  }

  /**
   * Update an existing reward policy (campaign).
   *
   * Maps to `PATCH /v1/quests/:id` — policies are stored as quest records.
   */
  async updateRewardPolicy(
    policyId: string,
    update: Partial<RewardPolicy>,
  ): Promise<Campaign> {
    const path = pathWithParams(API_QUESTS_BY_ID, { id: policyId });
    return this.http.patch<Campaign>(path, update);
  }

  /* ── Quest Management ──────────────────────────────────────────────────── */

  /**
   * Create a simple quest for this protocol.
   *
   * Maps to `POST /v1/protocols/:id/quests`.
   */
  async createQuest(config: Partial<Quest>): Promise<Quest> {
    if (!config.createdBy) {
      throw new RewardzApiError(
        "createdBy (protocolId) is required to create a quest",
        400,
        "VALIDATION_ERROR",
      );
    }
    const path = pathWithParams(API_PROTOCOLS_QUESTS, {
      id: config.createdBy,
    });
    return this.http.post<Quest>(path, config);
  }

  /**
   * Create a composable (multi-step) quest.
   *
   * Maps to `POST /v1/protocols/:id/quests` with `quest_type: "composable"`
   * and embedded steps.
   */
  async createComposableQuest(config: {
    protocolId: string;
    name: string;
    description: string;
    steps: Partial<QuestStep>[];
    bonusPoints?: number;
  }): Promise<Quest> {
    const path = pathWithParams(API_PROTOCOLS_QUESTS, {
      id: config.protocolId,
    });
    return this.http.post<Quest>(path, {
      name: config.name,
      description: config.description,
      quest_type: "composable",
      steps: config.steps,
      bonus_points: config.bonusPoints,
    });
  }

  /* ── Protocol Composition ──────────────────────────────────────────────── */

  /**
   * Discover composable quests available for collaboration.
   *
   * Maps to `GET /v1/quests?quest_type=composable` with optional filters.
   */
  async discoverComposableQuests(
    filters?: Record<string, string>,
  ): Promise<Quest[]> {
    const params: Record<string, string> = {
      quest_type: "composable",
      ...filters,
    };
    const response = await this.http.get<{ quests: Quest[] }>(
      API_QUESTS,
      params,
    );
    return response.quests;
  }

  /**
   * Join an existing composable quest by contributing a step.
   *
   * Maps to `POST /v1/quests/:id/join` with step configuration.
   */
  async joinComposableQuest(
    questId: string,
    stepConfig: Partial<QuestStep>,
  ): Promise<QuestCollaborator> {
    const path = pathWithParams(API_QUESTS_JOIN, { id: questId });
    return this.http.post<QuestCollaborator>(path, stepConfig);
  }

  /**
   * Invite another protocol to contribute to a composable quest.
   *
   * Note: No dedicated API endpoint exists yet. This posts an invitation
   * payload to the quest join endpoint.
   */
  async inviteToQuest(
    questId: string,
    invitation: { protocolId: string; stepIndex: number },
  ): Promise<QuestCollaborator> {
    const path = pathWithParams(API_QUESTS_JOIN, { id: questId });
    return this.http.post<QuestCollaborator>(path, {
      ...invitation,
      role: "step_provider",
    });
  }

  /* ── Analytics ─────────────────────────────────────────────────────────── */

  /**
   * Get campaign statistics for a reward policy.
   *
   * **Stub** — No dedicated API endpoint exists yet. Always throws 501.
   */
  async getCampaignStats(
    _policyId: string,
  ): Promise<{
    totalAwarded: number;
    uniqueUsers: number;
    completions: number;
  }> {
    throw new RewardzApiError(
      "Campaign stats endpoint not yet available",
      501,
      "NOT_IMPLEMENTED",
    );
  }
}
