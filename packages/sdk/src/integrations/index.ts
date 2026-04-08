// ---------------------------------------------------------------------------
// @rewardz/sdk/integrations — Barrel export
//
// Tweet submission & campaign management, points awarding, and Zealy config.
// ---------------------------------------------------------------------------

export {
  TweetClient,
  TweetConfig,
  type CreateCampaignConfig,
  type UpdateCampaignConfig,
} from "./tweets.js";

export {
  AwardPointsConfig,
  type BatchAwardEntry,
  type PointsBudget,
} from "./award-points.js";

export { ZealyConfig, type ZealySpaceConfig } from "./zealy.js";
