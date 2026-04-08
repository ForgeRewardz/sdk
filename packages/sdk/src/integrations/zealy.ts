// ---------------------------------------------------------------------------
// @rewardz/sdk/integrations — Zealy Integration
//
// Protocol-facing class for configuring Zealy quest-to-points mappings.
// Uses ApiKeyAuth.
// ---------------------------------------------------------------------------

import type { HttpClient } from "../core/http.js";
import type { ZealyIntegration } from "@rewardz/types";
import {
  API_WEBHOOKS_ZEALY,
  API_ZEALY_SPACES,
  API_ZEALY_SPACES_MAPPINGS,
} from "@rewardz/types";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/** Configuration for connecting a Zealy space. */
export interface ZealySpaceConfig {
  spaceId: string;
  /** Secret shared between Zealy and REWARDZ for webhook verification. */
  webhookSecret: string;
  /** Initial quest-to-points mappings (questId -> pointAmount as string). */
  questMappings?: Record<string, string>;
}

/* -------------------------------------------------------------------------- */
/*  ZealyConfig — protocol-facing (ApiKeyAuth)                                */
/* -------------------------------------------------------------------------- */

/**
 * Configure Zealy integration for a protocol.
 *
 * Intended for protocol partners authenticating via ApiKeyAuth. The
 * `HttpClient` instance should already have API key headers configured.
 *
 * Zealy sends webhook events when users complete quests. This class manages
 * the space configuration and quest-to-points mappings.
 */
export class ZealyConfig {
  constructor(private readonly http: HttpClient) {}

  /**
   * Configure a Zealy space for webhook integration.
   *
   * @param config - Space configuration (spaceId, secret, optional mappings)
   */
  async configureSpace(config: ZealySpaceConfig): Promise<ZealyIntegration> {
    return this.http.post<ZealyIntegration>(API_ZEALY_SPACES, config);
  }

  /**
   * Update quest-to-points mappings for a configured space.
   *
   * @param spaceId - The Zealy space ID
   * @param mappings - Map of Zealy questId to points amount (as string)
   */
  async updateMappings(
    spaceId: string,
    mappings: Record<string, string>,
  ): Promise<void> {
    const path = API_ZEALY_SPACES_MAPPINGS.replace(":space_id", spaceId);
    await this.http.patch(path, { questMappings: mappings });
  }

  /**
   * Get the webhook URL to configure in the Zealy dashboard.
   *
   * Returns the full endpoint URL that Zealy should POST events to.
   * Protocol partners paste this URL into their Zealy space webhook settings.
   */
  getWebhookUrl(): string {
    return API_WEBHOOKS_ZEALY;
  }
}
