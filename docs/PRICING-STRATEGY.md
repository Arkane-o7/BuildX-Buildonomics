# AgentPass pricing proposal

Prepared 17 September 2026. Proposed India-first B2B packaging for startups and enterprises; prices, limits, and conversion hypotheses require customer validation. This document does not activate billing or describe all listed features as shipped.

## Commercial model

Sell a company workspace for managing agents' spending authority, approvals, and evidence. Charge a recurring platform fee with included authorization volume, optional prepaid usage packs, and separately scoped enterprise implementation. The customer supplies its agent runtime. Merchant purchases, model usage, and external payment-provider charges are separate from the software subscription.

Start with teams already operating agents with recurring purchasing workflows. The initial champion is a developer or platform lead; the economic buyer is the CTO or operations leader, with finance and security involved in larger accounts. Acquire customers through MCP integrations, runnable examples, and founder-led outreach around an actual purchasing workflow. Expand within accounts as additional teams need shared controls.

## Proposed public packages

| | Startup | Business | Enterprise |
|---|---|---|---|
| Monthly subscription | ₹4,999 | ₹19,999 | Custom; minimum ₹9 lakh/year |
| Annual subscription, prepaid | ₹49,990 | ₹1,99,990 | Negotiated contract |
| Intended buyer | One team deploying agents | Multiple teams coordinating spend | Organization-wide deployment |
| Production agents enabled concurrently | 10 | 50 | Contracted |
| Unique authorization requests/month | 5,000 | 25,000 | Contracted |
| Core offering | Agent credentials, account references, merchant restrictions, spending limits, owner approval inbox, activity export | Startup plus shared team budgets, configurable team approvals, roles, alerts, and reporting | Business plus SSO/SCIM, tailored retention, supported custom integrations, and agreed support/SLA |
| Proposed activity retention | 90 days | 365 days | Contracted |
| Human reviewers | Unlimited | Unlimited | Unlimited |
| CTA after production launch | Start 14-day trial | Start 14-day trial | Discuss your deployment |

Only label Business “Recommended for multiple teams.” Do not claim it is “Most popular” without measured customer evidence. The Enterprise minimum is a pricing hypothesis, not a fabricated comparison price. Show the annual contract minimum prominently; do not present it as a cancellable ₹75,000 monthly subscription.

Free sandbox: two agents, 100 simulated purchase intents per month, no production execution, community documentation. Place its visible “Build in the free sandbox” link below the three commercial cards. A genuinely isolated simulation mode must be built before offering this sandbox. The current event trial is a separate existing entitlement and must not be silently relabeled or reduced.

All plans retain basic spending limits, merchant restrictions, revocation, credential rotation, and access to available activity records. Charge for organizational complexity, scale, and support. Do not make basic control of spending dependent on an upgrade. Human reviewers should not incur extra seat fees.

## Pricing-page treatment

Headline: “Give your agents spending authority. Keep your company in control.”

Supporting copy: “Set budgets, review purchase requests, and trace decisions in one workspace.”

Use three comparable cards with Business visually emphasized. Default to monthly prices during validation. An equally accessible annual toggle says “Save 16.7% on the base subscription.” The exact saving is one sixth of twelve monthly payments. Show the full annual amount and “billed annually” beside the selected price. If using a monthly equivalent, show it alongside—not instead of—the full annual invoice amount. Usage allowances reset monthly even on an annual subscription; unused allowances do not roll over.

State “Prices exclude applicable taxes” by the table. Before checkout, show the exact tax, total due, billing period, renewal date, included usage, and any approved additions. Show separate provider costs where applicable and never imply purchases are included.

Use a short comparison table and a recommendation based on stated needs: shared budgets or team approval routing suggests Business; SSO or a contractual SLA suggests Enterprise. Explain the recommendation and leave every eligible plan selectable. Do not use agent count alone to recommend enterprise contracts.

Conversion hypotheses to test:

- A useful Startup package reduces the barrier to a first production deployment.
- Business sells shared accountability and fewer manual approval steps; its higher agent allowance supports that value.
- A real enterprise offer establishes the upper end of the service without inventing an unusable decoy plan.
- A guided trial demonstrates value before asking for a recurring commitment.
- Genuine annual savings give customers a reason to commit after proving fit.
- Prompts attached to an attempted advanced feature explain the specific upgrade benefit.
- Real customer examples and measured outcomes can reduce uncertainty once permission and evidence exist.

Avoid invented customer logos, unsubstantiated savings, fake crossed-out prices, resetting countdowns, preselected paid extras, surprise renewals, and cancellation obstruction. These undermine the product's spending-control proposition. Use actual capacity limits or offer deadlines only when they are real and enforced consistently.

## Trial and purchase journey

After the launch requirements below are met, offer a 14-day Business trial with no card required and a stated trial quota. Guide the user through connecting one agent, defining a budget, authorizing an allowed request, observing a blocked request, and reviewing the evidence. Demonstrate team approvals only once that feature exists. Track completed workflows, not merely account creation.

Show days remaining and provide reminders three days and one day before expiry. At expiry, keep historical records available within the disclosed retention period, preserve configuration, and pause new production authorizations until a paid plan is selected. Never silently bypass checks. Trial expiry does not cancel external purchases or void in-flight obligations; reconcile them normally.

An upgrade requires the owner's explicit acceptance of its price and any prorated charge. Downgrades take effect at renewal with an explicit list of incompatible features and an owner-selected set of enabled agents if necessary. Cancellation disables renewal through account billing, preserves service through the paid term, and confirms the end date. State refund terms before purchase. After the paid term, pause new production authorizations while retaining revocation, reconciliation, and access/export to existing records for their disclosed retention period. Do not delete records early as a cancellation penalty.

For assisted pilots now: propose ₹10,000/month for a two-month, explicitly scoped engagement, with onboarding and a success review. State exactly which existing capabilities are included. Do not auto-convert a pilot to a higher-priced plan. Quote any bespoke implementation separately. Invoice collection or production billing must be established before accepting payment.

## Metering and cost predictability

One billable unit is one authenticated, valid, unique purchase intent evaluated against policy, whether allowed or blocked. Count it once when its decision is durably recorded. This is an authorization request, not a settled payment. Retries of the same intent, verification, status polling, credential rotation, revocation, malformed requests, and internal service errors are not billable. Rate-limit abuse separately.

Proposed additional usage: ₹1,000 per prepaid pack of 5,000 requests on Startup and Business. Display pack validity before purchase; initially use a 12-month validity, consume included monthly usage first, then oldest packs. Packages are a cost hypothesis that must cover measured delivery costs. Do not bill on transaction value. Agent limits are a package entitlement, not an additional per-agent invoice line. Archived identities and retained history do not consume enabled-agent capacity; reject excess activation with a clear plan-change option.

Default to no automatic overage purchase. Notify workspace owners at 70%, 90%, and 100% of included quota. At exhaustion, use already purchased credits or pause admission of new requests before reservation or external execution. Continue verification, revocation, and reconciliation for existing operations. Offer explicit prepaid top-ups. A later optional auto-top-up must have a separately approved monthly rupee ceiling, visible usage, and an immediate off switch. No agent credential can authorize subscription spending.

Do not force Business merely because a Startup account needs more request volume: volume packs and advanced organizational features solve different needs. Show the cheapest eligible option for the customer's actual requirements.

## Launch prerequisites and current boundaries

The repository currently supplies an event trial, account references, agent identities, authorization controls, activity, and a phone payment handoff. Automatic delegated payment execution and paid subscription billing are not connected. Phone handoff and owner-reported payment are not independently verified settlement. Enforcement covers paths through AgentPass; independent payment access can bypass this boundary.

Before self-service paid launch, deliver subscription checkout, verified billing events, entitlements, auditable usage metering, limits and notifications, cancellation and invoices, secure account recovery, production monitoring, and the advertised package features. Implement actual team membership and budget/approval controls before charging for Business features. Offer enterprise SSO, retention terms, support, and SLAs only when deliverable. Until then, publish pilot/request-access copy with an explicit current-capability description.

## Validation and economics

Recruit five paid design partners with an existing recurring workflow. At this sample size, use interviews and observed renewals rather than claiming statistical A/B significance. Record activation, weekly use, conversion, renewal, support time, attributable delivery costs, and which features actually cause upgrades.

Primary commercial metric: recurring gross profit from retained cohorts. Supporting measures: qualified visitor-to-activated-workspace conversion, trial-to-paid conversion, 60/90-day paid retention, expansion, cancellation reasons, billing disputes, and time to first useful workflow. A higher signup rate with worse retention is not a successful pricing change.

Target 80% subscription gross margin after infrastructure, provider charges absorbed by AgentPass, billing collection fees, and directly attributable support. At the proposed annual prices, that leaves approximately ₹833/month in direct delivery cost for Startup and ₹3,333/month for Business. These are cost ceilings implied by the target, not measured costs. Scope high-touch onboarding separately.

First validate packaging and actual willingness to renew. Then test one variable at a time: annual presentation, guided trial onboarding, or Business pricing around the proposed ₹19,999. Hold existing customer terms stable during tests and honor quoted offers. Use real customer outcomes before introducing an ROI calculator; any calculator must expose its assumptions and distinguish simulated savings from observed savings.

## Research references

- [Stripe: recurring pricing models](https://docs.stripe.com/products-prices/pricing-models) — mechanics of flat, tiered, and usage pricing; does not establish AgentPass willingness to pay.
- [Paddle: SaaS billing](https://developer.paddle.com/get-started/how-paddle-works/saas/) — tier packaging and subscription lifecycle capabilities.
- [Crossmint pricing](https://www.crossmint.com/pricing) and [Privy pricing](https://www.privy.io/pricing) — adjacent infrastructure benchmarks, not directly comparable AgentPass packages.
- [FTC: Bringing Dark Patterns to Light](https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf) — examples of hidden costs, unexpected recurring charges, and interface interference. Used as design guidance, not a claim about jurisdiction-specific legal obligations.
