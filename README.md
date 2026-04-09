# @rewardz/sdk

**Universal TypeScript SDK for the REWARDZ protocol**

[![npm version](https://img.shields.io/npm/v/@rewardz/sdk)](https://www.npmjs.com/package/@rewardz/sdk)
[![license](https://img.shields.io/npm/l/@rewardz/sdk)](./LICENSE)
[![build status](https://img.shields.io/github/actions/workflow/status/rewardz/sdk/ci.yml)](https://github.com/rewardz/sdk/actions)

REWARDZ is a Solana-based DeFi rewards platform. Users earn points by doing DeFi actions (swap, stake, borrow). Protocols stake RWD tokens to offer rewards for those actions. This SDK provides typed TypeScript clients for every surface of the protocol: resolving user intents, executing blink actions, earning and claiming points, managing subscriptions and quests, protocol onboarding, tweet verification, agent delegations, and on-chain transaction verification.

---

## Installation

```bash
pnpm add @rewardz/sdk @solana/kit
pnpm add @rewardz/types
```

`@rewardz/types` is a required peer. It contains shared domain types and API route constants used by every subpath.

---

## Quick Start

```typescript
import { RewardzClient } from "@rewardz/sdk/client";

const client = new RewardzClient({
  rpcUrl: "https://api.mainnet-beta.solana.com",
  apiBaseUrl: "https://api.rewardz.xyz",
  wallet: walletAdapter, // any WalletAdapter-compatible object
});

const { intent, offers } = await client.resolveIntent("swap 10 SOL to USDC");
const { completion_id } = await client.initCompletion(offers[0].protocol_id);
const { balance } = await client.getRewardSummary();
console.log(`Points earned: ${balance.usable_balance}`);
```

Five lines covers the most common path: resolve an intent, start a completion, and check balance.

---

## Protocol Onboarding Flow

Protocol partners authenticate with an API key and use `ProtocolAdapter`. The flow registers a manifest, creates a campaign, stakes RWD tokens on-chain, and starts issuing points.

### 1. Register your protocol manifest

```typescript
import { ProtocolAdapter } from "@rewardz/sdk/protocol";

const adapter = new ProtocolAdapter({
  apiKey: process.env.REWARDZ_API_KEY!,
  apiBaseUrl: "https://api.rewardz.xyz",
});

const protocol = await adapter.registerManifest({
  name: "Jupiter",
  description: "Leading Solana DEX aggregator",
  website: "https://jup.ag",
  actionUrl: "https://jup.ag/actions",
});

console.log("Protocol registered:", protocol.id);
```

### 2. Create a reward policy (campaign)

```typescript
const campaign = await adapter.createRewardPolicy({
  protocolId: protocol.id,
  name: "Swap to Earn",
  description: "Earn points on every swap",
  pointsPerCompletion: 100,
  maxCompletionsPerUser: 50,
  expiresAt: new Date("2025-12-31"),
});
```

### 3. Stake RWD tokens on-chain

Use the generated instruction builder to create a `ProtocolStake` account and transfer tokens to the vault:

```typescript
import { createProtocolStakeInstruction } from "@rewardz/sdk/generated/instructions";
import {
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/kit";

const ix = createProtocolStakeInstruction(
  {
    protocol: protocolKeypair.publicKey,
    config: globalConfigPda,
    protocolStakePda: protocolStakePda,
    protocolTokenAccount: protocolRwdAccount,
    stakeVault: stakeVaultPda,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
  },
  {
    amount: BigInt(1_000_000_000), // 1 RWD in base units
    trustScore: 100,
  },
  REWARDZ_PROGRAM_ID,
);

const tx = new Transaction().add(ix);
await sendAndConfirmTransaction(connection, tx, [protocolKeypair]);
```

### 4. Create a quest

```typescript
const quest = await adapter.createQuest({
  createdBy: protocol.id,
  name: "First Swap",
  description: "Complete your first swap on Jupiter",
  quest_type: "simple",
  conditions: [{ action_type: "swap", min_amount_usd: 10 }],
  reward_points: 250,
});
```

### 5. Award points to users

Use `AwardPointsConfig` for direct point issuance outside of the completion flow:

```typescript
import { AwardPointsConfig } from "@rewardz/sdk/integrations";

// The HttpClient instance must already have ApiKeyAuth headers set.
// In practice, use ProtocolAdapter's internal http client or configure one separately.
const awarder = new AwardPointsConfig(http);

await awarder.awardPoints(
  "So11111111111111111111111111111111111111112", // user wallet
  500,
  "Bonus for early adopter",
  "idempotency-key-abc123", // prevents duplicate awards
);
```

### 6. Verify completion status

```typescript
const status = await client.getCompletionStatus(completionId);
console.log(status.status); // "pending" | "verified" | "rejected"
console.log(status.points_awarded);
```

---

## User Journey Flow

Users authenticate by signing a message with their Solana wallet (WalletAuth). The full journey from connecting a wallet to claiming points on-chain:

### 1. Connect wallet and create a client

```typescript
import { RewardzClient } from "@rewardz/sdk/client";

// walletAdapter must implement: publicKey (string), signMessage (async fn)
const client = new RewardzClient({
  rpcUrl: "https://api.mainnet-beta.solana.com",
  apiBaseUrl: "https://api.rewardz.xyz",
  wallet: walletAdapter,
  timeoutMs: 30_000, // optional, default 30 000
});
```

### 2. Browse available offers

```typescript
const { offers } = await client.browseOffers({
  type: "swap",
  sort: "points_desc",
  limit: "20",
});
```

### 3. Resolve an intent

```typescript
// Natural language
const result = await client.resolveIntent("swap 10 SOL to USDC");

// Structured query
const result = await client.resolveIntent({
  actionType: "swap",
  params: { fromToken: "SOL", toToken: "USDC", amount: "10" },
});

const { intent, offers } = result;
```

### 4. Initialise a completion

```typescript
const { completion_id, reference } = await client.initCompletion(
  offers[0].protocol_id,
  { reward_policy_id: offers[0].reward_policy_id },
);
```

### 5. Fetch blink metadata from the protocol

```typescript
const metadata = await client.fetchBlinkMetadata(offers[0].action_url);
// metadata.actions contains the available action hrefs
const actionHref = metadata.actions[0].href;
```

### 6. Build the transaction

```typescript
const { transaction, message } = await client.buildBlinkTransaction(
  actionHref,
  walletAdapter.publicKey,
);
// transaction is a base64-encoded serialized transaction
```

### 7. Sign and submit the transaction

```typescript
import { Transaction, Connection } from "@solana/kit";

const connection = new Connection(rpcUrl);
const tx = Transaction.from(Buffer.from(transaction, "base64"));
const signed = await walletAdapter.signTransaction(tx);
const signature = await connection.sendRawTransaction(signed.serialize());
await connection.confirmTransaction(signature);
```

### 8. Report the callback

```typescript
const callback = await client.reportCallback(completion_id, signature);
console.log(callback.status); // "submitted"
```

### 9. Check completion status

```typescript
const status = await client.getCompletionStatus(completion_id);
if (status.status === "verified") {
  console.log(`Earned ${status.points_awarded} points`);
}
```

### 10. View points balance

```typescript
const { balance, recentEvents } = await client.getRewardSummary();
console.log(`Balance: ${balance.usable_balance}`);
console.log(`Total earned: ${balance.total_earned}`);
```

### 11. Get a Merkle claim proof for on-chain sync

```typescript
const proof = await client.getClaimProof();
// proof.root, proof.proof (array of 32-byte hashes), proof.amount
// Use these to build a syncPoints instruction (see On-Chain Reference section)
```

---

## Full API Reference

### RewardzClient

Import: `import { RewardzClient } from "@rewardz/sdk/client"`

Auth: wallet signing (WalletAuth) — signs a message on first call and caches headers.

| Method                  | Signature                                                                                     | Description                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `resolveIntent`         | `(query: string \| StructuredIntentQuery) => Promise<IntentResolutionResponse>`               | Resolve a natural-language or structured intent to ranked offers                |
| `initCompletion`        | `(offerId: string, options?) => Promise<InitCompletionResponse>`                              | Start a completion record for a given offer                                     |
| `reportCallback`        | `(completionId: string, signature: string) => Promise<CallbackResponse>`                      | Report a submitted transaction signature to the API                             |
| `getCompletionStatus`   | `(completionId: string) => Promise<CompletionResponse>`                                       | Poll the current status of a completion                                         |
| `fetchBlinkMetadata`    | `(actionUrl: string) => Promise<BlinkMetadata>`                                               | Fetch Solana Actions metadata from an external protocol URL                     |
| `buildBlinkTransaction` | `(actionUrl: string, wallet: string) => Promise<BlinkTransactionResponse>`                    | Build a serialized transaction via a Blink action endpoint                      |
| `browseOffers`          | `(filters?) => Promise<OffersBrowseResponse>`                                                 | List available offers with optional filters (type, protocol, sort, page, limit) |
| `createSubscription`    | `(config: CreateSubscriptionBody) => Promise<SubscriptionRow>`                                | Create a recurring intent subscription                                          |
| `listSubscriptions`     | `() => Promise<SubscriptionRow[]>`                                                            | List all subscriptions for the connected wallet                                 |
| `updateSubscription`    | `(id: string, update: PatchSubscriptionBody) => Promise<SubscriptionRow>`                     | Update a subscription's status, params, or frequency                            |
| `getStreak`             | `(subscriptionId: string) => Promise<StreakResponse>`                                         | Get the current streak for a subscription                                       |
| `listQuests`            | `(filters?) => Promise<QuestListResponse>`                                                    | List available quests with optional filters                                     |
| `joinQuest`             | `(questId: string) => Promise<QuestJoinResponse>`                                             | Join a quest and start tracking progress                                        |
| `getQuestProgress`      | `(questId: string) => Promise<QuestProgressResponse>`                                         | Get the user's current progress on a quest                                      |
| `startComposableQuest`  | `(questId: string) => Promise<QuestJoinResponse>`                                             | Alias for `joinQuest` — entry point for multi-step composable quests            |
| `getComposableNextStep` | `(questId: string) => Promise<{ stepIndex: number; step: unknown } \| null>`                  | Get the next pending step for a composable quest in progress                    |
| `completeQuestStep`     | `(questId: string, stepIndex: number, completionId: string) => Promise<StepCompleteResponse>` | Mark an individual step within a composable quest as complete                   |
| `getPointsBalance`      | `(wallet?: string) => Promise<PointsBalanceResponse>`                                         | Get points balance for connected wallet or any address                          |
| `getRewardHistory`      | `(pagination?) => Promise<PointsHistoryResponse>`                                             | Get paginated point event history                                               |
| `getClaimProof`         | `() => Promise<ClaimProofResponse>`                                                           | Get the Merkle proof needed to sync points on-chain                             |
| `getRewardSummary`      | `() => Promise<{ balance, recentEvents }>`                                                    | Convenience: fetch balance + last 10 events in one call                         |

`LeaderboardClient` is re-exported from `@rewardz/sdk/client`. Access it via the same import.

---

### ProtocolAdapter

Import: `import { ProtocolAdapter } from "@rewardz/sdk/protocol"`

Auth: API key via `x-api-key` header (ApiKeyAuth).

| Method                     | Signature                                                                                | Description                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `registerManifest`         | `(manifest: Partial<ProtocolManifest>) => Promise<Protocol>`                             | Register a new protocol with the REWARDZ API                      |
| `updateManifest`           | `(protocolId: string, update: Partial<ProtocolManifest>) => Promise<Protocol>`           | Update an existing protocol's manifest fields                     |
| `createRewardPolicy`       | `(policy: Partial<RewardPolicy>) => Promise<Campaign>`                                   | Create a reward campaign for this protocol                        |
| `updateRewardPolicy`       | `(policyId: string, update: Partial<RewardPolicy>) => Promise<Campaign>`                 | Update an existing reward policy                                  |
| `createQuest`              | `(config: Partial<Quest>) => Promise<Quest>`                                             | Create a simple (single-condition) quest                          |
| `createComposableQuest`    | `(config: { protocolId, name, description, steps, bonusPoints? }) => Promise<Quest>`     | Create a multi-step composable quest                              |
| `discoverComposableQuests` | `(filters?) => Promise<Quest[]>`                                                         | List composable quests available for cross-protocol collaboration |
| `joinComposableQuest`      | `(questId: string, stepConfig: Partial<QuestStep>) => Promise<QuestCollaborator>`        | Join an existing composable quest by contributing a step          |
| `inviteToQuest`            | `(questId: string, invitation: { protocolId, stepIndex }) => Promise<QuestCollaborator>` | Invite another protocol to contribute a step                      |

Note: `getCampaignStats` exists on the interface but is not yet implemented on the API (throws 501).

---

### LeaderboardClient

Import: `import { LeaderboardClient } from "@rewardz/sdk/client"`

Operates on the `HttpClient` from `RewardzClient`. Wallet auth headers must be set before use.

| Method                | Signature                                                       | Description                                 |
| --------------------- | --------------------------------------------------------------- | ------------------------------------------- |
| `getCurrentSeason`    | `() => Promise<SeasonResponse>`                                 | Get the current active season details       |
| `getProtocolRankings` | `(seasonId?, pagination?) => Promise<ProtocolRankingsResponse>` | Paginated protocol leaderboard for a season |
| `getUserRankings`     | `(seasonId?, pagination?) => Promise<UserRankingsResponse>`     | Paginated user leaderboard for a season     |
| `getMyRank`           | `() => Promise<UserRank>`                                       | The connected user's current rank           |
| `getProtocolRank`     | `(protocolId: string) => Promise<ProtocolRank>`                 | Rank entry for a specific protocol          |

---

### AgentDelegationClient

Import: `import { AgentDelegationClient } from "@rewardz/sdk/agent"`

Auth: Bearer JWT (BearerAuth).

```typescript
const agent = new AgentDelegationClient({
  token: "eyJhbGciOiJFZDI1NTE5...",
  apiBaseUrl: "https://api.rewardz.xyz",
});
```

| Method             | Signature                                                                         | Description                                                     |
| ------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `createDelegation` | `(config: DelegationConfig) => Promise<AgentDelegation>`                          | Create a new agent delegation with permissions and spend limits |
| `listDelegations`  | `() => Promise<AgentDelegation[]>`                                                | List all active delegations for the authenticated user          |
| `getDelegation`    | `(id: string) => Promise<AgentDelegation>`                                        | Fetch a single delegation by ID                                 |
| `updateDelegation` | `(id: string, update: Partial<DelegationConfig>) => Promise<AgentDelegation>`     | Update permissions, constraints, or expiry on a delegation      |
| `revokeDelegation` | `(id: string) => Promise<void>`                                                   | Soft-delete a delegation (sets status to "revoked")             |
| `addTrigger`       | `(delegationId: string, trigger: Partial<AgentTrigger>) => Promise<AgentTrigger>` | Add an automation trigger to a delegation                       |
| `removeTrigger`    | `(delegationId: string, triggerId: string) => Promise<void>`                      | Disable a trigger on a delegation                               |
| `getAuditLog`      | `(delegationId: string) => Promise<AuditLogEntry[]>`                              | Retrieve the full audit trail for a delegation                  |

`DelegationConfig` fields: `agentId`, `permissions`, `maxSpendPerAction`, `dailyLimit`, `allowedActions`, `expiresAt`.

---

### Integration Modules

Import: `import { TweetClient, TweetConfig, AwardPointsConfig, ZealyConfig } from "@rewardz/sdk/integrations"`

#### TweetClient (user-facing, WalletAuth)

| Method                                  | Description                                           |
| --------------------------------------- | ----------------------------------------------------- |
| `submit(tweetUrl, wallet, protocolId?)` | Submit a tweet URL for verification and point rewards |
| `getStatus(submissionId)`               | Get the current verification status of a submission   |
| `listSubmissions(wallet, pagination?)`  | List all tweet submissions for a wallet               |
| `listRules(protocolId?)`                | List active tweet verification rules                  |

#### TweetConfig (protocol-facing, ApiKeyAuth)

| Method                                                 | Description                                                             |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `configureCampaign(config: CreateCampaignConfig)`      | Create a tweet verification campaign with hashtag/mention/cashtag rules |
| `listCampaigns()`                                      | List all tweet campaigns for this protocol                              |
| `updateCampaign(ruleId, update: UpdateCampaignConfig)` | Update an existing campaign rule                                        |

`CreateCampaignConfig` fields: `hashtags`, `mentions`, `cashtags`, `basePoints`, `bonusPerLike`, `allRequired`.

#### AwardPointsConfig (protocol-facing, ApiKeyAuth)

| Method                                                 | Description                                              |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `awardPoints(wallet, amount, reason, idempotencyKey?)` | Award points to a single wallet                          |
| `awardBatch(awards: BatchAwardEntry[])`                | Award points to up to 100 wallets in one call            |
| `getBudget()`                                          | Get the protocol's remaining daily/monthly points budget |

#### ZealyConfig (protocol-facing, ApiKeyAuth)

| Method                                     | Description                                                     |
| ------------------------------------------ | --------------------------------------------------------------- |
| `configureSpace(config: ZealySpaceConfig)` | Connect a Zealy space for webhook-based quest completion        |
| `updateMappings(spaceId, mappings)`        | Update quest-to-points mappings (questId -> pointAmount)        |
| `getWebhookUrl()`                          | Get the REWARDZ webhook URL to configure in the Zealy dashboard |

---

### TelegramRewardzClient

Import: `import { TelegramRewardzClient } from "@rewardz/sdk/telegram"`

Extends `RewardzClient` with Telegram-specific user management. Uses dual auth: wallet auth for inherited user endpoints, internal key auth for Telegram endpoints.

```typescript
const tgClient = new TelegramRewardzClient({
  rpcUrl: "https://api.mainnet-beta.solana.com",
  apiBaseUrl: "https://api.rewardz.xyz",
  wallet: walletAdapter,
  internalKey: "sk_internal_...",
});
```

| Method                                     | Description                                              |
| ------------------------------------------ | -------------------------------------------------------- |
| `registerTelegramUser(telegramId, wallet)` | Associate a Telegram user ID with a Solana wallet        |
| `getWalletByTelegramId(telegramId)`        | Look up the wallet address for a Telegram user           |
| `getTelegramUserPoints(telegramId)`        | Fetch the points balance for a Telegram user by their ID |

**Formatting helpers** (named exports, not methods):

```typescript
import {
  formatPointsDisplay,
  formatOfferSummary,
  formatQuestProgress,
} from "@rewardz/sdk/telegram";

formatPointsDisplay({ total_earned: "5678", usable_balance: "1234" });
// => "💰 1,234 pts (earned: 5,678)"

formatOfferSummary({
  protocol_name: "Jupiter",
  action_type: "swap",
  points_per_completion: 100,
});
// => "Jupiter — swap (+100 pts)"

formatQuestProgress({ steps_completed: [0, 1, 2], completed: false }, 5);
// => "[███░░] 3/5"
```

---

### RewardVerifier

Import: `import { RewardVerifier } from "@rewardz/sdk/verify"`

Adapter-based on-chain transaction verifier. Ships with built-in adapters for swaps (Jupiter v6, Raydium AMM), staking (Marinade, REWARDZ program), and token mints (SPL Token, Token-2022).

```typescript
const verifier = new RewardVerifier();

const result = verifier.verify(parsedInstructions, {
  expectedProgramId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
});

if (result.verified) {
  console.log(`Verified via adapter: ${result.adapterName}`);
}
```

**Custom adapter pattern:**

```typescript
import type {
  VerificationAdapter,
  ParsedInstruction,
  VerificationResult,
} from "@rewardz/sdk/verify";

class MyDexVerifier implements VerificationAdapter {
  readonly name = "my-dex";

  supports(programId: string): boolean {
    return programId === "MyDex1111111111111111111111111111111111111";
  }

  verify(instructions: ParsedInstruction[], constraints): VerificationResult {
    // your verification logic
    return {
      verified: true,
      adapterName: this.name,
      programId: "...",
      details: {},
    };
  }
}

verifier.register(new MyDexVerifier());
```

| Method                               | Description                                                      |
| ------------------------------------ | ---------------------------------------------------------------- |
| `verify(instructions, constraints?)` | Verify a transaction by delegating to the first matching adapter |
| `register(adapter)`                  | Register a custom verification adapter                           |
| `listAdapters()`                     | List the names of all registered adapters                        |

---

## Integration Configs

### X/Twitter Post Verification

Configure a tweet campaign so users earn points for tweeting about your protocol:

```typescript
import { TweetConfig } from "@rewardz/sdk/integrations";

const config = new TweetConfig(http); // http with ApiKeyAuth headers

const rule = await config.configureCampaign({
  hashtags: ["#REWARDZ", "#DeFi"],
  mentions: ["@rewardz_xyz"],
  basePoints: 50,
  bonusPerLike: 2,
  allRequired: false, // any match awards points
});

console.log("Campaign rule ID:", rule.id);
```

Users then submit their tweet URLs via `TweetClient.submit()`. The API verifies the content against the rule and awards points.

### Zealy Quest Integration

Connect a Zealy space so quest completions on Zealy automatically award REWARDZ points:

```typescript
import { ZealyConfig } from "@rewardz/sdk/integrations";

const zealy = new ZealyConfig(http);

const integration = await zealy.configureSpace({
  spaceId: "my-zealy-space",
  webhookSecret: process.env.ZEALY_WEBHOOK_SECRET!,
  questMappings: {
    "zealy-quest-abc": "100", // 100 points for this quest
    "zealy-quest-xyz": "250",
  },
});

// Paste this URL into your Zealy dashboard webhook settings:
console.log(zealy.getWebhookUrl());
```

Update mappings later as quests evolve:

```typescript
await zealy.updateMappings("my-zealy-space", {
  "zealy-quest-new": "150",
});
```

### Award Points Programmatically

Use `AwardPointsConfig` when you want to issue points outside the standard completion flow:

```typescript
import { AwardPointsConfig } from "@rewardz/sdk/integrations";

const awarder = new AwardPointsConfig(http);

// Single award
await awarder.awardPoints(
  "user-wallet-address",
  200,
  "Completed off-chain quest",
  `idempotency-${userId}-${questId}`,
);

// Batch up to 100 wallets
const results = await awarder.awardBatch([
  {
    wallet: "wallet-1",
    amount: 100,
    reason: "Airdrop",
    idempotencyKey: "drop-1",
  },
  {
    wallet: "wallet-2",
    amount: 100,
    reason: "Airdrop",
    idempotencyKey: "drop-2",
  },
]);

// Check remaining budget
const budget = await awarder.getBudget();
console.log(`Remaining today: ${budget.remaining} / ${budget.daily_limit}`);
```

---

## On-Chain Reference

The REWARDZ smart contract program ID is `mineHEHyaVbQAkcPDDCuCSbkfGNid1RVz6GzcEgSVTh`.

### Account Types

| Account         | Seeds                                 | Description                                                           |
| --------------- | ------------------------------------- | --------------------------------------------------------------------- |
| `GlobalConfig`  | `["config"]`                          | Admin-controlled program configuration (fees, difficulty, min stakes) |
| `UserStake`     | `["user_stake", user_pubkey]`         | Per-user staked balance and synced points                             |
| `ProtocolStake` | `["protocol_stake", protocol_pubkey]` | Per-protocol direct staked RWD balance and trust score                |
| `PointRoot`     | `["point_root"]`                      | The latest published Merkle root for off-chain points                 |

### PDA Derivation

```typescript
import { PublicKey } from "@solana/kit";

const REWARDZ_PROGRAM_ID = new PublicKey(
  "mineHEHyaVbQAkcPDDCuCSbkfGNid1RVz6GzcEgSVTh",
);

const [globalConfig] = PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  REWARDZ_PROGRAM_ID,
);

const [userStake] = PublicKey.findProgramAddressSync(
  [Buffer.from("user_stake"), userPublicKey.toBuffer()],
  REWARDZ_PROGRAM_ID,
);

const [protocolStake] = PublicKey.findProgramAddressSync(
  [Buffer.from("protocol_stake"), protocolPublicKey.toBuffer()],
  REWARDZ_PROGRAM_ID,
);

const [pointRoot] = PublicKey.findProgramAddressSync(
  [Buffer.from("point_root")],
  REWARDZ_PROGRAM_ID,
);
```

### syncPoints: Merkle vs Receipt Modes

The `syncPoints` instruction moves off-chain points into a user's on-chain `UserStake` balance. Two modes are available:

**Merkle mode** — verified against the published `PointRoot`. Use the proof from `client.getClaimProof()`:

```typescript
import { createSyncPointsMerkleInstruction } from "@rewardz/sdk/generated/instructions";

const proof = await client.getClaimProof();

const ix = createSyncPointsMerkleInstruction(
  {
    user: userPublicKey,
    userStake: userStakePda,
    pointRoot: pointRootPda,
  },
  BigInt(proof.amount),
  {
    numProofs: proof.proof.length,
    proofHashes: proof.proof, // array of Uint8Array[32]
  },
  REWARDZ_PROGRAM_ID,
);
```

**Receipt mode** — verified by the ops authority co-signing. Useful between Merkle root publications:

```typescript
import { createSyncPointsReceiptInstruction } from "@rewardz/sdk/generated/instructions";

const ix = createSyncPointsReceiptInstruction(
  {
    user: userPublicKey,
    userStake: userStakePda,
    config: globalConfigPda,
    opsAuthority: opsAuthorityPublicKey,
  },
  BigInt(pointsAmount),
  {
    nonce: BigInt(receipt.nonce),
    expiry: BigInt(receipt.expiry),
  },
  REWARDZ_PROGRAM_ID,
);
```

### Protocol Staking Instructions

```typescript
import {
  createProtocolStakeInstruction,
  createProtocolAddStakeInstruction,
  createProtocolUnstakeInstruction,
} from "@rewardz/sdk/generated/instructions";

// Initial stake (creates ProtocolStake account)
const stakeIx = createProtocolStakeInstruction(
  accounts,
  { amount, trustScore },
  programId,
);

// Add more stake to existing account
const addIx = createProtocolAddStakeInstruction(accounts, amount, programId);

// Withdraw stake back to protocol
const unstakeIx = createProtocolUnstakeInstruction(accounts, amount, programId);
```

---

## Error Handling

All SDK errors extend `RewardzError`. Import specific types to branch on failure mode:

```typescript
import {
  RewardzApiError,
  RewardzAuthError,
  RewardzRpcError,
  RewardzTransactionError,
  RewardzTimeoutError,
} from "@rewardz/sdk/core";

try {
  const { offers } = await client.resolveIntent("swap 10 SOL");
} catch (e) {
  if (e instanceof RewardzApiError) {
    if (e.isRateLimited) {
      // HTTP 429 — back off and retry
      await sleep(2000);
    } else if (e.isUnauthorized) {
      // HTTP 401 — wallet auth expired, re-auth
    } else if (e.isNotFound) {
      // HTTP 404
    } else if (e.isServerError) {
      // HTTP 5xx — REWARDZ API error
    }
    console.error(`API error [${e.status}] ${e.errorCode}: ${e.message}`);
  } else if (e instanceof RewardzAuthError) {
    // Auth failed before the request was sent
    // e.reason: "expired" | "invalid" | "missing"
    console.error(`Auth failed (${e.reason}): ${e.message}`);
  } else if (e instanceof RewardzRpcError) {
    // Solana RPC call failed
    console.error(`RPC error [${e.rpcCode}]: ${e.message}`);
  } else if (e instanceof RewardzTransactionError) {
    // Transaction simulation or confirmation failed
    console.error(`Transaction failed: ${e.message}`);
    console.error("Logs:", e.logs);
    console.error("Signature:", e.signature);
  } else if (e instanceof RewardzTimeoutError) {
    // Request exceeded timeoutMs
    console.error(`Timed out after ${e.timeoutMs}ms`);
  } else {
    throw e; // unexpected error, re-throw
  }
}
```

Error class hierarchy:

```
RewardzError (base)
  RewardzApiError      — HTTP 4xx/5xx from the API (status, errorCode, details)
  RewardzAuthError     — Pre-request auth failure (reason: expired|invalid|missing)
  RewardzRpcError      — Solana JSON-RPC failure (rpcCode)
  RewardzTransactionError — Transaction simulation/confirmation failure (signature, logs)
  RewardzTimeoutError  — Request timeout exceeded (timeoutMs)
```

---

## Architecture Overview

The SDK is structured as a pnpm monorepo with two published packages:

```
sdk/
  packages/
    types/          — @rewardz/types
    sdk/            — @rewardz/sdk
```

### @rewardz/types

Shared domain types (`Protocol`, `Quest`, `AgentDelegation`, etc.) and API route constants (`API_INTENTS_RESOLVE`, `API_COMPLETIONS_INIT`, etc.). No runtime logic. Both packages in this repo depend on it; your application should too.

### @rewardz/sdk

The main package. Organized as discrete subpaths for tree-shaking — import only what you use:

| Subpath                               | Contents                                                             |
| ------------------------------------- | -------------------------------------------------------------------- |
| `@rewardz/sdk`                        | Root barrel — re-exports everything                                  |
| `@rewardz/sdk/client`                 | `RewardzClient`, `LeaderboardClient`, user-facing types              |
| `@rewardz/sdk/protocol`               | `ProtocolAdapter`                                                    |
| `@rewardz/sdk/agent`                  | `AgentDelegationClient`                                              |
| `@rewardz/sdk/integrations`           | `TweetClient`, `TweetConfig`, `AwardPointsConfig`, `ZealyConfig`     |
| `@rewardz/sdk/telegram`               | `TelegramRewardzClient`, formatting helpers                          |
| `@rewardz/sdk/verify`                 | `RewardVerifier`, built-in adapters, `VerificationAdapter` interface |
| `@rewardz/sdk/core`                   | `HttpClient`, auth classes, error classes                            |
| `@rewardz/sdk/generated/instructions` | Low-level Solana instruction builders                                |

The package ships dual CJS/ESM via tsup. All subpaths have matching `types`, `import`, and `require` export conditions.

### Auth Strategy by Client

| Client                  | Auth Mechanism                                     | When to Use                         |
| ----------------------- | -------------------------------------------------- | ----------------------------------- |
| `RewardzClient`         | WalletAuth — signs a challenge with user's keypair | End-user apps (web, mobile)         |
| `ProtocolAdapter`       | ApiKeyAuth — `x-api-key` header                    | Server-side protocol integrations   |
| `AgentDelegationClient` | BearerAuth — JWT in `Authorization` header         | AI agents acting on behalf of users |
| `TelegramRewardzClient` | Dual: WalletAuth + InternalKeyAuth                 | Telegram bot backends               |

---

## Contributing

This is a monorepo. Install dependencies from the root:

```bash
pnpm install
```

Build all packages:

```bash
pnpm -r run build
```

Run tests:

```bash
pnpm -r run test
```
