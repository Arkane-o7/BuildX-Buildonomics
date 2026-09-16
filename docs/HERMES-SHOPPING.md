# Try shopping in actual Hermes

From this repository, run:

```sh
npm run hermes:shopping -- --cli
```

This starts the installed Hermes CLI with native browser tools and all five AgentPass MCP tools. Model authentication is copied from your existing Hermes installation into an isolated `.hermes-shopping` profile. The scoped AgentPass credential is read from the ignored private setup file. If it is missing, run `npm run plugin:configure` first.

Inside Hermes, type:

```text
/browser connect
```

Hermes connects to its local debug browser, launching a visible Chrome window if needed. A newly launched browser uses `.hermes-shopping/chrome-debug`; it does not inherit the Codex browser login. Complete login, CAPTCHA, OTP or payment authentication directly in the browser when needed. Do not paste those secrets into Hermes. `/browser status` shows the connection.

If automatic connection reports that port 9222 is not responding, check which browser owns the listener before retrying. During this setup another Chrome process occupied IPv4 `127.0.0.1:9222`, while the dedicated Hermes Chrome listened on IPv6 `[::1]:9222`. Hermes's own readiness check succeeded for the latter. For that running instance, use:

```text
/browser connect http://[::1]:9222
```

This connects to the already running dedicated browser. Do not terminate unrelated Chrome processes or grant app-modification permissions to resolve this connection mismatch.

Paste this into Hermes for the existing walkthrough:

```text
Use AgentPass passport and purchase_history, then use your own browser tools
to continue my umbrella purchase at https://www.amazon.in/dp/B0H7SLQPYC.
I want one navy-blue FLYNGO umbrella, at most INR 800 including all fees.
Check my cart and orders first so you do not duplicate a purchase.
The existing request is amazon-umbrella-live-001, previously authorized for
INR 504. Verify its current authority; that old amount is not a current quote.
Ask me to sign in directly in your Chrome window if needed, then inspect
the actual final total and delivery date. Stop if the authorization is
expired or the purchase details differ; do not create a replacement silently.
Show me the AgentPass decision and stop before final payment or order submission.
Do not claim that authorization means I have paid.
```

Expected result: Hermes itself inspects Amazon, calls AgentPass, and prepares checkout when login and authorization permit. This is a real merchant walkthrough, not a simulated store. The currently bound payment reference cannot debit a bank account; this is not an autonomous-payment demo. No purchase occurs until the merchant's actual checkout/payment is completed.

If the old authorization expired, check that no order/payment occurred and release the unused reservation in the AgentPass dashboard. Then give Hermes a new request ID and have it obtain a fresh authorization for the observed exact item, URL and total. Never reuse an old ID with different purchase details.

After manually completing checkout, tell Hermes to inspect the actual merchant confirmation and record its real order reference with `report_order`. That record is client-reported, not independently verified settlement.

To stop: type `/exit` in Hermes and close the dedicated Chrome window. See [rollback instructions](ROLLBACK.md) before removing the profile.
