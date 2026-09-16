# AgentPass

**Identity, payment-account bindings and spending authority for AI agents.** A subscription SaaS with an MCP plugin for Hermes and other agent runtimes.

[Public app](https://agentpass-buildx.vercel.app) · [Setup](SETUP.md) · [Demo](docs/DEMO.md) · [Product contract](docs/PRODUCT.md) · [Removal](docs/ROLLBACK.md)

The customer owns the agents and their payment accounts. AgentPass registers identities, binds accounts, enforces purchase-request budgets, issues signed authorizations and supports revocation. Shopping happens through the agent's existing merchant/browser tools. AgentPass subscription billing is separate from purchases at Amazon or other merchants.

## Working in this build

- Separate customer workspaces with sign-in and a free event-trial entitlement.
- Multiple stable, owner-attested agent identities and individually scoped, rotatable credentials.
- Masked UPI/card references, rebindable without resetting identity, spending or history.
- External merchant allowlists, total/per-purchase limits, atomic reservations and exact-intent idempotency.
- Signed authorizations for the merchant, item, URL and total; online verification checks current revocation, policy, binding and expiry.
- MCP tools: `passport`, `authorize_purchase`, `purchase_history`, `verify_authority`, `report_order`.
- Owner dashboard for agents, account bindings, policies, activity, plugin setup and subscription status.

## Explicit capability boundaries

**Automatic UPI/card payment execution is not connected.** Account references are not funded wallets or debit authority. No customer Razorpay merchant account is needed to use this control plane. A real delegated payment adapter must be integrated before AgentPass can execute a purchase. This build does not purchase from Amazon by itself.

**Paid subscriptions are not connected.** The trial costs ₹0; there is no pretend paid plan. Production billing needs a separate subscription integration and verified billing webhooks.

Owner-attested identity is not KYC. A signed authorization is not a payment receipt. Client-reported orders are labelled unverified; no provider settlement is inferred. Policy is enforceable at the AgentPass authorization boundary, not against an agent with independent access to funds through other tools.

The earlier sample-research merchant experiment is preserved at `/lab` with separate legacy endpoints/storage and [historical documentation](docs/LEGACY-MERCHANT-README.md). It is not the AgentPass customer product. Its payment tests do not demonstrate autonomous external shopping.

## Development

```sh
npm ci
npm run setup
npm run dev
```

Create a customer account at http://localhost:3000. Set up an agent, add an account reference and bind it. Then:

```sh
npm run plugin:configure
npm run hermes:platform
```

The isolated Hermes profile tests the control plugin. For shopping, merge the generated MCP entry into a runtime that already has browser/commerce tools. Original Hermes configuration remains unchanged by the launcher.

```sh
npm test
npm run typecheck
npm run build
```

Node 22+, Next.js, React, Neon/Postgres and the MCP SDK. Amounts are integer paise. `agentpass_accounts` isolates each customer's JSONB state; row locks serialize mutations. Local development uses an ignored private JSON file when no database is configured. Production requires Postgres.

## Before a production launch

Connect a supported delegated payment provider with server-side execution and independently verified settlement; implement paid subscription checkout, webhooks and entitlements; add verified email, recovery, session management and operational monitoring; strengthen issuer key rotation, database migrations and audit retention; and exercise adversarial/runtime-bypass cases. See [PRODUCT.md](docs/PRODUCT.md) for the intended product boundary.
