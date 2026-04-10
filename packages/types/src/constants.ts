// ---------------------------------------------------------------------------
// @rewardz/types — Constants
//
// API path constants, PDA seeds, and default config values.
// ---------------------------------------------------------------------------

// ── API Path Constants ─────────────────────────────────────────────────────
// All 41 endpoints from the API route files, prefixed with /v1.

// Health
export const API_HEALTHZ = "/v1/healthz" as const;

// Intents
export const API_INTENTS_RESOLVE = "/v1/intents/resolve" as const;

// Offers
export const API_OFFERS = "/v1/offers" as const;

// Completions
export const API_COMPLETIONS_INIT = "/v1/completions/init" as const;
export const API_COMPLETIONS_CALLBACK = "/v1/completions/callback" as const;
export const API_COMPLETIONS_BY_ID = "/v1/completions/:id" as const;

// Points
export const API_POINTS_BALANCE = "/v1/points/balance" as const;
export const API_POINTS_HISTORY = "/v1/points/history" as const;
export const API_POINTS_CLAIM_PROOF = "/v1/points/claim-proof" as const;
export const API_POINTS_AWARD = "/v1/points/award" as const;
export const API_POINTS_AWARD_BATCH = "/v1/points/award/batch" as const;

// Protocols
export const API_PROTOCOLS_REGISTER = "/v1/protocols/register" as const;
export const API_PROTOCOLS = "/v1/protocols" as const;
export const API_PROTOCOLS_BY_ID = "/v1/protocols/:id" as const;
export const API_PROTOCOLS_QUESTS = "/v1/protocols/:id/quests" as const;

// Subscriptions
export const API_SUBSCRIPTIONS = "/v1/subscriptions" as const;
export const API_SUBSCRIPTIONS_BY_ID = "/v1/subscriptions/:id" as const;
export const API_SUBSCRIPTIONS_STREAK = "/v1/subscriptions/:id/streak" as const;

// Quests
export const API_QUESTS = "/v1/quests" as const;
export const API_QUESTS_BY_ID = "/v1/quests/:id" as const;
export const API_QUESTS_JOIN = "/v1/quests/:id/join" as const;
export const API_QUESTS_PROGRESS = "/v1/quests/:id/progress" as const;
export const API_QUESTS_STEP_COMPLETE =
  "/v1/quests/:id/steps/:stepIndex/complete" as const;
export const API_QUESTS_MY = "/v1/quests/my" as const;

// Delegations
export const API_DELEGATIONS = "/v1/delegations" as const;
export const API_DELEGATIONS_BY_ID = "/v1/delegations/:id" as const;
export const API_DELEGATIONS_TRIGGERS = "/v1/delegations/:id/triggers" as const;
export const API_DELEGATIONS_TRIGGER_BY_ID =
  "/v1/delegations/:id/triggers/:tid" as const;
export const API_DELEGATIONS_AUDIT_LOG =
  "/v1/delegations/:id/audit-log" as const;

// Tweets
export const API_TWEETS_SUBMIT = "/v1/tweets/submit" as const;
export const API_TWEETS_STATUS = "/v1/tweets/status/:submission_id" as const;
export const API_TWEETS_SUBMISSIONS = "/v1/tweets/submissions" as const;
export const API_TWEETS_RULES = "/v1/tweets/rules" as const;
export const API_TWEETS_CAMPAIGNS = "/v1/tweets/campaigns" as const;
export const API_TWEETS_CAMPAIGNS_BY_ID =
  "/v1/tweets/campaigns/:rule_id" as const;

// Points (protocol-facing)
export const API_POINTS_BUDGET = "/v1/points/budget" as const;

// Telegram
export const API_TELEGRAM_USERS = "/v1/telegram/users" as const;
export const API_TELEGRAM_USER_BY_ID =
  "/v1/telegram/users/:telegram_id" as const;

// Zealy
export const API_WEBHOOKS_ZEALY = "/v1/webhooks/zealy" as const;
export const API_ZEALY_SPACES = "/v1/zealy/spaces" as const;
export const API_ZEALY_SPACES_MAPPINGS =
  "/v1/zealy/spaces/:space_id/mappings" as const;

// Leaderboard
export const API_LEADERBOARD_SEASON = "/v1/leaderboard/season" as const;
export const API_LEADERBOARD_PROTOCOLS = "/v1/leaderboard/protocols" as const;
export const API_LEADERBOARD_PROTOCOLS_BY_ID =
  "/v1/leaderboard/protocols/:id" as const;
export const API_LEADERBOARD_USERS = "/v1/leaderboard/users" as const;
export const API_LEADERBOARD_ME = "/v1/leaderboard/me" as const;

// Auth (Phase 5 — protocol console wallet auth)
export const API_AUTH_CHALLENGE = "/v1/auth/challenge" as const;
export const API_AUTH_VERIFY = "/v1/auth/verify" as const;
export const API_AUTH_LOGOUT = "/v1/auth/logout" as const;

// Admin — leaderboards
export const API_ADMIN_LEADERBOARD_SNAPSHOT =
  "/v1/admin/leaderboards/snapshot" as const;
export const API_ADMIN_LEADERBOARD_SNAPSHOT_BY_SEASON =
  "/v1/admin/leaderboards/snapshot/:seasonId" as const;

// Admin — protocol lifecycle controls
export const API_ADMIN_PROTOCOL_PAUSE =
  "/v1/admin/protocols/:id/pause" as const;
export const API_ADMIN_PROTOCOL_RESUME =
  "/v1/admin/protocols/:id/resume" as const;
export const API_ADMIN_PROTOCOL_SLASH =
  "/v1/admin/protocols/:id/slash" as const;
export const API_ADMIN_PROTOCOL_COOLDOWN =
  "/v1/admin/protocols/:id/cooldown" as const;

// Admin — campaign lifecycle controls
export const API_ADMIN_CAMPAIGN_PAUSE =
  "/v1/admin/campaigns/:id/pause" as const;
export const API_ADMIN_CAMPAIGN_RESUME =
  "/v1/admin/campaigns/:id/resume" as const;

// Protocol — campaigns CRUD
export const API_PROTOCOL_CAMPAIGNS = "/v1/protocols/:id/campaigns" as const;
export const API_PROTOCOL_CAMPAIGN_BY_ID =
  "/v1/protocols/:id/campaigns/:campaignId" as const;
export const API_PROTOCOL_CAMPAIGN_STATS =
  "/v1/protocols/:id/campaigns/:campaignId/stats" as const;
export const API_PROTOCOL_OVERVIEW = "/v1/protocols/:id/overview" as const;

// Protocol — IDL upload + program profiles + blinks publish
export const API_PROTOCOL_IDLS = "/v1/protocols/:id/idls" as const;
export const API_PROTOCOL_IDL_INSTRUCTIONS =
  "/v1/protocols/:id/idls/:idlId/instructions" as const;
export const API_PROTOCOL_PROGRAM_PROFILES =
  "/v1/protocols/:id/program-profiles" as const;
export const API_PROTOCOL_BLINKS = "/v1/protocols/:id/blinks" as const;

// Blinks runtime (public, consumed by dial.to and other blink clients)
export const API_BLINKS_RUNTIME =
  "/v1/blinks/:protocolId/:instructionSlug/:fixedAccountsHash?" as const;

// Root actions sitemap (public, served at site root per Solana Actions spec)
export const API_ACTIONS_JSON = "/actions.json" as const;

// ── PDA Seed Constants ─────────────────────────────────────────────────────
// Match mvp-smart-contracts/api/src/consts.rs exactly.

export const SEED_CONFIG = "config" as const;
export const SEED_USER_STAKE = "user_stake" as const;
export const SEED_PROTOCOL_STAKE = "protocol_stake" as const;
export const SEED_RENTAL = "rental" as const;
export const SEED_POINT_ROOT = "point_root" as const;
export const SEED_MINT_ATTEMPT = "mint_attempt" as const;
export const SEED_STAKE_VAULT = "stake_vault" as const;
export const SEED_RENTAL_ESCROW = "rental_escrow" as const;

// ── Account Discriminators ─────────────────────────────────────────────────

export const DISC_GLOBAL_CONFIG = 1 as const;
export const DISC_USER_STAKE = 2 as const;
export const DISC_PROTOCOL_STAKE = 3 as const;
export const DISC_RENTAL_AGREEMENT = 4 as const;
export const DISC_POINT_ROOT = 5 as const;
export const DISC_MINT_ATTEMPT = 6 as const;

/** Account layout version */
export const ACCOUNT_VERSION = 1 as const;

// ── Default Config Values ──────────────────────────────────────────────────
// From consts.rs and IDL constants section.

/** 100 REWARDZ (6 decimals) */
export const DEFAULT_MIN_USER_STAKE = 100_000_000n;

/** 1000 REWARDZ (6 decimals) */
export const DEFAULT_MIN_PROTOCOL_STAKE = 1_000_000_000n;

/** 1% fee on rental payments (basis points) */
export const DEFAULT_RENTAL_FEE_BPS = 100;

/** ~10% success rate (u64::MAX / 10) */
export const DEFAULT_MINT_DIFFICULTY = 1_844_674_407_370_955_161n;

/** 1000 points per burn-to-mint attempt */
export const DEFAULT_MINT_COST_POINTS = 1_000n;

/** 10,000 points = 1 Token X on success */
export const POINTS_PER_TOKEN = 10_000n;

/** Merkle proof max depth (supports 16M+ users) */
export const MAX_PROOF_LEN = 24;

/** Receipt expiry: 10 minutes (seconds) */
export const RECEIPT_TTL_SECONDS = 600;

/** Token X decimals */
export const TOKEN_DECIMALS = 6;
