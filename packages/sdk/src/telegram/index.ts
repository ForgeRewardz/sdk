// ---------------------------------------------------------------------------
// @rewardz/sdk/telegram — TelegramRewardzClient
//
// Extends RewardzClient with Telegram-specific endpoints and formatting
// helpers. Uses dual auth: wallet auth (inherited) for user-facing endpoints,
// internal key auth for Telegram-specific admin endpoints.
//
// Usage:
//   import { TelegramRewardzClient } from "@rewardz/sdk/telegram";
//
//   const client = new TelegramRewardzClient({
//     rpcUrl: "https://api.mainnet-beta.solana.com",
//     apiBaseUrl: "https://api.rewardz.xyz",
//     wallet: walletAdapter,
//     internalKey: "sk_internal_...",
//   });
//
//   await client.registerTelegramUser("123456", "wallet_address");
// ---------------------------------------------------------------------------

import { RewardzClient, type RewardzClientConfig } from "../client/index.js";
import { InternalKeyAuth } from "../core/auth.js";
import { HttpClient } from "../core/http.js";
import { API_TELEGRAM_USERS, API_TELEGRAM_USER_BY_ID } from "@rewardz/types";

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

export interface TelegramRewardzClientConfig extends RewardzClientConfig {
  /** Internal service key for Telegram-specific endpoints. */
  internalKey: string;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Replace `:param` placeholders in route templates with actual values.
 *
 * Example: pathWithParams("/v1/telegram/users/:telegram_id", { telegram_id: "123" })
 *       => "/v1/telegram/users/123"
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
/*  Response types                                                            */
/* -------------------------------------------------------------------------- */

/** Response from POST /v1/telegram/users (register). */
export interface TelegramUserResponse {
  telegram_id: string;
  wallet: string;
}

/** Response from GET /v1/telegram/users/:telegram_id. */
export interface TelegramUserLookupResponse {
  telegram_id: string;
  wallet: string;
}

/* -------------------------------------------------------------------------- */
/*  TelegramRewardzClient                                                     */
/* -------------------------------------------------------------------------- */

export class TelegramRewardzClient extends RewardzClient {
  private readonly internalHttp: HttpClient;
  private readonly internalAuth: InternalKeyAuth;

  constructor(config: TelegramRewardzClientConfig) {
    super(config);

    this.internalAuth = new InternalKeyAuth(config.internalKey);
    this.internalHttp = new HttpClient({
      baseUrl: config.apiBaseUrl,
      timeoutMs: config.timeoutMs,
    });

    // Apply internal key headers immediately (InternalKeyAuth is synchronous).
    this.internalHttp.setAuthHeaders({ "x-api-key": config.internalKey });
  }

  /* ── Telegram User Management ──────────────────────────────────────────── */

  /**
   * Register a Telegram user with an associated wallet address.
   *
   * Maps to `POST /v1/telegram/users`.
   * Uses internal key auth.
   *
   * @param telegramId  The Telegram user ID.
   * @param wallet      The Solana wallet address to associate.
   * @returns The registered Telegram user record.
   */
  async registerTelegramUser(
    telegramId: string,
    wallet: string,
  ): Promise<TelegramUserResponse> {
    return this.internalHttp.post<TelegramUserResponse>(API_TELEGRAM_USERS, {
      telegram_id: telegramId,
      wallet,
    });
  }

  /**
   * Look up a wallet address by Telegram user ID.
   *
   * Maps to `GET /v1/telegram/users/:telegram_id`.
   * Uses internal key auth.
   *
   * @param telegramId  The Telegram user ID to look up.
   * @returns The Telegram user record including wallet address.
   */
  async getWalletByTelegramId(
    telegramId: string,
  ): Promise<TelegramUserLookupResponse> {
    const path = pathWithParams(API_TELEGRAM_USER_BY_ID, {
      telegram_id: telegramId,
    });
    return this.internalHttp.get<TelegramUserLookupResponse>(path);
  }

  /**
   * Get the points balance for a Telegram user.
   *
   * Looks up the wallet by Telegram ID, then fetches the points balance
   * using the inherited wallet-auth getPointsBalance method.
   *
   * @param telegramId  The Telegram user ID.
   * @returns Points balance for the associated wallet.
   */
  async getTelegramUserPoints(telegramId: string) {
    const user = await this.getWalletByTelegramId(telegramId);
    return this.getPointsBalance(user.wallet);
  }
}

/* -------------------------------------------------------------------------- */
/*  Message Formatting Helpers                                                */
/* -------------------------------------------------------------------------- */

/**
 * Format a points balance for display in Telegram messages.
 *
 * @param balance  Object with `total_earned` and `usable_balance` strings.
 * @returns Formatted string like "💰 1,234 pts (earned: 5,678)".
 */
export function formatPointsDisplay(balance: {
  total_earned: string;
  usable_balance: string;
}): string {
  const usable = formatNumber(balance.usable_balance);
  const earned = formatNumber(balance.total_earned);
  return `💰 ${usable} pts (earned: ${earned})`;
}

/**
 * Format an offer summary for display in Telegram messages.
 *
 * @param offer  Object with `protocol_name`, `action_type`, and `points_per_completion`.
 * @returns Formatted offer string.
 */
export function formatOfferSummary(offer: {
  protocol_name: string;
  action_type: string;
  points_per_completion: number;
}): string {
  const points = formatNumber(String(offer.points_per_completion));
  return `${offer.protocol_name} — ${offer.action_type} (+${points} pts)`;
}

/**
 * Format quest progress for display in Telegram messages.
 *
 * Renders a progress bar showing completed vs total steps.
 *
 * @param progress    Object with `steps_completed` array and `completed` flag.
 * @param totalSteps  Total number of steps in the quest.
 * @returns Progress bar string like "[████░░░░░░] 4/10".
 */
export function formatQuestProgress(
  progress: { steps_completed: number[]; completed: boolean },
  totalSteps: number,
): string {
  const completed = progress.steps_completed.length;

  if (progress.completed) {
    const bar = "█".repeat(totalSteps);
    return `[${bar}] ${totalSteps}/${totalSteps} ✅`;
  }

  const filledCount = Math.min(completed, totalSteps);
  const emptyCount = totalSteps - filledCount;
  const bar = "█".repeat(filledCount) + "░".repeat(emptyCount);
  return `[${bar}] ${completed}/${totalSteps}`;
}

/* -------------------------------------------------------------------------- */
/*  Internal Helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Format a numeric string with thousand separators.
 *
 * Handles both integer strings ("1234") and decimal strings ("1234.56").
 */
function formatNumber(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num.toLocaleString("en-US");
}
