# AgentPass setup and shopping walkthrough

## What the plugin does

You set an agent's identity, account binding, merchant allowlist and allowance in the AgentPass dashboard. Hermes uses a scoped credential to request authorization for an exact merchant URL, item and final amount. AgentPass reserves the amount atomically, returns a signed proof and records the decision. Online verification checks whether the authority is still valid.

The current account bindings are masked references only. They do not grant access to funds. Subscription billing is separate and still a free trial. The isolated Hermes profile contains only the five AgentPass tools; browser/commerce tools must be supplied by a shopping-capable runtime.

[Flow diagram](customer-purchase-flow.svg)

## Your own setup

1. Open https://agentpass-buildx.vercel.app and create a trial workspace.
2. Register your Hermes agent and securely copy its one-time credential.
3. Add an account reference, bind it to the agent, and set your rules. The demo uses ₹2,000 total, ₹800 per purchase and `amazon.in`.
4. In the repository, run `npm run plugin:configure`. Enter the app URL and the credential in the hidden local prompt.
5. Run `npm run hermes:platform`. Ask: “Use AgentPass to show my identity, account binding and remaining allowance in rupees.”

The demo workspace is already configured on this laptop. Its private sign-in is in `.agentpass-private/PLATFORM-DEMO.json`. Do not share that file or the scoped plugin settings.

## Live demonstration on 2026-09-17

- Actual Hermes read Atlas's identity: ₹2,000 total allowance, ₹800 purchase cap, ₹499 reserved by an earlier authorization-only test, ₹1,501 remaining.
- Using the assistant's browser tools, we found a real FLYNGO navy-blue umbrella at https://www.amazon.in/dp/B0H7SLQPYC.
- The listing displayed ₹499 inclusive of taxes, with free standard delivery for the browser's displayed location. That location has NOT been confirmed as the user's delivery address.
- One umbrella was added to the signed-out Amazon cart. The cart displayed a ₹499 subtotal.
- Proceeding to checkout reached Amazon's sign-in page. No order was submitted and no payment occurred. No new AgentPass authorization was issued for this product because the user's delivery address and final checkout total were not confirmed.

The browser actions were performed by the assistant, not by the isolated Hermes plugin. This is not evidence of autonomous Hermes checkout.

## Continue after Amazon sign-in

Sign in directly in the open Amazon checkout tab, select your own delivery address and inspect the final total. Do not send passwords, OTPs or payment secrets to a chat.

Once the actual final total is known, tell Hermes:

> Use AgentPass to authorize one FLYNGO navy-blue umbrella at https://www.amazon.in/dp/B0H7SLQPYC. The final checkout total I have confirmed, including shipping and taxes, is ₹[TOTAL]. Use request ID amazon-umbrella-live-001. Show the policy decision and verify current authority. Do not report it as ordered or paid.

Replace `[TOTAL]` with the observed checkout total. Reuse the same request ID only with identical parameters. If the price changes, cancel the unused authorization in the dashboard after confirming no payment occurred, then use a new request ID for the changed purchase.

If authorized, the current build requires the user to finish the merchant payment. Only after Amazon confirms an actual order should Hermes record the actual order reference using `report_order`. This is labelled client-reported, not independently verified settlement.

For hands-off buying, AgentPass still needs an execution provider integration plus shopping tools in the same Hermes runtime. The current walkthrough does not provide that capability.

## Undo this walkthrough

Remove the single FLYNGO umbrella from the Amazon cart if you do not want it. There is no order to cancel. This walkthrough has not created a new purchase reservation. Existing demo reservations can be released through Activity after confirming no payment occurred.

## Continuation after address selection

The user continued in the signed-in Codex browser. Amazon's final review showed one navy-blue FLYNGO umbrella, ₹499 item price, ₹5 marketplace fee, and ₹40 delivery offset by a ₹40 free-delivery discount: **₹504 total**. UPI scan-and-pay was selected, with free standard delivery on 19 September 2026. No payment button was submitted by the assistant.

Actual Hermes checked the passport/history, created request `amazon-umbrella-live-001`, and verified current authority. Intent `94484d1c-e682-4594-ac7f-6e15cef7fc2b` was authorized for 50,400 paise. Remaining allowance became ₹997, with ₹504 reserved for this request and ₹499 still held by the earlier test. The dashboard independently reported current authority valid, with no payment confirmed. The authorization expires at 02:11:34 IST on 17 September 2026; it is not perpetual permission.

At this stage the user must complete Amazon's **Pay with UPI** flow to make a real purchase. If abandoning the purchase, remove the cart item and release this reservation only after confirming no payment occurred. The earlier “no new reservation” statement describes the initial sign-in stage, before this continuation.
