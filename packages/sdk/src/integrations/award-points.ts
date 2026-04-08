// ---------------------------------------------------------------------------
// @rewardz/sdk/integrations — Award Points
//
// Protocol-facing class for awarding points to users. Uses ApiKeyAuth.
// ---------------------------------------------------------------------------

import type { HttpClient } from "../core/http.js";
import type { AwardResult } from "@rewardz/types";
import {
  API_POINTS_AWARD,
  API_POINTS_AWARD_BATCH,
  API_POINTS_BUDGET,
} from "@rewardz/types";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/** A single award entry for batch operations. */
export interface BatchAwardEntry {
  wallet: string;
  amount: number;
  reason?: string;
  idempotencyKey: string;
}

/** Budget information for the protocol's point allocation. */
export interface PointsBudget {
  remaining: number;
  daily_limit: number;
  monthly_limit: number;
}

/* -------------------------------------------------------------------------- */
/*  AwardPointsConfig — protocol-facing (ApiKeyAuth)                          */
/* -------------------------------------------------------------------------- */

/**
 * Award points to users on behalf of a protocol.
 *
 * Intended for protocol partners authenticating via ApiKeyAuth. The
 * `HttpClient` instance should already have API key headers configured.
 */
export class AwardPointsConfig {
  constructor(private readonly http: HttpClient) {}

  /**
   * Award points to a single wallet.
   *
   * @param wallet - Recipient wallet address
   * @param amount - Number of points to award (must be positive)
   * @param reason - Human-readable reason for the award
   * @param idempotencyKey - Optional deduplication key to prevent double-awards
   */
  async awardPoints(
    wallet: string,
    amount: number,
    reason: string,
    idempotencyKey?: string,
  ): Promise<AwardResult> {
    return this.http.post<AwardResult>(API_POINTS_AWARD, {
      wallet_address: wallet,
      amount,
      reason,
      idempotency_key: idempotencyKey,
    });
  }

  /**
   * Award points to multiple wallets in a single batch.
   *
   * The API accepts up to 100 awards per batch call.
   *
   * @param awards - Array of award entries
   */
  async awardBatch(awards: BatchAwardEntry[]): Promise<AwardResult[]> {
    const body = {
      awards: awards.map((a) => ({
        wallet_address: a.wallet,
        amount: a.amount,
        reason: a.reason,
        idempotency_key: a.idempotencyKey,
      })),
    };

    const response = await this.http.post<{ results: AwardResult[] }>(
      API_POINTS_AWARD_BATCH,
      body,
    );
    return response.results;
  }

  /**
   * Get the protocol's remaining points budget and limits.
   */
  async getBudget(): Promise<PointsBudget> {
    return this.http.get<PointsBudget>(API_POINTS_BUDGET);
  }
}
