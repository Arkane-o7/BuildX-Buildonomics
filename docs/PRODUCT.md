# AgentPass product contract

AgentPass is a subscription SaaS with an agent plugin: customers manage their agents' identities, wallet bindings, spending authority and payment evidence from one account. Hermes is a client of AgentPass, not the product itself. An Amazon purchase is an example use case, not a separate merchant business operated by AgentPass.

## Customer workflow

1. Create an account and register an agent.
2. Bind an existing payment account or a supported provider wallet to that stable identity.
3. Set merchant, transaction and aggregate spending limits.
4. Install the plugin with a scoped, revocable agent credential.
5. The agent submits an exact external-merchant purchase intent. AgentPass authorizes or rejects it independently of the model.
6. A supported payment adapter executes the authorized intent. Payment evidence returns to the agent identity. Unsupported adapters must disclose that payment execution is unavailable or requires the payer.
7. Replace a wallet without resetting identity, expenditure or audit history. Revoke new authority centrally.

## Separate billing from spending

Subscription payments pay **AgentPass for its software**. Customer purchases pay **external merchants**. A merchant checkout credential for collecting AgentPass subscription revenue does not authorize spending a customer's UPI balance or card at Amazon. Do not require every customer to create a Razorpay merchant account.

## Evidence rules

- Owner-attested identity is not KYC or independently verified ownership.
- A stored UPI handle or card label is a payment-account reference, not an executable wallet, balance or mandate. Never store card PAN/CVV or UPI PIN in the plugin.
- A signed spending authorization is not a payment receipt. It must be checked for current authority and expiry, and bound to merchant, URL, amount, agent and wallet version.
- Browser-reported orders are not provider-verified settlement. Keep the evidence source explicit.
- Policy governs operations that actually pass through AgentPass. An unrestricted agent with another direct payment path can bypass an advisory plugin.
- Real unattended UPI/card purchases require a supported provider/delegation integration. Do not substitute an internal simulated balance and call it a fix.

## Current delivery boundary

Build the real customer/control-plane primitives first: account isolation, agent credentials, wallet binding, policies, exact purchase intents, current authority verification and activity. Preserve the previous seller-side checkout experiment under `/lab` for reference; it is not the customer-facing product.

Paid subscription activation and executable payment-provider connections are separate integrations. A trial account must not be labelled a paid subscription. An unimplemented payment connection must not be labelled active.
