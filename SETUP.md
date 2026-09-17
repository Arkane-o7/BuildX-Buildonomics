# Set up AgentPass

## Customer workspace

1. Open https://agentpass-buildx.vercel.app and create a trial account. Use a unique password of at least 12 characters. This event build has no email verification or password recovery.
2. Register an agent under **Agents**. Its identity stays stable across account changes. Copy its credential once into a private local file or the setup prompt; do not paste it into agent conversations.
3. Under **Payment accounts**, add a masked UPI reference or the last four digits of a card. No PIN, CVV, full card number or bank credentials are accepted. This does not enable payment execution.
4. Bind the reference under **Agents**, then set merchant domains, total allowance and purchase cap. These are spending permissions, not deposited funds.

A privately generated event-demo account, if created during setup, is recorded only in `.agentpass-private/PLATFORM-DEMO.json`. It uses example account references; no bank is connected.

## Hermes / MCP

From the repository:

```sh
npm ci
npm run plugin:configure
npm run hermes:platform
```

The setup prompt validates your scoped agent token and stores it in `.agentpass-private/platform-plugin.json` with mode 0600. It creates `.agentpass-private/agentpass-mcp.json`, containing an MCP launcher entry with no embedded token. For another MCP client, merge that entry into its configuration; different clients use `mcpServers` or `mcp_servers` as the outer key.

`hermes:platform` creates an isolated `.hermes-platform` profile. It copies model authentication from your normal Hermes profile and exposes only AgentPass's five tools. It does **not** modify `~/.hermes` or make the isolated profile capable of browsing Amazon. Use the generated MCP entry in your normal shopping-capable runtime for browsing. Retain that runtime's existing tools and MCP entries.

When a credential is rotated in the dashboard, rerun `plugin:configure`. The old credential no longer works. Revoking an agent blocks spending authority but still permits status/history lookup.

For native Hermes shopping, run `npm run hermes:shopping -- --cli`, then type `/browser connect` inside Hermes. This separate `.hermes-shopping` profile enables Hermes's own browser tools alongside AgentPass. Follow [the shopping walkthrough](docs/HERMES-SHOPPING.md). The browser prepares merchant checkout; the current payment reference still cannot execute bank debits.

## Local hosting

```sh
npm run setup
npm run dev
```

The setup script creates missing session/signing configuration in ignored `.env.local`. On the customer app, you sign up normally; the legacy owner-access code is only for `/lab`. No Razorpay key is required by the customer endpoints. Existing values are preserved.

For Vercel, connect a Postgres database through `DATABASE_URL`, supply `SESSION_SECRET` (32+ characters) and `RECEIPT_PRIVATE_KEY` (Ed25519 PEM), and set `EVENT_DISABLED=false`. Keep keys private. The existing event deployment already has these settings. `agentpass_accounts` is created on first use; existing merchant experiment data is not migrated into customer accounts.

## Payments and subscriptions

For phone approvals, follow [Android setup](docs/PHONE-APPROVALS.md). Hermes can send a merchant-issued UPI request to the owner's phone inbox, with optional browser notifications. The owner opens their UPI app to approve; AgentPass cannot debit the bank directly or independently verify settlement.

Current capability: policy authorization, not bank debits. Subscription status: free event trial, no recurring charge. A supported provider integration is necessary for delegated UPI/card execution; a separate billing integration is necessary to charge for AgentPass subscriptions. Do not configure a customer as a merchant just to let their agent shop.

Earlier Razorpay setup instructions are preserved in `docs/LEGACY-MERCHANT-SETUP.md` for the `/lab` experiment only.
