> **Superseded payment scope:** The user changed the build to UPI and credit cards with Razorpay and a public Vercel dashboard. This earlier crypto-first plan is historical research. See `../README.md` and `../SETUP.md` for the implementation, live-payment dependencies, and current setup.

# AgentPass: three-hour implementation plan

This plan supersedes the three-day schedule in the initial assessment. It incorporates the existing Hermes agent and a Next.js dashboard hosted on Vercel. A working public HTTPS URL is a required deliverable. Localhost is for development and rehearsal, not a substitute for deployment. Time estimates start when implementation begins; deployment and external funding are gates, not assumed successes.

**The finish line**

Show Hermes buying a real paid API response under owner-defined rules. Show the same events in the dashboard, block forbidden spending before signing, rotate the wallet without resetting the agent budget, and revoke new spending. Include an ERC-8004 identity and an independently verifiable signed receipt if the chain integrations pass the early gate.

The target is a complete working workflow for one demo organization and one funded agent, with two prepared test wallets. It is not the full multitenant commercial platform described in the research. All labels must distinguish testnet settlement, pending settlement, and any explicit rehearsal mode.

**Architecture decisions**

| Component | Decision |
|---|---|
| Agent runtime | Existing local Hermes setup. Keep its current model/provider configuration. |
| Agent integration | Small TypeScript stdio MCP server running locally; it calls the AgentPass HTTPS API. No Hermes fork. |
| Application | Next.js App Router, TypeScript, Tailwind. Route handlers supply the API; omit a separate Hono service. |
| Hosting | Next.js dashboard and API on Vercel, with the first public deployment by minute 30. Localhost is for development and rehearsal. |
| Persistence | Hosted Postgres, preferably Neon. Same database works with local Next.js and Vercel. SQL schema and a small query layer, without an additional ORM migration framework. |
| Live observations | Dashboard polls cursor-based event/status endpoints every two seconds with caching disabled. |
| Wallets | Two dedicated testnet wallets; signing stays inside the backend. Use CDP if credentials are already available; otherwise prepare viem test signers and prove facilitator compatibility immediately. |
| Payment | Official x402 exact-price implementation on Base Sepolia, USDC only. One controlled demo merchant route. |
| Identity | Existing ERC-8004 Base Sepolia registry, accessed using viem and the current ABI. |
| Owner access | One authenticated owner session for the showcase, separated from scoped agent tokens. No signup, SSO or KYB workflow. |
| Public access | A read-only showcase page with explicitly published demo activity. Owner actions and agent payment APIs remain authenticated. |

Hermes supports local stdio MCP servers through `mcp_servers`; this was confirmed in both its [official documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp) and the locally installed source. The MCP server receives only an AgentPass URL and scoped agent token. It does not receive wallet keys, database credentials or owner credentials.

The MCP bridge runs on the laptop, not as a persistent process inside a Vercel function. Vercel hosts bounded HTTP operations. Persist all budgets, receipts and event records in Postgres; function memory and local files cannot be the shared source of truth. [Vercel guidance](https://blog.vercel.com/academy/agent-friendly-apis/setup-project).

**Current readiness and the first ten minutes**

Observed: project contains research files only; Node 22.23.1 is installed; Hermes executable, configuration and source are present. A Hermes version check exceeded eight seconds, so a successful live Hermes run remains to be demonstrated. Docker is installed but its daemon was unavailable, so the primary plan does not depend on Docker.

No database or CDP credentials were present in the inspected shell environment. They may exist elsewhere; no secret stores were searched. A direct unauthenticated probe of the public x402 facilitator returned HTTP 403 from this environment, so it is not a proven zero-setup dependency.

During the first ten minutes:

1. Confirm Hermes can answer a prompt with the user's existing setup.
2. Provision or connect one hosted Postgres database and verify a write/read.
3. Establish the x402 facilitator and signer path. The [official CDP buyer quickstart](https://docs.cdp.coinbase.com/x402/buyer/quickstart) requires CDP credentials; do not assume they exist.
4. Generate or select dedicated wallet A, wallet B and a registry-owner test address. Obtain test USDC for both spending wallets and test ETH for identity registration/binding calls. Never use mainnet funds for this prototype.
5. Confirm Vercel project access, create the deployment and configure server environment variables immediately. Deploy a minimal public page and a non-sensitive health endpoint before minute 30 while feature work continues locally.

Only public addresses are needed for manual faucet funding. Secrets belong in server-only environment configuration and must not be committed or included in `NEXT_PUBLIC_*` variables.

**The 180-minute schedule**

Parallel work means separate files and a shared API contract. If multiple coding workers are available, assign the lanes below; one integrator owns the schema and contracts. All times are cumulative elapsed minutes.

| Time | Core/backend lane | UI/integration lane | Gate |
|---|---|---|---|
| 0–15 | Scaffold app, DB schema, env validation and authenticated API shape. Start funding and payment spike. | Confirm Vercel access and deploy the app shell; define component states and MCP schemas. | App starts; DB persists; Hermes responds; Vercel deployment underway. |
| 15–45 | Prove one x402 paid call, inspect settlement and persist its transaction/authorization identifiers. | Verify public URL by minute 30; build dashboard shell and MCP passport/service-list tools against the hosted API. | Public HTTPS page works outside the developer session; payment path works or its exact blocker is documented. |
| 45–80 | Implement payment-intent reservation, hard limits, payee allowlist, idempotency and durable payment states. | Connect agent list/detail, policy form, budget bar and events to actual endpoints. | Allowed and denied requests update the database and dashboard correctly. |
| 80–110 | Add registry registration/binding, owner-approved wallet rotation and revocation. | Complete Hermes purchasing/status tools; run actual Hermes purchase through the hosted service. | Hermes purchases through public API; dashboard observes it; rotation preserves budget. |
| 110–135 | Add signed decision receipt and receipt verifier, plus explicit unknown-payment reconciliation. | Finish event details, explorer links and copyable agent config; verify deployed behavior. | Full six-step showcase works on the public deployment. |
| 135–160 | Run meaningful failure/concurrency checks and fix failures. | Test incognito public access, protected controls, error states and Hermes reconnect. | No duplicate charge, budget reset or unauthorized admin action; judges can open the URL. |
| 160–180 | Freeze features, prepare a fresh isolated demo run and check balances. | Rehearse twice, save a backup recording and prepare a short pitch/runbook. | One reliable live demonstration and a truthful record of what works. |

If there are three workers, dedicate the third to MCP/Hermes and testing from minute 15; the UI worker focuses on the app. If only one coding worker is available, retain the order and cut stretch features immediately. Do not open multiple workers editing the same API routes or schema.

**Exact product scope**

The dashboard has one main view and an agent detail panel, not many separate pages:

- Overview: agent name, authority status, registry ID, selected wallet, spent/reserved/remaining budget and connection last-seen time.
- Policy controls: task budget, per-request ceiling, approved services, wallet rotation and revoke button. Owner actions require owner authentication.
- Activity: actual requests, allow/block reason, payment state, amount, duration and transaction/receipt links. Every row carries a request ID and timestamp.
- Request detail: service, authenticated agent, policy version, wallet-binding version, recipient, quote, settlement evidence and result preview.
- Receipt verifier: verify the backend's public-key signature on a historical decision receipt. Current authority status is a separate field.

Observations cover AgentPass tool activity. Do not imply complete visibility into every Hermes tool or its private reasoning. `last_seen` is the last bridge contact; it is not proof that Hermes remains online. Log actual action outcomes; never invent a live activity feed.

The public showcase exposes only the designated demo agent and published event fields. The owner uses a separate authenticated management view. Public visitors cannot spend test funds, change rules or trigger the developer's local Hermes process. Hermes remains local and calls the public API over HTTPS; no tunnel or public laptop port is required. When Hermes stops, the dashboard remains accessible and displays recorded activity with its last-seen timestamp.

The merchant supplies a small useful JSON research/data response at 0.20 USDC, a premium endpoint at 3 USDC, and a configured unapproved service for the denial case. Merchant prices/payees come from verified payment requirements and server-side service configuration, not amounts supplied by the LLM.

**Hermes tool contract**

| MCP tool | Input | Output |
|---|---|---|
| `agentpass_get_passport` | None | Agent identity, authority status, current wallet, budget, approved services. |
| `agentpass_list_services` | Optional search string | Configured demo services and displayed prices. |
| `agentpass_purchase_api` | `service_id`, `request_id`, bounded service parameters | `settled`, `blocked`, `pending` or `unknown`; reason, result/receipt IDs and budget. |
| `agentpass_get_payment` | `request_id` | Persisted payment state and available result. |

Resolve agent identity from its authenticated token; never accept an arbitrary `agent_id` as authorization. A repeated request ID with changed input must fail. The bridge preserves the request ID for retries. A new model tool call with a new ID is a new operation; do not claim to deduplicate every semantically similar request.

Use an isolated Hermes configuration/profile if the installed CLI supports it. Otherwise back up its config and merge one `agentpass` MCP entry without replacing the user's existing settings. Launch a restricted showcase session with the AgentPass tools enabled and no shell/filesystem tools that can inspect the developer's server credentials. Where local same-user administration remains possible, describe this as a prototype runtime restriction, not a hardened sandbox.

The integration configuration will point Hermes at the built MCP entry file, with only `AGENTPASS_API_URL` and `AGENTPASS_AGENT_TOKEN` provided to that bridge. Verify the exact tool names Hermes discovers in the installed version; do not guess the displayed prefix.

**Backend contract and persistence**

Core routes:

- `POST /api/owner/session` — establish the demo owner session.
- `POST /api/agents` and `GET /api/agents` — create/list owner agents.
- `GET /api/agent/passport` and `GET /api/services` — scoped agent reads.
- `POST /api/payments` and `GET /api/payments/[id]` — purchase/status.
- `PATCH /api/agents/[id]/policy`, `POST /api/agents/[id]/rotate-wallet`, `POST /api/agents/[id]/revoke` — owner-only changes.
- `GET /api/events?after=...` — owner observations; redact secrets and private task content.
- `GET /api/showcase` — read-only allowlisted fields for the published demo agent; never expose owner sessions, agent tokens or unpublished task inputs.
- `GET /api/receipts/[id]` and `POST /api/receipts/verify` — scoped receipt access and minimal proof verification.

Tables: `agents`, `wallet_bindings`, `policies`, `payment_intents`, `events`, `receipts`; a singleton owner/session mechanism is sufficient. Keep tokens hashed. Store USDC as integer base units: 0.20 USDC = 200000, 5 USDC = 5000000. Store monetary integers as decimal strings at JSON boundaries.

Use a Postgres transaction or conditional update to reserve from one agent/mandate budget. Require `spent + reserved + requested <= budget` and a unique `(agent_id, request_id)`. Every wallet for the agent uses this same budget. Network calls happen after the short database transaction, not while a row lock is held.

After reservation, recheck current policy and binding at durable signing admission. Serialize revocation against admission, and explicitly treat already admitted work as in flight. Persist `reserved -> signing -> submitted -> settled`, with `blocked`, `failed` and `unknown` as needed. Keep reserves for ambiguous outcomes. On request/retry, reconcile the recorded authorization/transaction rather than signing a fresh payment. Do not rely on work continuing after a serverless response ends.

Wallet rotation uses a pending binding until the new proof/registry update succeeds. Activate it atomically and disable new admissions on the old binding. Failed rotation keeps the old active binding. Previously admitted payments remain accounted for; ownership/identity history and aggregate spent amounts never reset.

The first receipt can be a backend-signed decision statement plus independently checked chain settlement evidence. Authenticate owner changes through the owner session; a cryptographically owner-signed AP2 mandate is not part of the three-hour core. Label the organization relationship as owner-attested, not KYB verified.

**Suggested file ownership**

| Owner/lane | Paths |
|---|---|
| Integrator/backend | `src/app/api/`, `src/lib/db.ts`, `src/lib/auth.ts`, `src/lib/policy.ts`, `src/lib/payments.ts`, `src/lib/identity.ts`, `src/lib/receipts.ts`, `db/schema.sql` |
| UI | `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/` |
| Hermes/tests | `integrations/hermes/`, `tests/`, `scripts/demo.ts`, `docs/demo-runbook.md` |
| Shared contract | `src/lib/contracts.ts`, edited by the integrator; everyone consumes it. |

**Acceptance checks**

1. Unpaid merchant request returns a real x402 challenge; authorized retry settles and returns data.
2. Over-limit or unapproved-recipient request reaches no signing call and changes neither spent nor reserved budget.
3. Two 0.20-USDC requests with only 0.30 remaining permit at most one payment reservation.
4. Repeating one request ID returns its recorded state/result and does not create a second payment.
5. Losing the HTTP response after signing does not automatically release budget or trigger a new signature.
6. Agent tokens cannot edit policies, rotate wallets or revoke other agents; owner routes require owner authentication.
7. Wallet A spends 0.20; after rotation, wallet B sees 4.80 remaining under the same agent ID.
8. New signing admissions after revocation commit fail. The UI accurately distinguishes in-flight work.
9. Tampering with a receipt makes verification fail; a settlement link corresponds to the configured chain.
10. Restarting the app or invoking a different Vercel instance retains budgets and history.
11. Open the deployed URL in an incognito browser or another device without a Vercel account. The showcase loads, public requests cannot invoke protected actions, and a real Hermes purchase updates the hosted page.

**Cut order and external blockers**

Stretch only after the core passes: human approval queue, second wallet provider, richer analytics, task launch from dashboard, full Hermes tracing, custom domains, signed owner mandates. Defer AP2/cards/UPI, reputation scoring and custom smart contracts.

At minute 45, a missing funded wallet or unusable facilitator is an explicit blocker to the real-payment promise. Continue the application while resolving it, but never substitute a fabricated transaction or call a local mock “settled on Base.” A labeled simulation is a rehearsal fallback and does not satisfy the live-payment acceptance check.

At minute 110, if registry registration is blocked, preserve a local signed agent identity and label it unregistered; do not display a made-up ERC-8004 token ID. That is a disclosed reduction in the showcase, not completion of registry integration.

At minute 30, inability to reach the public page is a deployment blocker: resolve account access, build or deployment-protection configuration immediately while independent backend work continues. Publish only the intended showcase surface; retain application-level authentication for protected actions.

At minute 135, freeze new integrations and prioritize the deployed acceptance checks. A localhost demo does not satisfy the public-URL requirement. A backup recording supports the presentation but does not replace a working deployed app.

**Showcase script: approximately three minutes**

1. Show ResearchBot in the dashboard: 5 USDC task budget, 1 USDC transaction cap, approved API and testnet identity.
2. Ask Hermes to fetch the paid research data. It selects `agentpass_purchase_api`; show the real request and payment appear in the dashboard.
3. Open the result and settlement link. Show 4.80 remaining.
4. Ask Hermes to purchase the 3-USDC premium endpoint. Show the deterministic denial and unchanged balance.
5. As the owner, rotate the wallet. Point to the same agent ID, history and 4.80 remaining; call this wallet rotation.
6. Revoke spending authority and request another purchase from Hermes. Show the denied request and reason.
7. Close with the business: companies pay to manage agent spending and evidence across their tools; additional wallet providers are the next integration.

Prepare the identity and faucet funding before the presentation, so external confirmation delays do not consume stage time. Demonstrate creation separately if it is reliable. Save a fresh demo run without deleting prior settlement records or reusing nonces; a reset creates new run/policy IDs and preserves old evidence.

Delivery: working public Vercel URL, hosted dashboard and API, MCP bridge configured for that URL, tested core controls, database setup, `.env.example`, local launch commands, real transaction evidence, and a short backup recording. The current deliverable is this implementation plan; application code and integration tests have not yet been built.
