# AgentPass identity and wallet-control demo

Show the AgentPass dashboard beside Hermes. This demo needs no Amazon browser. The current product supplies owner-attested agent identity, masked account references, spending policies, signed authorizations and audit history. It does not hold a funded INR wallet or execute UPI/card payments. Subscription billing remains an event trial.

## Start actual Hermes with only AgentPass tools

Interrupt any browser run with Ctrl+C, then type `/exit`. From the project terminal:

```sh
npm run hermes:platform -- --cli
```

This uses the currently configured customer credential and only five AgentPass tools. It does not load browser tools or the shopping profile's previous umbrella context.

## Three-minute presentation

1. Open **Agents** in your own dashboard. Ask Hermes:

   > Use passport. Show my owner, stable agent ID, status, linked masked payment reference, total spending allowance, per-purchase cap, reserved amount and remaining allowance. Explain whether payment execution is connected. Do not browse or create purchases.

   Match the agent and payment-account binding against the dashboard. The UPI reference is not proof of bank ownership; the identity is owner-attested, not KYC.

2. Open **Activity**. The existing real merchant quote is `coke-can-live-001`, INR 125. Ask:

   > Use purchase_history to find coke-can-live-001 and verify_authority to check it. If it is currently valid, retry authorize_purchase with the exact saved request ID, item, URL and amount. Show that the intent ID and reserved amount remain unchanged. Do not report an order or payment. If expired, say so and stop this step.

   This demonstrates a signed permission and protection against duplicate reservations. It does not demonstrate a successful charge.

3. Show the two **DEMO ONLY** blocked requests created by `npm run demo:identity-wallet`: one above the per-purchase cap and one for an unapproved merchant. Ask Hermes to read their reasons with purchase_history. These synthetic inputs are policy tests, not actual merchant offers. They reserve no additional allowance.

4. Optional strongest live control demo: while an authorization is still valid, change the agent's bound payment reference in the dashboard. Add a clearly named demo card reference first if needed (four fictional digits only; this connects no real card). Ask Hermes to run passport again and verify the old intent. The agent ID stays the same, the binding changes, and the old authorization is no longer valid. Switching back still requires fresh authority; it does not revive the old proof. Existing reservations must be released separately after confirming no payment occurred.

## Repeatable check

```sh
npm run demo:identity-wallet
```

This uses the same scoped MCP connection as Hermes. It verifies the passport signature against the service-returned public key, checks current spending authority, retries the exact purchase, and submits the two labelled denial tests. It checks that reserved allowance and reported spending did not change. It never calls report_order or a merchant/payment API. Blocked request IDs are stable per policy version, so reruns do not duplicate those rows.

The check needs an unexpired, currently valid authorization. Authorizations expire after 15 minutes. For a later event rehearsal, use a newly verified merchant quote, or explicitly ask Hermes for a **synthetic authorization-only test** with a labelled fictional amount, an allowed merchant URL, and a fresh request ID. Disclose the synthetic nature during the presentation. A successful test reserves allowance; release it afterward in Activity using **Confirm no payment occurred & release reservation**. Do not manufacture an order reference.

## Suggested narration

“Hermes has an owner-scoped identity. AgentPass binds it to a payment-account reference and limits what it may spend. Here is an exact purchase authorization, a duplicate retry that reserves nothing extra, and two requests denied by policy. The owner can change the account binding while preserving the agent's identity. These are real policy decisions; autonomous bank payment execution is the next integration.”
