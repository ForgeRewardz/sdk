// ---------------------------------------------------------------------------
// @rewardz/sdk/agent — Agent Delegation Client
//
// Manages AI agent delegations: CRUD operations on delegations, trigger
// management, and audit log retrieval. Authenticates via BearerAuth (JWT).
//
// Zero external dependencies beyond the SDK core — safe in browser, Node 18+,
// and React Native.
// ---------------------------------------------------------------------------

import { HttpClient } from "../core/http.js";
import { BearerAuth } from "../core/auth.js";
import {
  API_DELEGATIONS,
  API_DELEGATIONS_BY_ID,
  API_DELEGATIONS_TRIGGERS,
  API_DELEGATIONS_TRIGGER_BY_ID,
  API_DELEGATIONS_AUDIT_LOG,
} from "@rewardz/types";
import type {
  AgentDelegation,
  AgentTrigger,
  AuditLogEntry,
  DelegationConfig,
} from "@rewardz/types";

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

export interface AgentDelegationClientConfig {
  /** Bearer token (JWT) for agent auth. */
  token: string;
  /** Base URL for the REWARDZ API (e.g. "https://api.rewardz.xyz"). */
  apiBaseUrl: string;
  /** Per-request timeout in milliseconds (default: 30 000). */
  timeoutMs?: number;
}

/* -------------------------------------------------------------------------- */
/*  Response types (match API shapes)                                         */
/* -------------------------------------------------------------------------- */

/** Response shape for GET /delegations (list). */
interface ListDelegationsResponse {
  delegations: AgentDelegation[];
  pagination: { limit: number; offset: number; total: number };
}

/** Response shape for DELETE /delegations/:id (revoke). */
interface RevokeDelegationResponse {
  delegation_id: string;
  status: "revoked";
}

/** Response shape for DELETE /delegations/:id/triggers/:tid. */
interface RemoveTriggerResponse {
  trigger_id: string;
  enabled: false;
}

/** Response shape for GET /delegations/:id/audit-log. */
interface AuditLogResponse {
  audit_log: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Replace `:param` placeholders in an API path constant with actual values.
 *
 * E.g. `interpolate("/v1/delegations/:id", { id: "abc" })` => `"/v1/delegations/abc"`
 */
function interpolate(template: string, params: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`:${key}`, encodeURIComponent(value));
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/*  AgentDelegationClient                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Client for managing AI agent delegations.
 *
 * Wraps the `/v1/delegations` family of endpoints with typed methods.
 * Authenticates every request with a Bearer JWT via {@link BearerAuth}.
 *
 * @example
 * ```ts
 * const agent = new AgentDelegationClient({
 *   token: "eyJhbGciOiJFZDI1NTE5...",
 *   apiBaseUrl: "https://api.rewardz.xyz",
 * });
 *
 * const delegation = await agent.createDelegation({
 *   agentId: "my-agent",
 *   permissions: { swap: true, stake: false },
 *   maxSpendPerAction: 100,
 *   dailyLimit: 500,
 *   allowedActions: ["swap"],
 *   expiresAt: new Date("2025-12-31"),
 * });
 * ```
 */
export class AgentDelegationClient {
  private readonly http: HttpClient;
  private readonly auth: BearerAuth;

  constructor(config: AgentDelegationClientConfig) {
    this.auth = new BearerAuth(config.token);
    this.http = new HttpClient({
      baseUrl: config.apiBaseUrl,
      timeoutMs: config.timeoutMs,
    });
  }

  /* ── CRUD Operations ───────────────────────────────────────────────────── */

  /**
   * Create a new agent delegation.
   *
   * Maps to `POST /v1/delegations`.
   */
  async createDelegation(config: DelegationConfig): Promise<AgentDelegation> {
    await this.ensureAuth();
    return this.http.post<AgentDelegation>(API_DELEGATIONS, {
      agent_id: config.agentId,
      permissions: config.permissions,
      constraints: {
        max_spend_per_action: config.maxSpendPerAction,
        daily_limit: config.dailyLimit,
        allowed_actions: config.allowedActions,
      },
      expires_at: config.expiresAt.toISOString(),
    });
  }

  /**
   * List all active delegations for the authenticated user.
   *
   * Maps to `GET /v1/delegations`.
   */
  async listDelegations(): Promise<AgentDelegation[]> {
    await this.ensureAuth();
    const response =
      await this.http.get<ListDelegationsResponse>(API_DELEGATIONS);
    return response.delegations;
  }

  /**
   * Get a single delegation by ID.
   *
   * Maps to `GET /v1/delegations/:id`.
   */
  async getDelegation(id: string): Promise<AgentDelegation> {
    await this.ensureAuth();
    const path = interpolate(API_DELEGATIONS_BY_ID, { id });
    return this.http.get<AgentDelegation>(path);
  }

  /**
   * Update an existing delegation (status and/or constraints).
   *
   * Maps to `PATCH /v1/delegations/:id`.
   */
  async updateDelegation(
    id: string,
    update: Partial<DelegationConfig>,
  ): Promise<AgentDelegation> {
    await this.ensureAuth();
    const path = interpolate(API_DELEGATIONS_BY_ID, { id });

    // Build the API-shaped patch body from the SDK-facing DelegationConfig.
    const body: Record<string, unknown> = {};

    if (update.permissions !== undefined) {
      body.permissions = update.permissions;
    }

    if (update.expiresAt !== undefined) {
      body.expires_at = update.expiresAt.toISOString();
    }

    // Map SDK constraints fields to the API's `constraints` object.
    const constraints: Record<string, unknown> = {};
    if (update.maxSpendPerAction !== undefined) {
      constraints.max_spend_per_action = update.maxSpendPerAction;
    }
    if (update.dailyLimit !== undefined) {
      constraints.daily_limit = update.dailyLimit;
    }
    if (update.allowedActions !== undefined) {
      constraints.allowed_actions = update.allowedActions;
    }

    if (Object.keys(constraints).length > 0) {
      body.constraints = constraints;
    }

    return this.http.patch<AgentDelegation>(path, body);
  }

  /**
   * Revoke (soft-delete) a delegation.
   *
   * Maps to `DELETE /v1/delegations/:id`. The API sets `status = 'revoked'`.
   */
  async revokeDelegation(id: string): Promise<void> {
    await this.ensureAuth();
    const path = interpolate(API_DELEGATIONS_BY_ID, { id });
    await this.http.delete<RevokeDelegationResponse>(path);
  }

  /* ── Trigger Management ────────────────────────────────────────────────── */

  /**
   * Add a trigger to a delegation.
   *
   * Maps to `POST /v1/delegations/:id/triggers`.
   */
  async addTrigger(
    delegationId: string,
    trigger: Partial<AgentTrigger>,
  ): Promise<AgentTrigger> {
    await this.ensureAuth();
    const path = interpolate(API_DELEGATIONS_TRIGGERS, { id: delegationId });
    return this.http.post<AgentTrigger>(path, {
      type: trigger.type,
      config: trigger.config,
    });
  }

  /**
   * Remove (disable) a trigger from a delegation.
   *
   * Maps to `DELETE /v1/delegations/:id/triggers/:tid`. The API sets
   * `enabled = false` rather than hard-deleting.
   */
  async removeTrigger(delegationId: string, triggerId: string): Promise<void> {
    await this.ensureAuth();
    const path = interpolate(API_DELEGATIONS_TRIGGER_BY_ID, {
      id: delegationId,
      tid: triggerId,
    });
    await this.http.delete<RemoveTriggerResponse>(path);
  }

  /* ── Audit ─────────────────────────────────────────────────────────────── */

  /**
   * Get the audit log for a delegation.
   *
   * Maps to `GET /v1/delegations/:id/audit-log`.
   */
  async getAuditLog(delegationId: string): Promise<AuditLogEntry[]> {
    await this.ensureAuth();
    const path = interpolate(API_DELEGATIONS_AUDIT_LOG, {
      id: delegationId,
    });
    const response = await this.http.get<AuditLogResponse>(path);
    return response.audit_log;
  }

  /* ── Auth Internals ────────────────────────────────────────────────────── */

  /**
   * Ensure auth headers are current before each request.
   *
   * Re-applies headers so that if the token was refreshed via
   * `BearerAuth.setToken()`, subsequent requests pick up the new value.
   */
  private async ensureAuth(): Promise<void> {
    const headers = await this.auth.getHeaders();
    this.http.setAuthHeaders(headers);
  }
}
