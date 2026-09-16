# AgentPass: verified assessment and recommended build

Checked 16 September 2026. Based on the supplied ChatGPT conversation, both attached research notes, current primary documentation, package metadata, repository licenses, and selected source files. This is a research and architecture assessment; dependencies have not been installed, executed, audited, or tested against funded wallets. Vendor descriptions establish advertised features, not demonstrated reliability or adoption.

Scheduling update: the user has specified three hours, an existing Hermes runtime and a Vercel dashboard. Follow the [three-hour implementation plan](three-hour-implementation-plan.md) for execution; its scope and stack replace the three-day proposal below.

Companion files: [repository check](repository-check.md), [architecture diagram](agentpass-architecture.svg), [editable diagram source](agentpass-architecture.mmd).

**Recommendation**

Keep AgentPass as a business-hackathon project. Give it one concrete promise: a company can authorize an agent to buy approved APIs, see evidence for each payment, replace its wallet without resetting its budget, and stop new spending through one control.

Suggested one-liner: **AgentPass gives AI agents a spending account with company rules that follow them when their wallet changes.**

The product can provision a wallet through an existing provider. Your implementation should concentrate on the relationship between an organization, an agent, a mandate, a shared budget, and executed payments. Portable identity alone is easy to reproduce. Correct shared accounting, integrations, and usable operational controls are a more meaningful product hypothesis. Neither is an established moat today.

The repository was empty at review time. The following is a proposed build, not a description of working AgentPass software. Schedule assumes roughly three days and a small team; the source conversation establishes a business hackathon but not the actual deadline.

**What the research gets right—and what needs correcting**

| Claim | Assessment and consequence |
|---|---|
| ERC-8004 identity/reputation registries are deployed on Base and Base Sepolia. | Confirmed in the maintainers’ [deployment list](https://github.com/erc-8004/erc-8004-contracts#contract-addresses). Consume the existing registry; a private fork would fragment discovery. Verify the chain, full address, deployed code and ABI during integration. |
| ERC-8004 lacks wallet-control proof. | Incorrect. `setAgentWallet` requires EIP-712 or ERC-1271 proof. Transfer of the identity clears its wallet association. The field represents a receiving wallet; it does not grant arbitrary spending authority. The EIP is still marked Draft. [Specification](https://eips.ethereum.org/EIPS/eip-8004). |
| An NFT owner or signed company name proves legal organization identity. | Incorrect inference. A signature proves control of a signing key. A separate enrollment process must establish why that key represents the organization. For the demo label this “owner attested”; only claim domain verification or KYB if actually performed. |
| x402 moved to Linux Foundation governance in April, becoming operational in July with 40 members. | Confirmed: [April 2 announcement](https://www.linuxfoundation.org/press/linux-foundation-is-launching-the-x402-foundation-and-welcoming-the-contribution-of-the-x402-protocol) and [July 14 operational launch](https://www.linuxfoundation.org/press/linux-foundation-announces-operational-launch-of-x402-foundation-to-standardize-internet-native-payments-for-ai-agents-and-applications). “40 members” describes the launch, not a independently checked current membership count. |
| Circle already provides agent spending policies. | Confirmed, including rolling limits and address restrictions, currently mainnet only. The attached note misidentifies the relevant custody product: current Agent Wallet documentation says it builds on **user-controlled** wallets using 2-of-2 MPC. [Agent Wallets](https://developers.circle.com/agent-stack/agent-wallets), [policy documentation](https://developers.circle.com/agent-stack/agent-wallets/wallet-operations/custom-policies). |
| MoonPay launched the Open Wallet Standard in March 2026. | Confirmed for March 23; the company describes MIT-licensed infrastructure and contributions from more than 15 organizations. This does not establish universal adoption or prove every integration works. [Announcement](https://www.moonpay.com/newsroom/open-wallet-standard). |
| There are existing agent spending-policy projects. | Confirmed. AgentVeins, x402-agent-wallet, Fystack, and others exist. Feature descriptions do not establish strong concurrency behavior, secure deployment, or operational maturity. See the separate repository check. |
| Nobody combines identity, authority, wallets, verification and a dashboard. | Unsupported and misleading. [Agnic](https://www.agnic.ai/) advertises identity, mandates, controls, receipts and revocation, with a [merchant verification example](https://pioneers.agnic.ai/build/trust). [Nevermined](https://mta-sts.nevermined.io/use-cases/agentic-payments-infrastructure/) describes identity, spending authority, organizations and settlement. [Crossmint](https://docs.crossmint.com/agents/overview) covers controlled wallet/card payments. [Skyfire KYAPay](https://kyapay.org/whitepaper) links identity and payment. |
| Skyfire and Nevermined are simply closed alternatives. | Too broad: hosted services can coexist with public protocols and SDKs. There are public [KYAPay examples](https://github.com/skyfire-xyz/kyapay) and [Nevermined payment libraries](https://github.com/nevermined-io/payments). Public code does not establish that the entire hosted service is independently deployable. |
| AP2 is just a protocol, and an AP2-shaped JSON object can be sent to any x402 facilitator. | Misleading. The official repository has schemas and samples, while interoperability still requires the relevant mandate verification and payment integration. Arbitrary AgentPass credentials are not automatically understood by x402 facilitators. [AP2 repository](https://github.com/google-agentic-commerce/AP2), [A2A x402 extension](https://github.com/google-agentic-commerce/a2a-x402). |
| AP2 was contributed to FIDO in April 2026. | Confirmed by the [April 28 FIDO announcement](https://fidoalliance.org/fido-alliance-to-develop-standards-for-trusted-ai-agent-interactions/). Contribution and standards work do not imply finalized universal compatibility. |
| Visa and Mastercard are working on agent identity/authorization. | Confirmed in [Visa TAP documentation](https://developer.visa.com/capabilities/trusted-agent-protocol/docs) and [Mastercard’s June announcement](https://www.mastercard.com/us/en/news-and-trends/press/2026/june/mastercard-launches-agent-pay-for-machines.html). Do not assume these systems are limited to one rail or inherently incompatible with portability. |
| NPCI is building an agent registry. | Supported as **Reuters reporting based on sources**, published September 10, rather than a public integration specification or proof of available third-party access. [Reuters syndication](https://www.marketscreener.com/news/india-plans-ai-registry-as-it-looks-to-roll-out-agentic-payments-sources-say-ce785bdedd88f524). Keep UPI as future exploration, not demonstrated compatibility. |
| Payment receipts make an agent trustworthy. | Overstated. Settlement evidence supports that money moved; delivery evidence supports that a response was received; task-quality evidence requires another assessment. Paid self-transactions or colluding counterparties can inflate activity. Start with an evidence ledger and defer a reputation score. |
| Idempotency solves replay protection. | These address different failures. Idempotency ties retries to one business operation. Payment nonces, scope, expiration and credential validation prevent authorization reuse. Both are needed; neither implies exactly-once execution across arbitrary remote services. |
| Identity, policies and wallet permissions can be revoked atomically across providers. | Not a general guarantee. Block new AgentPass authorizations at a defined local commit point, then propagate provider revocations and show pending failures. Previously issued payment signatures and submitted transactions need reconciliation; a database flag cannot erase them. |
| The published patent claim establishes low commercial risk. | Not verified. An indexed older SDK README repeats the maintainer’s provisional-filing claim; the current fetched README differs substantially. No independent patent record or scope assessment was performed. Do not repeat the attached note’s risk conclusion. [Indexed project page](https://github.com/up2itnow0822/agent-wallet-sdk). |

**Two source-code findings that change the build recommendation**

The suggested `wgopar/a2a-x402-agent-template` is useful for the **seller** in the demo. Its [payment module](https://github.com/wgopar/a2a-x402-agent-template/blob/main/src/payments/x402.ts) constructs a resource server, sets route prices and receives payments at `payTo`. That does not implement the buyer’s protected signing service, shared budget or payment reconciliation. It is not a ready-made AgentPass backend.

The recommended `nirholas/x402-agent-wallet` deserves a cautious reading. Its [signing implementation](https://github.com/nirholas/x402-agent-wallet/blob/main/src/sign.ts) uses HMAC-SHA256, which requires a shared secret for verification. It is not a receipt that arbitrary merchants can verify with a public key. Its [paying wrapper](https://github.com/nirholas/x402-agent-wallet/blob/main/src/wrap.ts) checks policy before awaiting payment and records spending afterward. The inspected path contains no intervening budget reservation. **Static-code inference:** concurrent requests can observe the same remaining budget before either spend is recorded; a paid request whose response is lost also needs explicit reconciliation. This was not reproduced in a running test and is not a full audit.

These findings support “existing implementations are useful references.” They do not support “safe agent spending has been solved, just rebrand an SDK.”

**The first customer and the value proposition**

Target a small company or platform operating research/data agents that buy paid APIs across several services. The immediate buyer is the developer or platform lead who owns both uptime and the bill. Sell controlled autonomous API purchasing with per-job budgets and an audit trail.

Do not start by requiring both companies and merchants to join a new identity network. The buyer gets value from protected payments to ordinary compatible x402 endpoints. Offer verification middleware free to merchants that want it. Their adoption can follow an actual need for authorization evidence.

Before expanding, interview 8–10 relevant builders. Ask for an actual spending workflow, how they cap it today, a retry or runaway-cost incident, whether several wallets/providers are really used, and what they would pay to remove the problem. A useful decision gate is two teams willing to run a paid pilot. If one existing provider solves everything they need, the portability pitch needs stronger evidence or a different initial use case.

**What to build**

The core demo should have an agent passport, owner-approved policy, spending log and one revoke control. Use one network, one asset, a small set of approved API endpoints, and one agent tool such as `purchase_api`.

1. Create ResearchBot and associate its organization owner and public registry identity.
2. Set a 5 USDC task budget and 1 USDC transaction limit, scoped to approved URL/payee pairs.
3. Buy a 0.20 USDC API response and link the decision to settlement evidence.
4. Reject a 3 USDC request and an unapproved payee before signing.
5. Reject duplicate or concurrent spending that would exceed the same budget.
6. Replace wallet A with wallet B under owner approval. The same agent still has **4.80 USDC** remaining; the old binding stops receiving new authorization.
7. Revoke the mandate and reject the next otherwise valid request. Preserve the identity and historical records.

The sixth step is the differentiating demonstration. If A and B are only two addresses under one provider, call it **wallet rotation**. Claim cross-provider support only after two distinct integrations execute successfully under the same budget. Fund them separately for the demo; identity portability does not move assets between accounts.

Defer reputation scores, cards, UPI, swaps, bridging, marketplace discovery, on-chain audit entries for each decision, and full AP2 integration. Keep the architecture capable of adding adapters without promising capabilities that do not work yet.

**Recommended stack and reuse**

| Component | Initial choice | Why |
|---|---|---|
| Dashboard | Next.js, TypeScript, Tailwind | One familiar frontend stack. |
| Control service | Hono on Node.js | Small API surface; no need for a large agent framework. |
| Identity access | viem with maintainers’ ABI and existing Base Sepolia registry | Avoid dependence on an unverified wrapper for a few contract calls. Keep the chain and registry in the identifier. |
| Payments | Official x402 v2 TypeScript packages; Base Sepolia USDC; exact-price flow | Use maintained protocol implementations, pin compatible versions and verify the full flow. |
| Signing adapter | CDP server account behind the control service | Current [CDP SDK](https://github.com/coinbase/cdp-sdk/blob/main/typescript/packages/cdp-sdk/README.md) exposes wallet and x402 functionality. AgentKit is optional if its framework integrations are useful. |
| Second adapter | Isolated viem signer for testnet; provider-backed integration when time permits | Prove adapter independence. A local test signer is not evidence of production custody or universal portability. |
| Budget and state | PostgreSQL | Transactional reservations, uniqueness constraints, authority versions and recovery state belong here. Redis is optional caching, not the authoritative budget. |
| Verifiable evidence | EIP-712 owner authorization; public-key signed decision receipts using a standard library | Distinguish who granted authority, who evaluated it and what settled. Publish verifier keys and key IDs. |
| Demo merchant | Minimal official x402 server example, or extracted seller module from wgopar | Keep merchant/payment concerns separate from buyer authority. |

The preferred demo trust model is **service-enforced spending with isolated signing**. The agent can request payment but cannot access the signing service’s provider credentials, private keys, arbitrary signing endpoint or policy-management credentials. Isolation means a separate process/security boundary, not merely another function in the same unrestricted agent runtime. The owner can administer its account; the autonomous runtime cannot.

This does not establish that AgentPass is non-custodial or that its own limits are on-chain. If those guarantees become requirements, select a wallet with inspectable contract enforcement and prove compatibility with the exact token, signing scheme, facilitator and session permissions. In particular, a spending limit on wallet `execute()` does not automatically govern EIP-712 token authorizations that bypass that path. The official [x402 EVM exact scheme](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md) should guide that compatibility test.

**The engineering contract**

Use an immutable payment intent containing the authenticated agent, mandate/version, wallet binding/version, chain, token contract, integer token amount, canonical destination, API resource and request hash, expiry and a request ID. Merchant category labels supplied by the LLM are insufficient; start with owner-configured endpoint and payee pairs.

Authorization checks include agent credentials, active owner mandate, current wallet binding, destination restrictions, per-request limit and aggregate remaining budget. Reserve budget transactionally **before signing**, across all wallets attached to that mandate. A human approval authorizes the exact request and cannot silently change its destination or amount. Hard spending caps still apply unless the owner explicitly revises the mandate.

Model execution with durable states such as `reserved`, `signing`, `submitted`, `settled`, `failed` and `unknown`. Persist an intent before external signing; record submission identifiers and payment nonce so recovery can reconcile a crash. Do not release funds reserved for an uncertain payment just because an HTTP timeout occurred. Release only after establishing failure, cancellation or unusable expiry; settlement commits the spend.

Serialize revocation with new authorization/signing admission and invalidate stale mandate versions. Track signatures already admitted or issued separately. Describe the result precisely: **new authorizations through AgentPass stop after revocation commits; in-flight obligations are reconciled**. Other providers have their own revocation acknowledgements and any retained direct spending paths remain outside this guarantee.

Expose separate concepts:

| Operation | Meaning |
|---|---|
| Verify identity/receipt | Cryptographic and status evidence as of a specified point; does not reserve money. |
| Authorize payment | Changes state, reserves budget, binds one exact payment intent. |
| Execute payment | Uses the protected signer and records durable external-payment state. |
| Reconcile payment | Establishes settlement/failure after timeouts or crashes. |
| Revoke mandate | Prevents new authorizations and begins downstream revocation where applicable. |

An offline-verifiable receipt establishes what a trusted issuer signed. It cannot establish that authority remains unrevoked now without a freshness/status mechanism. Return separate facts rather than a single ambiguous `verified: true` or a public disclosure of the company’s whole budget.

**Build order and acceptance evidence**

| Phase | Deliverable and completion condition |
|---|---|
| First 2–4 hours | One official x402 test payment, receipt/transaction lookup, registry read and wallet binding call. Prove the exact SDK/facilitator combination before UI work. |
| Day 1 | Protected signer, mandate model, one agent tool and persistent budget reservations. Demonstrate allowed and blocked requests. |
| Day 2 | Revocation, wallet rotation, idempotency and uncertain-payment recovery. Exercise concurrent requests, altered quotes, stale binding and stale mandate failures. |
| Day 3 | Passport dashboard, merchant receipt verifier, live demo and short backup recording. Attempt the second real provider only after the core path is reliable. |

Prioritize meaningful checks: two simultaneous requests near the budget boundary; retry after payment succeeds but the response is lost; revocation racing with payment admission; wallet rotation without a fresh budget; changed payee/token/network/amount; and an agent attempting the signer directly. Show the relevant decision record and settlement evidence. Do not promise throughput before measuring it.

For scaling, API instances can replicate, but authorization is stateful. Partition by organization/mandate, serialize updates for one budget, use a durable reconciliation worker and keep identity caches separate from authoritative budget/revocation state. Splitting one global budget into concurrent independent quotas trades flexibility for throughput and must preserve the sum of allocations.

**Business model, market numbers and pitch**

Start with hosted SaaS for the agent operator. Test a **$99–$299/month paid pilot** including a bounded amount of usage, then price for actual authorization volume, retained audit data and enterprise integrations. These are proposed experiments, not validated market prices. Keep the basic receipt verifier free; defer merchant fees and a settlement percentage until there is evidence customers will pay them. Hosting, signing, chain operations, reconciliation and support must be covered by gross margin.

The McKinsey forecast of **$3T–$5T global consumer commerce by 2030** is real, includes goods, and excludes services and B2B in the original estimate. It is commerce volume, not AgentPass revenue. [Original report](https://www.mckinsey.com/~/media/mckinsey/business%20functions/quantumblack/our%20insights/the%20agentic%20commerce%20opportunity%20how%20ai%20agents%20are%20ushering%20in%20a%20new%20era%20for%20consumers%20and%20merchants/the-agentic-commerce-opportunity-how-ai-agents-are-ushering-in-a-new-era-for-consumers-and-merchants_final.pdf).

Gartner’s **$985B by 2030** agentic-software forecast also appears in its [February 17 public abstract](https://www.gartner.com/en/documents/7455226); the full research was not inspected. It describes a much broader software category. Neither number establishes demand for this particular product.

The 5–20 basis-point calculation in the supplied notes is arithmetically correct: $1.5B–$10B against $3T–$5T. The capture assumption is unvalidated and poorly matched to the initial SaaS proposition. Use a bottom-up model once a reachable buyer list exists. For illustration only, 100 customers paying $200/month produce $240,000 ARR. That is a revenue scenario, not a measured SAM.

Your first defensible differentiation claim is a **demonstrated workflow**, not “first,” “only,” a universal trust network, or a feature matrix with unsupported competitor crosses. A longer-term advantage would require customer adoption, dependable adapters, organization-level controls, reconciliation, integrations with accounting/security systems, and trust in your evidence. Public receipts or a registry alone do not automatically create a proprietary data moat.

For the short hackathon deck, preserve the supplied template: one-liner; specific spending problem; product screen; honest competition; architecture plus demo evidence; business/scaling; challenges and next steps. Spend the strongest demo moment on wallet replacement with the budget preserved. Mark all future integrations clearly.

The most persuasive result would be: **ResearchBot spends 0.20 USDC, moves to a different wallet with 4.80 USDC still available, fails an over-budget request, and loses new spending authority when the owner revokes it—with the evidence visible throughout.**
