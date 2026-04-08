// ---------------------------------------------------------------------------
// @rewardz/sdk/client — Leaderboard Client
//
// Provides leaderboard functionality: season info, user rankings, protocol
// rankings, and individual rank lookups.
// ---------------------------------------------------------------------------

import type { HttpClient } from "../core/http.js";
import type { Season, UserRank, ProtocolRank } from "@rewardz/types";
import {
  API_LEADERBOARD_SEASON,
  API_LEADERBOARD_PROTOCOLS,
  API_LEADERBOARD_PROTOCOLS_BY_ID,
  API_LEADERBOARD_USERS,
  API_LEADERBOARD_ME,
} from "@rewardz/types";
import type { PaginationMeta } from "./types.js";

/* -------------------------------------------------------------------------- */
/*  Response Types                                                             */
/* -------------------------------------------------------------------------- */

/** Response from GET /v1/leaderboard/season */
export interface SeasonResponse extends Season {}

/** Response from GET /v1/leaderboard/users */
export interface UserRankingsResponse {
  rankings: UserRank[];
  pagination: PaginationMeta;
}

/** Response from GET /v1/leaderboard/protocols */
export interface ProtocolRankingsResponse {
  rankings: ProtocolRank[];
  pagination: PaginationMeta;
}

/* -------------------------------------------------------------------------- */
/*  LeaderboardClient                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Query leaderboard data: seasons, user rankings, and protocol rankings.
 *
 * Intended for end-users authenticating via WalletAuth. The `HttpClient`
 * instance should already have wallet auth headers configured.
 */
export class LeaderboardClient {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get the current active season.
   *
   * @returns Current season info (id, name, dates, status).
   */
  async getCurrentSeason(): Promise<SeasonResponse> {
    return this.http.get<SeasonResponse>(API_LEADERBOARD_SEASON);
  }

  /**
   * Get paginated protocol rankings for a season.
   *
   * @param seasonId - Optional season ID. Defaults to the current season on the server.
   * @param pagination - Optional pagination params (limit, page).
   * @returns Ranked list of protocols with pagination metadata.
   */
  async getProtocolRankings(
    seasonId?: string,
    pagination?: { limit?: number; page?: number },
  ): Promise<ProtocolRankingsResponse> {
    const params: Record<string, string> = {};

    if (seasonId != null) {
      params.seasonId = seasonId;
    }
    if (pagination?.limit != null) {
      params.limit = String(pagination.limit);
    }
    if (pagination?.page != null) {
      params.page = String(pagination.page);
    }

    return this.http.get<ProtocolRankingsResponse>(
      API_LEADERBOARD_PROTOCOLS,
      params,
    );
  }

  /**
   * Get paginated user rankings for a season.
   *
   * @param seasonId - Optional season ID. Defaults to the current season on the server.
   * @param pagination - Optional pagination params (limit, page).
   * @returns Ranked list of users with pagination metadata.
   */
  async getUserRankings(
    seasonId?: string,
    pagination?: { limit?: number; page?: number },
  ): Promise<UserRankingsResponse> {
    const params: Record<string, string> = {};

    if (seasonId != null) {
      params.seasonId = seasonId;
    }
    if (pagination?.limit != null) {
      params.limit = String(pagination.limit);
    }
    if (pagination?.page != null) {
      params.page = String(pagination.page);
    }

    return this.http.get<UserRankingsResponse>(API_LEADERBOARD_USERS, params);
  }

  /**
   * Get the authenticated user's rank in the current season.
   *
   * @returns The calling user's rank entry.
   */
  async getMyRank(): Promise<UserRank> {
    return this.http.get<UserRank>(API_LEADERBOARD_ME);
  }

  /**
   * Get a specific protocol's rank in the current season.
   *
   * @param protocolId - The protocol ID to look up.
   * @returns The protocol's rank entry.
   */
  async getProtocolRank(protocolId: string): Promise<ProtocolRank> {
    const path = API_LEADERBOARD_PROTOCOLS_BY_ID.replace(
      ":id",
      encodeURIComponent(protocolId),
    );
    return this.http.get<ProtocolRank>(path);
  }
}
