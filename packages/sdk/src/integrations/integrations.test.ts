// ---------------------------------------------------------------------------
// @rewardz/sdk/integrations — TweetClient, TweetConfig, AwardPointsConfig,
// ZealyConfig Tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HttpClient } from "../core/http.js";
import { TweetClient, TweetConfig } from "./tweets.js";
import { AwardPointsConfig } from "./award-points.js";
import { ZealyConfig } from "./zealy.js";
import {
  API_TWEETS_SUBMIT,
  API_TWEETS_SUBMISSIONS,
  API_TWEETS_RULES,
  API_TWEETS_CAMPAIGNS,
  API_POINTS_AWARD,
  API_POINTS_AWARD_BATCH,
  API_POINTS_BUDGET,
  API_ZEALY_SPACES,
  API_WEBHOOKS_ZEALY,
} from "@rewardz/types";

/* -------------------------------------------------------------------------- */
/*  Mock HttpClient factory                                                   */
/* -------------------------------------------------------------------------- */

function makeMockHttp(): jest.Mocked<HttpClient> {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    setAuthHeaders: vi.fn(),
  } as unknown as jest.Mocked<HttpClient>;
}

// Use vitest's mock type
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
/*  TweetClient                                                               */
/* -------------------------------------------------------------------------- */

describe("TweetClient", () => {
  let http: MockedHttp & HttpClient;
  let client: TweetClient;

  beforeEach(() => {
    http = makeMock();
    client = new TweetClient(http);
  });

  describe("submit", () => {
    it("calls POST to API_TWEETS_SUBMIT with correct body", async () => {
      const mockSubmission = { id: "sub-1", status: "pending" };
      http.post.mockResolvedValue(mockSubmission);

      const result = await client.submit(
        "https://x.com/user/status/123",
        "wallet123",
        "protocol-abc",
      );

      expect(http.post).toHaveBeenCalledWith(API_TWEETS_SUBMIT, {
        tweet_url: "https://x.com/user/status/123",
        wallet_address: "wallet123",
        protocol_id: "protocol-abc",
      });
      expect(result).toEqual(mockSubmission);
    });

    it("calls POST without protocol_id when omitted", async () => {
      http.post.mockResolvedValue({ id: "sub-2" });

      await client.submit("https://x.com/user/status/456", "wallet456");

      expect(http.post).toHaveBeenCalledWith(API_TWEETS_SUBMIT, {
        tweet_url: "https://x.com/user/status/456",
        wallet_address: "wallet456",
        protocol_id: undefined,
      });
    });
  });

  describe("getStatus", () => {
    it("calls GET with the correct interpolated path", async () => {
      const mockSubmission = { id: "sub-1", status: "verified" };
      http.get.mockResolvedValue(mockSubmission);

      const result = await client.getStatus("sub-1");

      expect(http.get).toHaveBeenCalledWith("/v1/tweets/status/sub-1");
      expect(result).toEqual(mockSubmission);
    });
  });

  describe("listSubmissions", () => {
    it("calls GET to API_TWEETS_SUBMISSIONS with wallet param", async () => {
      const mockResponse = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false,
      };
      http.get.mockResolvedValue(mockResponse);

      const result = await client.listSubmissions("wallet123");

      expect(http.get).toHaveBeenCalledWith(API_TWEETS_SUBMISSIONS, {
        wallet: "wallet123",
      });
      expect(result).toEqual(mockResponse);
    });

    it("includes limit param when provided", async () => {
      http.get.mockResolvedValue({ data: [] });

      await client.listSubmissions("wallet123", { limit: 10 });

      expect(http.get).toHaveBeenCalledWith(API_TWEETS_SUBMISSIONS, {
        wallet: "wallet123",
        limit: "10",
      });
    });

    it("converts page to offset using limit", async () => {
      http.get.mockResolvedValue({ data: [] });

      await client.listSubmissions("wallet123", { page: 3, limit: 10 });

      expect(http.get).toHaveBeenCalledWith(API_TWEETS_SUBMISSIONS, {
        wallet: "wallet123",
        limit: "10",
        offset: "20", // (page 3 - 1) * limit 10 = 20
      });
    });

    it("uses default limit of 20 when page provided without limit", async () => {
      http.get.mockResolvedValue({ data: [] });

      await client.listSubmissions("wallet123", { page: 2 });

      expect(http.get).toHaveBeenCalledWith(API_TWEETS_SUBMISSIONS, {
        wallet: "wallet123",
        offset: "20", // (2-1) * 20
      });
    });
  });

  describe("listRules", () => {
    it("calls GET to API_TWEETS_RULES and unwraps rules array", async () => {
      const rules = [{ ruleId: "r-1" }, { ruleId: "r-2" }];
      http.get.mockResolvedValue({ rules });

      const result = await client.listRules();

      expect(http.get).toHaveBeenCalledWith(API_TWEETS_RULES, {});
      expect(result).toEqual(rules);
    });

    it("passes protocolId filter when provided", async () => {
      http.get.mockResolvedValue({ rules: [] });

      await client.listRules("protocol-xyz");

      expect(http.get).toHaveBeenCalledWith(API_TWEETS_RULES, {
        protocolId: "protocol-xyz",
      });
    });
  });
});

/* -------------------------------------------------------------------------- */
/*  TweetConfig                                                               */
/* -------------------------------------------------------------------------- */

describe("TweetConfig", () => {
  let http: MockedHttp & HttpClient;
  let config: TweetConfig;

  beforeEach(() => {
    http = makeMock();
    config = new TweetConfig(http);
  });

  describe("configureCampaign", () => {
    it("calls POST to API_TWEETS_CAMPAIGNS with full config", async () => {
      const campaignConfig = {
        hashtags: ["#rewardz"],
        mentions: ["@rewardz"],
        cashtags: ["$RWZ"],
        basePoints: 100,
        bonusPerLike: 5,
        allRequired: true,
      };
      const mockRule = { ruleId: "rule-1", ...campaignConfig };
      http.post.mockResolvedValue(mockRule);

      const result = await config.configureCampaign(campaignConfig);

      expect(http.post).toHaveBeenCalledWith(
        API_TWEETS_CAMPAIGNS,
        campaignConfig,
      );
      expect(result).toEqual(mockRule);
    });

    it("works with minimal config (only basePoints)", async () => {
      const minConfig = { basePoints: 50 };
      http.post.mockResolvedValue({ ruleId: "rule-2", basePoints: 50 });

      await config.configureCampaign(minConfig);

      expect(http.post).toHaveBeenCalledWith(API_TWEETS_CAMPAIGNS, minConfig);
    });
  });

  describe("listCampaigns", () => {
    it("calls GET to API_TWEETS_CAMPAIGNS and unwraps rules array", async () => {
      const rules = [{ ruleId: "r-1" }, { ruleId: "r-2" }];
      http.get.mockResolvedValue({ rules });

      const result = await config.listCampaigns();

      expect(http.get).toHaveBeenCalledWith(API_TWEETS_CAMPAIGNS);
      expect(result).toEqual(rules);
    });
  });

  describe("updateCampaign", () => {
    it("calls PATCH to interpolated campaign path with update body", async () => {
      const update = { basePoints: 200, allRequired: false };
      const mockRule = { ruleId: "rule-1", basePoints: 200 };
      http.patch.mockResolvedValue(mockRule);

      const result = await config.updateCampaign("rule-1", update);

      expect(http.patch).toHaveBeenCalledWith(
        "/v1/tweets/campaigns/rule-1",
        update,
      );
      expect(result).toEqual(mockRule);
    });
  });
});

/* -------------------------------------------------------------------------- */
/*  AwardPointsConfig                                                         */
/* -------------------------------------------------------------------------- */

describe("AwardPointsConfig", () => {
  let http: MockedHttp & HttpClient;
  let awardConfig: AwardPointsConfig;

  beforeEach(() => {
    http = makeMock();
    awardConfig = new AwardPointsConfig(http);
  });

  describe("awardPoints", () => {
    it("calls POST to API_POINTS_AWARD with correct body", async () => {
      const mockResult = { wallet_address: "wallet1", points_awarded: 100 };
      http.post.mockResolvedValue(mockResult);

      const result = await awardConfig.awardPoints(
        "wallet1",
        100,
        "quest completion",
        "idem-key-1",
      );

      expect(http.post).toHaveBeenCalledWith(API_POINTS_AWARD, {
        wallet_address: "wallet1",
        amount: 100,
        reason: "quest completion",
        idempotency_key: "idem-key-1",
      });
      expect(result).toEqual(mockResult);
    });

    it("includes undefined idempotency_key when not provided", async () => {
      http.post.mockResolvedValue({});

      await awardConfig.awardPoints("wallet2", 50, "referral");

      expect(http.post).toHaveBeenCalledWith(API_POINTS_AWARD, {
        wallet_address: "wallet2",
        amount: 50,
        reason: "referral",
        idempotency_key: undefined,
      });
    });
  });

  describe("awardBatch", () => {
    it("calls POST to API_POINTS_AWARD_BATCH and maps SDK fields to API fields", async () => {
      const awards = [
        {
          wallet: "wallet1",
          amount: 100,
          reason: "task A",
          idempotencyKey: "key-1",
        },
        {
          wallet: "wallet2",
          amount: 200,
          reason: "task B",
          idempotencyKey: "key-2",
        },
      ];
      const mockResults = [
        { wallet_address: "wallet1", points_awarded: 100 },
        { wallet_address: "wallet2", points_awarded: 200 },
      ];
      http.post.mockResolvedValue({ results: mockResults });

      const result = await awardConfig.awardBatch(awards);

      expect(http.post).toHaveBeenCalledWith(API_POINTS_AWARD_BATCH, {
        awards: [
          {
            wallet_address: "wallet1",
            amount: 100,
            reason: "task A",
            idempotency_key: "key-1",
          },
          {
            wallet_address: "wallet2",
            amount: 200,
            reason: "task B",
            idempotency_key: "key-2",
          },
        ],
      });
      expect(result).toEqual(mockResults);
    });

    it("unwraps the results array from the API response", async () => {
      http.post.mockResolvedValue({ results: [{ wallet_address: "w1" }] });

      const result = await awardConfig.awardBatch([
        { wallet: "w1", amount: 10, idempotencyKey: "k1" },
      ]);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });
  });

  describe("getBudget", () => {
    it("calls GET to API_POINTS_BUDGET and returns budget", async () => {
      const mockBudget = {
        remaining: 5000,
        daily_limit: 10000,
        monthly_limit: 100000,
      };
      http.get.mockResolvedValue(mockBudget);

      const result = await awardConfig.getBudget();

      expect(http.get).toHaveBeenCalledWith(API_POINTS_BUDGET);
      expect(result).toEqual(mockBudget);
    });
  });
});

/* -------------------------------------------------------------------------- */
/*  ZealyConfig                                                               */
/* -------------------------------------------------------------------------- */

describe("ZealyConfig", () => {
  let http: MockedHttp & HttpClient;
  let zealyConfig: ZealyConfig;

  beforeEach(() => {
    http = makeMock();
    zealyConfig = new ZealyConfig(http);
  });

  describe("configureSpace", () => {
    it("calls POST to API_ZEALY_SPACES with space config", async () => {
      const spaceConfig = {
        spaceId: "space-123",
        webhookSecret: "secret-abc",
        questMappings: { "quest-1": "100", "quest-2": "200" },
      };
      const mockIntegration = { spaceId: "space-123", status: "active" };
      http.post.mockResolvedValue(mockIntegration);

      const result = await zealyConfig.configureSpace(spaceConfig);

      expect(http.post).toHaveBeenCalledWith(API_ZEALY_SPACES, spaceConfig);
      expect(result).toEqual(mockIntegration);
    });

    it("works without optional questMappings", async () => {
      const spaceConfig = {
        spaceId: "space-456",
        webhookSecret: "secret-xyz",
      };
      http.post.mockResolvedValue({ spaceId: "space-456" });

      await zealyConfig.configureSpace(spaceConfig);

      expect(http.post).toHaveBeenCalledWith(API_ZEALY_SPACES, spaceConfig);
    });
  });

  describe("updateMappings", () => {
    it("calls PATCH to interpolated space mappings path", async () => {
      http.patch.mockResolvedValue(undefined);

      await zealyConfig.updateMappings("space-123", {
        "quest-1": "150",
        "quest-3": "300",
      });

      expect(http.patch).toHaveBeenCalledWith(
        "/v1/zealy/spaces/space-123/mappings",
        { questMappings: { "quest-1": "150", "quest-3": "300" } },
      );
    });
  });

  describe("getWebhookUrl", () => {
    it("returns the Zealy webhook URL constant", () => {
      const url = zealyConfig.getWebhookUrl();
      expect(url).toBe(API_WEBHOOKS_ZEALY);
      expect(url).toBe("/v1/webhooks/zealy");
    });
  });
});
