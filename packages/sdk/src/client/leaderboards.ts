// ---------------------------------------------------------------------------
// @rewardz/sdk/client — Leaderboard Client (TODO-0016 §16C shape)
//
// Provides leaderboard functionality: current season info, user rankings,
// protocol rankings, and individual rank lookups.
//
// ── BigInt-as-string wire convention ────────────────────────────────────────
// The REWARDZ API serialises point totals (`totalPoints`,
// `totalPointsIssued`, and every field in `PointsBreakdown`) as **strings**
// because JSON cannot natively represent `bigint`. This client passes those
// strings through unchanged — it does NOT coerce them to `bigint`. Consumers
// that need arithmetic should coerce in-memory:
//
//     const total = BigInt(entry.totalPoints);
//     const apiChannel = BigInt(entry.breakdown.api);
//
// See `@rewardz/types` `UserRank`, `ProtocolRank`, and `PointsBreakdown` for
// the full type contracts.
//
// ── 5→4 channel rollup ──────────────────────────────────────────────────────
// The underlying point-event channel enum has five members
// (`api | webhook | blink | completion | tweet`), but this leaderboard
// surface only exposes four — `completion` is rolled up into `blink`
// server-side before serialisation. See TODO-0016 §16C for the rationale.
// ---------------------------------------------------------------------------

import type { HttpClient } from "../core/http.js";
import {
  type Season,
  type UserRank,
  type ProtocolRank,
  type UserRankingsResponse,
  type ProtocolRankingsResponse,
  API_LEADERBOARD_SEASON,
  API_LEADERBOARD_PROTOCOLS,
  API_LEADERBOARD_PROTOCOLS_BY_ID,
  API_LEADERBOARD_USERS,
  API_LEADERBOARD_ME,
} from "@rewardz/types";

// Re-export the shared types so SDK consumers can `import { UserRank } from
// "@rewardz/sdk/client"` without reaching into `@rewardz/types` directly.
export type {
  Season,
  UserRank,
  ProtocolRank,
  PointsBreakdown,
  UserRankingsResponse,
  ProtocolRankingsResponse,
} from "@rewardz/types";

/* -------------------------------------------------------------------------- */
/*  Options                                                                   */
/* -------------------------------------------------------------------------- */

/** Query options for paginated ranking endpoints. */
export interface LeaderboardQueryOptions {
  /**
   * Season to query. Defaults to the current season on the server when
   * omitted.
   */
  seasonId?: string;
  /** Max entries per page. Server default applies when omitted. */
  limit?: number;
  /** 1-indexed page number. Server default applies when omitted. */
  page?: number;
}

/* -------------------------------------------------------------------------- */
/*  LeaderboardClient                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Query season-scoped user + protocol leaderboards.
 *
 * All bigint-valued fields (`totalPoints`, `totalPointsIssued`, every field
 * in `PointsBreakdown`) are returned as **`string`** values — callers that
 * need arithmetic should coerce with `BigInt(value)` in-memory. See the
 * file-level comment for the full rationale.
 *
 * Intended for end-users authenticating via `WalletAuth`. The `HttpClient`
 * passed to the constructor should already have wallet auth headers attached
 * (typically via `RewardzClient`'s internal `ensureAuth` flow).
 */
export class LeaderboardClient {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get the current active season.
   *
   * @returns Current season info (id, name, dates, status, snapshotTaken).
   */
  async getCurrentSeason(): Promise<Season> {
    return this.http.get<Season>(API_LEADERBOARD_SEASON);
  }

  /**
   * Get paginated protocol rankings for a season.
   *
   * @param options - Optional `seasonId`, `limit`, `page`.
   * @returns `{ entries, total, seasonId }` — `entries` is the requested
   *   window; `total` is the full count for the season.
   */
  async getProtocolRankings(
    options?: LeaderboardQueryOptions,
  ): Promise<ProtocolRankingsResponse> {
    const params = this.buildQueryParams(options);
    return this.http.get<ProtocolRankingsResponse>(
      API_LEADERBOARD_PROTOCOLS,
      params,
    );
  }

  /**
   * Get paginated user rankings for a season.
   *
   * @param options - Optional `seasonId`, `limit`, `page`.
   * @returns `{ entries, total, seasonId }` — `entries` is the requested
   *   window; `total` is the full count for the season.
   */
  async getUserRankings(
    options?: LeaderboardQueryOptions,
  ): Promise<UserRankingsResponse> {
    const params = this.buildQueryParams(options);
    return this.http.get<UserRankingsResponse>(
      API_LEADERBOARD_USERS,
      params,
    );
  }

  /**
   * Get the authenticated user's rank, optionally scoped to a season.
   *
   * @param seasonId - Optional season ID. Defaults to the current season.
   * @returns The calling user's rank entry for the season.
   */
  async getMyRank(seasonId?: string): Promise<UserRank> {
    const params = seasonId != null ? { seasonId } : undefined;
    return this.http.get<UserRank>(API_LEADERBOARD_ME, params);
  }

  /**
   * Get a specific user's rank, optionally scoped to a season.
   *
   * @param wallet - Wallet address (base-58 public key).
   * @param seasonId - Optional season ID. Defaults to the current season.
   * @returns The user's rank entry for the season.
   */
  async getUserRank(wallet: string, seasonId?: string): Promise<UserRank> {
    // There's no dedicated constant for `users/:wallet` — build the path by
    // appending the encoded wallet to the collection route.
    const path = `${API_LEADERBOARD_USERS}/${encodeURIComponent(wallet)}`;
    const params = seasonId != null ? { seasonId } : undefined;
    return this.http.get<UserRank>(path, params);
  }

  /**
   * Get a specific protocol's rank, optionally scoped to a season.
   *
   * @param protocolId - The protocol ID to look up.
   * @param seasonId - Optional season ID. Defaults to the current season.
   * @returns The protocol's rank entry for the season.
   */
  async getProtocolRank(
    protocolId: string,
    seasonId?: string,
  ): Promise<ProtocolRank> {
    const path = API_LEADERBOARD_PROTOCOLS_BY_ID.replace(
      ":id",
      encodeURIComponent(protocolId),
    );
    const params = seasonId != null ? { seasonId } : undefined;
    return this.http.get<ProtocolRank>(path, params);
  }

  /* ── Internal helpers ──────────────────────────────────────────────────── */

  /**
   * Build the query-string record for paginated ranking endpoints. Returns
   * `undefined` when no params are set so we don't send `?` with an empty
   * query string.
   */
  private buildQueryParams(
    options?: LeaderboardQueryOptions,
  ): Record<string, string> | undefined {
    if (options == null) return undefined;

    const params: Record<string, string> = {};
    if (options.seasonId != null) {
      params.seasonId = options.seasonId;
    }
    if (options.limit != null) {
      params.limit = String(options.limit);
    }
    if (options.page != null) {
      params.page = String(options.page);
    }

    return Object.keys(params).length > 0 ? params : undefined;
  }
}
