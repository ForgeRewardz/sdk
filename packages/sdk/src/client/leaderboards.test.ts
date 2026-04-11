// ---------------------------------------------------------------------------
// @rewardz/sdk/client — LeaderboardClient Tests
//
// Covers all 6 read methods against a mock HttpClient and asserts the
// TODO-0016 §16C response shape (`entries + total + seasonId` with bigint
// fields passed through as strings).
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HttpClient } from "../core/http.js";
import { LeaderboardClient } from "./leaderboards.js";
import {
  API_LEADERBOARD_SEASON,
  API_LEADERBOARD_PROTOCOLS,
  API_LEADERBOARD_PROTOCOLS_BY_ID,
  API_LEADERBOARD_USERS,
  API_LEADERBOARD_ME,
  type Season,
  type UserRank,
  type ProtocolRank,
  type UserRankingsResponse,
  type ProtocolRankingsResponse,
} from "@rewardz/types";

/* -------------------------------------------------------------------------- */
/*  Mock HttpClient factory                                                   */
/* -------------------------------------------------------------------------- */

type MockedHttp = {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  setAuthHeaders: ReturnType<typeof vi.fn>;
};

function makeMock(): MockedHttp & HttpClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    setAuthHeaders: vi.fn(),
  } as unknown as MockedHttp & HttpClient;
}

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

const SEASON_FIXTURE: Season = {
  seasonId: "season-2026-q1",
  name: "Q1 2026",
  description: "First season of 2026",
  startAt: "2026-01-01T00:00:00.000Z",
  endAt: "2026-03-31T23:59:59.999Z",
  status: "active",
  snapshotTaken: false,
};

const USER_RANK_FIXTURE: UserRank = {
  wallet: "walletAAA",
  rank: 1,
  // String, not bigint — this is the wire format.
  totalPoints: "123456789",
  breakdown: {
    tweet: "1000",
    api: "100000000",
    webhook: "22456789",
    blink: "0",
  },
  seasonId: "season-2026-q1",
};

const PROTOCOL_RANK_FIXTURE: ProtocolRank = {
  protocolId: "proto-1",
  protocolName: "Alpha Protocol",
  protocolLogo: null,
  rank: 1,
  totalPointsIssued: "987654321",
  breakdown: {
    tweet: "0",
    api: "500000000",
    webhook: "0",
    blink: "487654321",
  },
  uniqueUsersRewarded: 42,
  seasonId: "season-2026-q1",
};

const USER_RANKINGS_FIXTURE: UserRankingsResponse = {
  entries: [USER_RANK_FIXTURE],
  total: 1500,
  seasonId: "season-2026-q1",
};

const PROTOCOL_RANKINGS_FIXTURE: ProtocolRankingsResponse = {
  entries: [PROTOCOL_RANK_FIXTURE],
  total: 37,
  seasonId: "season-2026-q1",
};

/* -------------------------------------------------------------------------- */
/*  LeaderboardClient                                                         */
/* -------------------------------------------------------------------------- */

describe("LeaderboardClient", () => {
  let http: MockedHttp & HttpClient;
  let client: LeaderboardClient;

  beforeEach(() => {
    http = makeMock();
    client = new LeaderboardClient(http);
  });

  /* ── getCurrentSeason ──────────────────────────────────────────────────── */

  describe("getCurrentSeason", () => {
    it("calls GET to API_LEADERBOARD_SEASON with no params", async () => {
      http.get.mockResolvedValue(SEASON_FIXTURE);

      const result = await client.getCurrentSeason();

      expect(http.get).toHaveBeenCalledWith(API_LEADERBOARD_SEASON);
      expect(result).toEqual(SEASON_FIXTURE);
      expect(result.seasonId).toBe("season-2026-q1");
      expect(result.status).toBe("active");
      expect(result.snapshotTaken).toBe(false);
    });
  });

  /* ── getProtocolRankings ───────────────────────────────────────────────── */

  describe("getProtocolRankings", () => {
    it("calls GET to API_LEADERBOARD_PROTOCOLS with no params when options omitted", async () => {
      http.get.mockResolvedValue(PROTOCOL_RANKINGS_FIXTURE);

      const result = await client.getProtocolRankings();

      expect(http.get).toHaveBeenCalledWith(
        API_LEADERBOARD_PROTOCOLS,
        undefined,
      );
      expect(result).toEqual(PROTOCOL_RANKINGS_FIXTURE);
    });

    it("appends seasonId, limit, and page query params when provided", async () => {
      http.get.mockResolvedValue(PROTOCOL_RANKINGS_FIXTURE);

      await client.getProtocolRankings({
        seasonId: "season-2026-q1",
        limit: 25,
        page: 2,
      });

      expect(http.get).toHaveBeenCalledWith(API_LEADERBOARD_PROTOCOLS, {
        seasonId: "season-2026-q1",
        limit: "25",
        page: "2",
      });
    });

    it("returns { entries, total, seasonId } shape (TODO-0016 §16C)", async () => {
      http.get.mockResolvedValue(PROTOCOL_RANKINGS_FIXTURE);

      const result = await client.getProtocolRankings({ limit: 10 });

      expect(Array.isArray(result.entries)).toBe(true);
      expect(typeof result.total).toBe("number");
      expect(typeof result.seasonId).toBe("string");
      // No `rankings` or nested `pagination` — those were the old shape.
      expect(result).not.toHaveProperty("rankings");
      expect(result).not.toHaveProperty("pagination");
    });

    it("passes string-wire bigint fields through without coercion", async () => {
      http.get.mockResolvedValue(PROTOCOL_RANKINGS_FIXTURE);

      const result = await client.getProtocolRankings();

      const entry = result.entries[0]!;
      // Wire format: string, not bigint. Client must not coerce.
      expect(typeof entry.totalPointsIssued).toBe("string");
      expect(entry.totalPointsIssued).toBe("987654321");
      expect(typeof entry.breakdown.api).toBe("string");
      expect(entry.breakdown.api).toBe("500000000");
      expect(entry.breakdown.blink).toBe("487654321");

      // Callers that need arithmetic coerce themselves — verify the
      // string is a valid bigint input.
      expect(BigInt(entry.totalPointsIssued)).toBe(987654321n);
    });
  });

  /* ── getUserRankings ───────────────────────────────────────────────────── */

  describe("getUserRankings", () => {
    it("calls GET to API_LEADERBOARD_USERS with no params when options omitted", async () => {
      http.get.mockResolvedValue(USER_RANKINGS_FIXTURE);

      const result = await client.getUserRankings();

      expect(http.get).toHaveBeenCalledWith(API_LEADERBOARD_USERS, undefined);
      expect(result).toEqual(USER_RANKINGS_FIXTURE);
    });

    it("appends seasonId, limit, and page query params when provided", async () => {
      http.get.mockResolvedValue(USER_RANKINGS_FIXTURE);

      await client.getUserRankings({
        seasonId: "season-2026-q1",
        limit: 50,
        page: 1,
      });

      expect(http.get).toHaveBeenCalledWith(API_LEADERBOARD_USERS, {
        seasonId: "season-2026-q1",
        limit: "50",
        page: "1",
      });
    });

    it("returns { entries, total, seasonId } shape and preserves string-wire totalPoints", async () => {
      http.get.mockResolvedValue(USER_RANKINGS_FIXTURE);

      const result = await client.getUserRankings();

      expect(result.entries).toHaveLength(1);
      expect(result.total).toBe(1500);
      expect(result.seasonId).toBe("season-2026-q1");

      const entry = result.entries[0]!;
      expect(typeof entry.totalPoints).toBe("string");
      expect(entry.totalPoints).toBe("123456789");
      expect(entry.breakdown.api).toBe("100000000");
      expect(BigInt(entry.totalPoints)).toBe(123456789n);
    });

    it("only sends the query params that are actually set", async () => {
      http.get.mockResolvedValue(USER_RANKINGS_FIXTURE);

      // Only limit provided — seasonId and page should not appear.
      await client.getUserRankings({ limit: 10 });

      expect(http.get).toHaveBeenCalledWith(API_LEADERBOARD_USERS, {
        limit: "10",
      });
    });
  });

  /* ── getMyRank ─────────────────────────────────────────────────────────── */

  describe("getMyRank", () => {
    it("calls GET to API_LEADERBOARD_ME with no params when seasonId omitted", async () => {
      http.get.mockResolvedValue(USER_RANK_FIXTURE);

      const result = await client.getMyRank();

      expect(http.get).toHaveBeenCalledWith(API_LEADERBOARD_ME, undefined);
      expect(result).toEqual(USER_RANK_FIXTURE);
    });

    it("appends seasonId query param when provided", async () => {
      http.get.mockResolvedValue(USER_RANK_FIXTURE);

      await client.getMyRank("season-2026-q1");

      expect(http.get).toHaveBeenCalledWith(API_LEADERBOARD_ME, {
        seasonId: "season-2026-q1",
      });
    });
  });

  /* ── getUserRank ───────────────────────────────────────────────────────── */

  describe("getUserRank", () => {
    it("builds /v1/leaderboard/users/:wallet path and calls GET", async () => {
      http.get.mockResolvedValue(USER_RANK_FIXTURE);

      const result = await client.getUserRank("walletAAA");

      expect(http.get).toHaveBeenCalledWith(
        "/v1/leaderboard/users/walletAAA",
        undefined,
      );
      expect(result).toEqual(USER_RANK_FIXTURE);
    });

    it("appends seasonId query param when provided", async () => {
      http.get.mockResolvedValue(USER_RANK_FIXTURE);

      await client.getUserRank("walletAAA", "season-2026-q1");

      expect(http.get).toHaveBeenCalledWith(
        "/v1/leaderboard/users/walletAAA",
        { seasonId: "season-2026-q1" },
      );
    });

    it("URL-encodes the wallet segment", async () => {
      http.get.mockResolvedValue(USER_RANK_FIXTURE);

      // Pathological wallet with a character that needs encoding.
      await client.getUserRank("wallet with spaces");

      expect(http.get).toHaveBeenCalledWith(
        "/v1/leaderboard/users/wallet%20with%20spaces",
        undefined,
      );
    });
  });

  /* ── getProtocolRank ───────────────────────────────────────────────────── */

  describe("getProtocolRank", () => {
    it("substitutes :id in API_LEADERBOARD_PROTOCOLS_BY_ID and calls GET", async () => {
      http.get.mockResolvedValue(PROTOCOL_RANK_FIXTURE);

      const result = await client.getProtocolRank("proto-1");

      const expectedPath = API_LEADERBOARD_PROTOCOLS_BY_ID.replace(
        ":id",
        "proto-1",
      );
      expect(http.get).toHaveBeenCalledWith(expectedPath, undefined);
      expect(expectedPath).toBe("/v1/leaderboard/protocols/proto-1");
      expect(result).toEqual(PROTOCOL_RANK_FIXTURE);
    });

    it("appends seasonId query param when provided", async () => {
      http.get.mockResolvedValue(PROTOCOL_RANK_FIXTURE);

      await client.getProtocolRank("proto-1", "season-2026-q1");

      expect(http.get).toHaveBeenCalledWith(
        "/v1/leaderboard/protocols/proto-1",
        { seasonId: "season-2026-q1" },
      );
    });

    it("URL-encodes the protocolId segment", async () => {
      http.get.mockResolvedValue(PROTOCOL_RANK_FIXTURE);

      await client.getProtocolRank("proto/with/slashes");

      expect(http.get).toHaveBeenCalledWith(
        "/v1/leaderboard/protocols/proto%2Fwith%2Fslashes",
        undefined,
      );
    });

    it("preserves string-wire totalPointsIssued and breakdown fields", async () => {
      http.get.mockResolvedValue(PROTOCOL_RANK_FIXTURE);

      const result = await client.getProtocolRank("proto-1");

      expect(typeof result.totalPointsIssued).toBe("string");
      expect(result.totalPointsIssued).toBe("987654321");
      expect(typeof result.breakdown.blink).toBe("string");
      expect(BigInt(result.breakdown.blink)).toBe(487654321n);
    });
  });
});
