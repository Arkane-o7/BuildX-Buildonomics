# Present the actual AgentPass control plugin

Open your customer dashboard. Register Atlas, add an **example** payment-account reference, bind it, and set a ₹2,000 allowance, ₹800 purchase cap and `amazon.in` allowlist. Connect the scoped credential with `npm run plugin:configure` and start `npm run hermes:platform`.

## Identity and authorization demo

Use this exact prompt. The product/URL is intentionally a test fixture, not a researched or buyable product:

> Check my AgentPass passport. For this authorization-only test, use item "Demo umbrella", URL https://www.amazon.in/dp/EXAMPLE, final total ₹499 including delivery, request ID umbrella-policy-001. Request authorization and show the decision. Do not place an order or claim that payment happened.

The agent should call `passport` then `authorize_purchase`. The dashboard shows ₹499 reserved, an exact purchase intent and a signed authorization. It must say no payment was executed.

Repeat the identical request: there must be one reservation, not two. Change the amount using the same request ID: it must reject the conflicting intent. Try ₹900 under a new request ID: it must be blocked by the ₹800 cap.

## Revocation and account replacement

Tell Hermes to verify the intent's current authority. Revoke Atlas in the dashboard; verify again and see `authorized:false` while the historical signature remains authentic. Restore authority and switch its payment-account reference. The agent identity and spending history remain unchanged; the old proof stays invalid.

Reservations stay held after expiry/revocation/rebinding until the owner confirms no payment occurred. Inspect an intent under **Activity** to explicitly release it. This never cancels an external order.

## What the shopping flow still needs

For a real product, use Hermes with its existing browser/commerce tools plus the AgentPass MCP entry. Ask it to find an umbrella, observe the merchant's exact final price and request authorization. The isolated launcher has no browser tools and must not invent product information.

This build cannot automatically debit UPI/cards, so the payment execution step is not part of this demo. `report_order` records only a real, observed merchant order reference and labels it client-reported/unverified. Do not fabricate a reference to make the demo look paid.

The trial subscription screen demonstrates SaaS account separation, not a paid billing integration. Real subscription billing and delegated payment execution remain separate outstanding integrations.
