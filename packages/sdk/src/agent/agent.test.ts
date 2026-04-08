// ---------------------------------------------------------------------------
// @rewardz/sdk/agent — AgentDelegationClient Tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  API_DELEGATIONS,
  API_DELEGATIONS_BY_ID,
  API_DELEGATIONS_TRIGGERS,
  API_DELEGATIONS_TRIGGER_BY_ID,
  API_DELEGATIONS_AUDIT_LOG,
} from "@rewardz/types";

// ---------------------------------------------------------------------------
// Mock HttpClient — must be hoisted before the import of AgentDelegationClient
// so vitest replaces the module before it is loaded.
// ---------------------------------------------------------------------------

const mockHttpInstance = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  setAuthHeaders: vi.fn(),
};

vi.mock("../core/http.js", () => ({
  HttpClient: vi.fn(() => mockHttpInstance),
}));

// Import AFTER the mock is registered
import { AgentDelegationClient } from "./index.js";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function makeClient() {
  return new AgentDelegationClient({
    token: "test-jwt-token",
    apiBaseUrl: "https://api.rewardz.xyz",
    timeoutMs: 5000,
  });
}

function makeDelegationConfig() {
  return {
    agentId: "agent-001",
    permissions: { swap: true, stake: false },
    maxSpendPerAction: 100,
    dailyLimit: 500,
    allowedActions: ["swap" as never],
    expiresAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function mockDelegation(id = "del-1") {
  return {
    delegationId: id,
    wallet: "wallet123",
    agentId: "agent-001",
    permissions: { swap: true, stake: false },
    triggers: [],
    status: "active" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/* -------------------------------------------------------------------------- */
/*  Reset mocks before each test                                              */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  vi.clearAllMocks();
  // BearerAuth.getHeaders returns the Authorization header; satisfy ensureAuth
  mockHttpInstance.setAuthHeaders.mockResolvedValue(undefined);
});

/* -------------------------------------------------------------------------- */
/*  createDelegation                                                          */
/* -------------------------------------------------------------------------- */

describe("AgentDelegationClient.createDelegation", () => {
  it("calls POST to API_DELEGATIONS with correct API-shaped body", async () => {
    const client = makeClient();
    const config = makeDelegationConfig();
    const delegation = mockDelegation();
    mockHttpInstance.post.mockResolvedValue(delegation);

    const result = await client.createDelegation(config);

    expect(mockHttpInstance.post).toHaveBeenCalledWith(API_DELEGATIONS, {
      agent_id: "agent-001",
      permissions: { swap: true, stake: false },
      constraints: {
        max_spend_per_action: 100,
        daily_limit: 500,
        allowed_actions: ["swap"],
      },
      expires_at: "2026-01-01T00:00:00.000Z",
    });
    expect(result).toEqual(delegation);
  });

  it("converts expiresAt Date to ISO string", async () => {
    const client = makeClient();
    const expiresAt = new Date("2025-06-15T12:30:00.000Z");
    mockHttpInstance.post.mockResolvedValue(mockDelegation());

    await client.createDelegation({ ...makeDelegationConfig(), expiresAt });

    const callBody = mockHttpInstance.post.mock.calls[0][1];
    expect(callBody.expires_at).toBe("2025-06-15T12:30:00.000Z");
  });

  it("maps SDK field names to snake_case API field names", async () => {
    const client = makeClient();
    mockHttpInstance.post.mockResolvedValue(mockDelegation());

    await client.createDelegation(makeDelegationConfig());

    const callBody = mockHttpInstance.post.mock.calls[0][1];
    // SDK uses camelCase; API expects snake_case
    expect(callBody).toHaveProperty("agent_id");
    expect(callBody).toHaveProperty("expires_at");
    expect(callBody.constraints).toHaveProperty("max_spend_per_action");
    expect(callBody.constraints).toHaveProperty("daily_limit");
    expect(callBody.constraints).toHaveProperty("allowed_actions");
    // Must NOT have raw SDK field names at top level
    expect(callBody).not.toHaveProperty("agentId");
    expect(callBody).not.toHaveProperty("expiresAt");
    expect(callBody).not.toHaveProperty("maxSpendPerAction");
  });
});

/* -------------------------------------------------------------------------- */
/*  listDelegations                                                           */
/* -------------------------------------------------------------------------- */

describe("AgentDelegationClient.listDelegations", () => {
  it("calls GET to API_DELEGATIONS and unwraps delegations array", async () => {
    const client = makeClient();
    const delegations = [mockDelegation("del-1"), mockDelegation("del-2")];
    mockHttpInstance.get.mockResolvedValue({
      delegations,
      pagination: { limit: 20, offset: 0, total: 2 },
    });

    const result = await client.listDelegations();

    expect(mockHttpInstance.get).toHaveBeenCalledWith(API_DELEGATIONS);
    expect(result).toEqual(delegations);
  });
});

/* -------------------------------------------------------------------------- */
/*  getDelegation                                                             */
/* -------------------------------------------------------------------------- */

describe("AgentDelegationClient.getDelegation", () => {
  it("calls GET to interpolated delegation path", async () => {
    const client = makeClient();
    const delegation = mockDelegation("del-42");
    mockHttpInstance.get.mockResolvedValue(delegation);

    const result = await client.getDelegation("del-42");

    // API_DELEGATIONS_BY_ID = "/v1/delegations/:id" — :id should be replaced
    expect(mockHttpInstance.get).toHaveBeenCalledWith("/v1/delegations/del-42");
    expect(result).toEqual(delegation);
  });

  it("URL-encodes the delegation ID", async () => {
    const client = makeClient();
    mockHttpInstance.get.mockResolvedValue(mockDelegation());

    await client.getDelegation("del/special id");

    const calledPath = mockHttpInstance.get.mock.calls[0][0];
    expect(calledPath).toContain("del%2Fspecial%20id");
  });
});

/* -------------------------------------------------------------------------- */
/*  updateDelegation                                                          */
/* -------------------------------------------------------------------------- */

describe("AgentDelegationClient.updateDelegation", () => {
  it("calls PATCH to interpolated path with permissions when provided", async () => {
    const client = makeClient();
    mockHttpInstance.patch.mockResolvedValue(mockDelegation());

    await client.updateDelegation("del-1", {
      permissions: { swap: false, stake: true },
    });

    expect(mockHttpInstance.patch).toHaveBeenCalledWith(
      "/v1/delegations/del-1",
      {
        permissions: { swap: false, stake: true },
      },
    );
  });

  it("converts expiresAt Date to ISO string (bug-regression: must be string not Date)", async () => {
    const client = makeClient();
    mockHttpInstance.patch.mockResolvedValue(mockDelegation());
    const newExpiry = new Date("2027-03-01T00:00:00.000Z");

    await client.updateDelegation("del-1", { expiresAt: newExpiry });

    const callBody = mockHttpInstance.patch.mock.calls[0][1];
    expect(callBody.expires_at).toBe("2027-03-01T00:00:00.000Z");
    expect(callBody.expires_at).not.toBeInstanceOf(Date);
  });

  it("maps constraint fields into nested constraints object (bug-regression)", async () => {
    const client = makeClient();
    mockHttpInstance.patch.mockResolvedValue(mockDelegation());

    await client.updateDelegation("del-1", {
      maxSpendPerAction: 250,
      dailyLimit: 1000,
      allowedActions: ["stake" as never],
    });

    const callBody = mockHttpInstance.patch.mock.calls[0][1];
    // Must be nested under constraints, NOT at top level
    expect(callBody).toHaveProperty("constraints");
    expect(callBody.constraints).toEqual({
      max_spend_per_action: 250,
      daily_limit: 1000,
      allowed_actions: ["stake"],
    });
    expect(callBody).not.toHaveProperty("maxSpendPerAction");
    expect(callBody).not.toHaveProperty("dailyLimit");
    expect(callBody).not.toHaveProperty("allowedActions");
  });

  it("omits constraints object when no constraint fields are updated", async () => {
    const client = makeClient();
    mockHttpInstance.patch.mockResolvedValue(mockDelegation());

    await client.updateDelegation("del-1", {
      permissions: { swap: true },
    });

    const callBody = mockHttpInstance.patch.mock.calls[0][1];
    expect(callBody).not.toHaveProperty("constraints");
  });

  it("omits permissions when not in update", async () => {
    const client = makeClient();
    mockHttpInstance.patch.mockResolvedValue(mockDelegation());

    await client.updateDelegation("del-1", { dailyLimit: 300 });

    const callBody = mockHttpInstance.patch.mock.calls[0][1];
    expect(callBody).not.toHaveProperty("permissions");
  });

  it("omits expires_at when not in update", async () => {
    const client = makeClient();
    mockHttpInstance.patch.mockResolvedValue(mockDelegation());

    await client.updateDelegation("del-1", { dailyLimit: 300 });

    const callBody = mockHttpInstance.patch.mock.calls[0][1];
    expect(callBody).not.toHaveProperty("expires_at");
  });
});

/* -------------------------------------------------------------------------- */
/*  revokeDelegation                                                          */
/* -------------------------------------------------------------------------- */

describe("AgentDelegationClient.revokeDelegation", () => {
  it("calls DELETE to interpolated delegation path", async () => {
    const client = makeClient();
    mockHttpInstance.delete.mockResolvedValue({
      delegation_id: "del-1",
      status: "revoked",
    });

    await client.revokeDelegation("del-1");

    expect(mockHttpInstance.delete).toHaveBeenCalledWith(
      "/v1/delegations/del-1",
    );
  });

  it("resolves to void (discards API response)", async () => {
    const client = makeClient();
    mockHttpInstance.delete.mockResolvedValue({
      delegation_id: "del-2",
      status: "revoked",
    });

    const result = await client.revokeDelegation("del-2");

    expect(result).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/*  addTrigger                                                                */
/* -------------------------------------------------------------------------- */

describe("AgentDelegationClient.addTrigger", () => {
  it("calls POST to interpolated triggers path with type and config", async () => {
    const client = makeClient();
    const mockTrigger = {
      triggerId: "trig-1",
      type: "price" as never,
      config: { threshold: 100 },
      enabled: true,
    };
    mockHttpInstance.post.mockResolvedValue(mockTrigger);

    const result = await client.addTrigger("del-1", {
      type: "price" as never,
      config: { threshold: 100 },
    });

    expect(mockHttpInstance.post).toHaveBeenCalledWith(
      "/v1/delegations/del-1/triggers",
      {
        type: "price",
        config: { threshold: 100 },
      },
    );
    expect(result).toEqual(mockTrigger);
  });
});

/* -------------------------------------------------------------------------- */
/*  removeTrigger                                                             */
/* -------------------------------------------------------------------------- */

describe("AgentDelegationClient.removeTrigger", () => {
  it("calls DELETE to interpolated trigger path (delegation + trigger IDs)", async () => {
    const client = makeClient();
    mockHttpInstance.delete.mockResolvedValue({
      trigger_id: "trig-1",
      enabled: false,
    });

    await client.removeTrigger("del-1", "trig-1");

    expect(mockHttpInstance.delete).toHaveBeenCalledWith(
      "/v1/delegations/del-1/triggers/trig-1",
    );
  });

  it("resolves to void (discards API response)", async () => {
    const client = makeClient();
    mockHttpInstance.delete.mockResolvedValue({
      trigger_id: "t",
      enabled: false,
    });

    const result = await client.removeTrigger("del-1", "trig-1");

    expect(result).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/*  getAuditLog                                                               */
/* -------------------------------------------------------------------------- */

describe("AgentDelegationClient.getAuditLog", () => {
  it("calls GET to interpolated audit-log path and unwraps audit_log array", async () => {
    const client = makeClient();
    const entries = [
      {
        entryId: "e-1",
        delegationId: "del-1",
        action: "created",
        timestamp: new Date(),
        details: {},
      },
      {
        entryId: "e-2",
        delegationId: "del-1",
        action: "updated",
        timestamp: new Date(),
        details: {},
      },
    ];
    mockHttpInstance.get.mockResolvedValue({
      audit_log: entries,
      pagination: { page: 1, limit: 20, total: 2, total_pages: 1 },
    });

    const result = await client.getAuditLog("del-1");

    expect(mockHttpInstance.get).toHaveBeenCalledWith(
      "/v1/delegations/del-1/audit-log",
    );
    expect(result).toEqual(entries);
  });
});
