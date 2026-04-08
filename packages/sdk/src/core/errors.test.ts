// ---------------------------------------------------------------------------
// @rewardz/sdk — Error Classes Tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  RewardzError,
  RewardzApiError,
  RewardzRpcError,
  RewardzTransactionError,
  RewardzAuthError,
  RewardzTimeoutError,
} from "./errors.js";

/* -------------------------------------------------------------------------- */
/*  RewardzError (base)                                                       */
/* -------------------------------------------------------------------------- */

describe("RewardzError", () => {
  it("stores message and code", () => {
    const err = new RewardzError("something went wrong", "SOME_CODE");
    expect(err.message).toBe("something went wrong");
    expect(err.code).toBe("SOME_CODE");
  });

  it("sets name to RewardzError", () => {
    const err = new RewardzError("msg", "CODE");
    expect(err.name).toBe("RewardzError");
  });

  it("is an instance of Error", () => {
    const err = new RewardzError("msg", "CODE");
    expect(err).toBeInstanceOf(Error);
  });
});

/* -------------------------------------------------------------------------- */
/*  RewardzApiError                                                           */
/* -------------------------------------------------------------------------- */

describe("RewardzApiError", () => {
  it("stores message, status, errorCode, and details", () => {
    const details = { retry_after: 5 };
    const err = new RewardzApiError(
      "rate limited",
      429,
      "RATE_LIMITED",
      details,
    );
    expect(err.message).toBe("rate limited");
    expect(err.status).toBe(429);
    expect(err.errorCode).toBe("RATE_LIMITED");
    expect(err.details).toEqual(details);
  });

  it("sets name to RewardzApiError", () => {
    const err = new RewardzApiError("msg", 400, "BAD_REQUEST");
    expect(err.name).toBe("RewardzApiError");
  });

  it("code is API_ERROR", () => {
    const err = new RewardzApiError("msg", 400, "BAD_REQUEST");
    expect(err.code).toBe("API_ERROR");
  });

  it("is an instance of RewardzError", () => {
    const err = new RewardzApiError("msg", 400, "BAD_REQUEST");
    expect(err).toBeInstanceOf(RewardzError);
  });

  describe("isRateLimited", () => {
    it("is true for status 429", () => {
      const err = new RewardzApiError("rate limited", 429, "RATE_LIMITED");
      expect(err.isRateLimited).toBe(true);
    });

    it("is false for other statuses", () => {
      expect(
        new RewardzApiError("msg", 401, "UNAUTHORIZED").isRateLimited,
      ).toBe(false);
      expect(
        new RewardzApiError("msg", 500, "SERVER_ERROR").isRateLimited,
      ).toBe(false);
    });
  });

  describe("isUnauthorized", () => {
    it("is true for status 401", () => {
      const err = new RewardzApiError("unauthorized", 401, "UNAUTHORIZED");
      expect(err.isUnauthorized).toBe(true);
    });

    it("is false for other statuses", () => {
      expect(new RewardzApiError("msg", 403, "FORBIDDEN").isUnauthorized).toBe(
        false,
      );
      expect(
        new RewardzApiError("msg", 429, "RATE_LIMITED").isUnauthorized,
      ).toBe(false);
    });
  });

  describe("isNotFound", () => {
    it("is true for status 404", () => {
      const err = new RewardzApiError("not found", 404, "NOT_FOUND");
      expect(err.isNotFound).toBe(true);
    });

    it("is false for other statuses", () => {
      expect(new RewardzApiError("msg", 200, "OK").isNotFound).toBe(false);
      expect(new RewardzApiError("msg", 500, "ERROR").isNotFound).toBe(false);
    });
  });

  describe("isServerError", () => {
    it("is true for 500", () => {
      const err = new RewardzApiError("internal error", 500, "INTERNAL_ERROR");
      expect(err.isServerError).toBe(true);
    });

    it("is true for 502, 503, 504", () => {
      expect(new RewardzApiError("msg", 502, "BAD_GATEWAY").isServerError).toBe(
        true,
      );
      expect(new RewardzApiError("msg", 503, "UNAVAILABLE").isServerError).toBe(
        true,
      );
      expect(new RewardzApiError("msg", 504, "TIMEOUT").isServerError).toBe(
        true,
      );
    });

    it("is false for 4xx statuses", () => {
      expect(new RewardzApiError("msg", 400, "BAD_REQUEST").isServerError).toBe(
        false,
      );
      expect(new RewardzApiError("msg", 404, "NOT_FOUND").isServerError).toBe(
        false,
      );
      expect(
        new RewardzApiError("msg", 429, "RATE_LIMITED").isServerError,
      ).toBe(false);
    });
  });

  it("works without optional details argument", () => {
    const err = new RewardzApiError("msg", 400, "BAD_REQUEST");
    expect(err.details).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/*  RewardzRpcError                                                           */
/* -------------------------------------------------------------------------- */

describe("RewardzRpcError", () => {
  it("stores message and rpcCode", () => {
    const err = new RewardzRpcError("rpc failed", -32600);
    expect(err.message).toBe("rpc failed");
    expect(err.rpcCode).toBe(-32600);
  });

  it("sets name to RewardzRpcError", () => {
    const err = new RewardzRpcError("msg");
    expect(err.name).toBe("RewardzRpcError");
  });

  it("code is RPC_ERROR", () => {
    const err = new RewardzRpcError("msg");
    expect(err.code).toBe("RPC_ERROR");
  });

  it("rpcCode is optional", () => {
    const err = new RewardzRpcError("msg");
    expect(err.rpcCode).toBeUndefined();
  });

  it("is an instance of RewardzError", () => {
    expect(new RewardzRpcError("msg")).toBeInstanceOf(RewardzError);
  });
});

/* -------------------------------------------------------------------------- */
/*  RewardzTransactionError                                                   */
/* -------------------------------------------------------------------------- */

describe("RewardzTransactionError", () => {
  it("stores message, signature and logs", () => {
    const logs = ["Program log: err", "Program log: failed"];
    const err = new RewardzTransactionError("tx failed", "abc123sig", logs);
    expect(err.message).toBe("tx failed");
    expect(err.signature).toBe("abc123sig");
    expect(err.logs).toEqual(logs);
  });

  it("sets name to RewardzTransactionError", () => {
    const err = new RewardzTransactionError("msg");
    expect(err.name).toBe("RewardzTransactionError");
  });

  it("code is TRANSACTION_ERROR", () => {
    const err = new RewardzTransactionError("msg");
    expect(err.code).toBe("TRANSACTION_ERROR");
  });

  it("signature and logs are optional", () => {
    const err = new RewardzTransactionError("msg");
    expect(err.signature).toBeUndefined();
    expect(err.logs).toBeUndefined();
  });

  it("is an instance of RewardzError", () => {
    expect(new RewardzTransactionError("msg")).toBeInstanceOf(RewardzError);
  });
});

/* -------------------------------------------------------------------------- */
/*  RewardzAuthError                                                          */
/* -------------------------------------------------------------------------- */

describe("RewardzAuthError", () => {
  it("stores message and reason", () => {
    const err = new RewardzAuthError("token expired", "expired");
    expect(err.message).toBe("token expired");
    expect(err.reason).toBe("expired");
  });

  it("sets name to RewardzAuthError", () => {
    const err = new RewardzAuthError("msg", "invalid");
    expect(err.name).toBe("RewardzAuthError");
  });

  it("code is AUTH_ERROR", () => {
    const err = new RewardzAuthError("msg", "missing");
    expect(err.code).toBe("AUTH_ERROR");
  });

  it("accepts all valid reason values", () => {
    expect(new RewardzAuthError("msg", "expired").reason).toBe("expired");
    expect(new RewardzAuthError("msg", "invalid").reason).toBe("invalid");
    expect(new RewardzAuthError("msg", "missing").reason).toBe("missing");
  });

  it("is an instance of RewardzError", () => {
    expect(new RewardzAuthError("msg", "expired")).toBeInstanceOf(RewardzError);
  });
});

/* -------------------------------------------------------------------------- */
/*  RewardzTimeoutError                                                       */
/* -------------------------------------------------------------------------- */

describe("RewardzTimeoutError", () => {
  it("stores message and timeoutMs", () => {
    const err = new RewardzTimeoutError("request timed out", 30000);
    expect(err.message).toBe("request timed out");
    expect(err.timeoutMs).toBe(30000);
  });

  it("sets name to RewardzTimeoutError", () => {
    const err = new RewardzTimeoutError("msg", 5000);
    expect(err.name).toBe("RewardzTimeoutError");
  });

  it("code is TIMEOUT_ERROR", () => {
    const err = new RewardzTimeoutError("msg", 5000);
    expect(err.code).toBe("TIMEOUT_ERROR");
  });

  it("is an instance of RewardzError", () => {
    expect(new RewardzTimeoutError("msg", 5000)).toBeInstanceOf(RewardzError);
  });
});
