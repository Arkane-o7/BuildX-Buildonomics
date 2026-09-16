# AgentPass setup

Public showcase: **https://agentpass-buildx.vercel.app**

## 1. Run locally

```sh
npm ci
npm run setup
npm run dev
```

The setup generates event-only secrets in `.env.local` (ignored by Git), plus `.agentpass-private/OWNER-ACCESS.txt`. Open the dashboard at `http://localhost:3000`. Choose **Owner access** and use that code, or **Try interactive demo** for a separate rehearsal session.

Do not copy owner, database, signing or Razorpay secrets into Hermes. Only the scoped `AGENTPASS_AGENT_TOKEN` belongs in the agent integration.

## 2. Connect Neon to Vercel

The event project is `agentpass-buildx`, in the `arks-projects-6ef60be5` Vercel team.

1. Open the Vercel project → **Storage** → **Create Database**.
2. Choose **Neon / Serverless Postgres**, the free plan, and a region near your Vercel functions.
3. Create an event-only database named `agentpass-event` and connect it to `agentpass-buildx`.
4. Select Production, Preview and Development. Keep the default environment variable names. The app accepts `DATABASE_URL` or `POSTGRES_URL`.
5. Pull Development credentials into a separate ignored file, then merge only the database connection into `.env.local`. Do not overwrite the already-generated signing key or agent token.

```sh
vercel env pull .env.vercel --environment=development
npm run db:import
npm run db:setup
```

The last command creates only `agentpass_workspaces` and `agentpass_login_attempts`. No existing schema is dropped. `db:import` merges only the database URL and preserves the other generated secrets.

## 3. Deploy the public URL

Add the values from `.env.local` to the Vercel project's **Production** environment variables:

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | Neon connection, normally populated by integration |
| `APP_URL` | Stable public production URL, not a preview alias |
| `SESSION_SECRET` | Random session signing secret, at least 32 characters |
| `OWNER_ACCESS_CODE` | Private owner login code |
| `AGENTPASS_AGENT_TOKEN` | Scoped credential that lets Hermes request purchases |
| `RECEIPT_PRIVATE_KEY` | Ed25519 PEM with literal `\n` escapes supported |
| `PAYMENT_MODE` | Start with `rehearsal`; use matching test/live mode only when ready |
| `EVENT_DISABLED` | `false` while event is running |

```sh
vercel --prod --yes
```

After the first deploy, set `APP_URL` to the stable production alias and redeploy. Set the same URL in local `.env.local`; rerun `npm run hermes:prepare`. Never upload `.env.local`, `.hermes-event`, or `.agentpass-private` to GitHub or Vercel as source files.

## 4. Razorpay account and real UPI

Create an account at https://dashboard.razorpay.com/signup. Choose **Payment Gateway / Accept payments** if prompted. Provide your actual business type, business description, identity documents and settlement bank information directly to Razorpay. Do not invent company details or select a registered entity you do not have.

Live acceptance depends on account activation/KYC and the provider's review. A new account may not become live during the event. AgentPass cannot bypass activation, and changing an environment variable cannot make test payments real.

If Razorpay asks for a website, use your stable public URL. Any business, contact, fulfilment, privacy, terms or refund information must accurately describe the actual merchant and service; do not publish invented legal/contact details to satisfy onboarding.

After activation:

1. Switch Razorpay Dashboard to **Live mode**.
2. Open **Account & Settings → API Keys**, generate the live key pair, and store the Key ID and Key Secret in `.env.local` or Vercel. Never paste secrets into chat, frontend code or GitHub.
3. Set `RAZORPAY_KEY_ID` (`rzp_live_…`), `RAZORPAY_KEY_SECRET` and `PAYMENT_MODE=razorpay_live` in Vercel Production.
4. Configure payment capture in your Razorpay account. The app fulfils only **captured** payments; an `authorized` status alone is not success.
5. Add an event-specific webhook pointing to `https://YOUR-PUBLIC-URL/api/webhooks/razorpay`, select `payment.captured`, and use a fresh secret for `RAZORPAY_WEBHOOK_SECRET` in Vercel. This recovers outcomes when the payer closes the browser before callback verification finishes.
6. Redeploy. In the owner dashboard, confirm it says **Live payments**. Choose a low-cost sample service and UPI, then open checkout. The human payer completes the real payment in their UPI app or through Razorpay's QR flow.
7. Confirm the captured payment in Razorpay and the matching provider payment ID in AgentPass's exported receipt. That is the point at which real UPI is verified end to end.

For cards, choose **Card** before requesting. Card entry and any issuer authentication remain in Razorpay checkout. Card availability depends on the account's enabled payment methods; this code does not guarantee a particular card issuer's acceptance.

For provider test mode, use separate `rzp_test_…` keys and `PAYMENT_MODE=razorpay_test`. Test UPI is not a real bank transfer. Never mix test/live credentials. Complete or reconcile outstanding orders before switching environments; keep historical keys securely available if old orders still need reconciliation.

**If activation is pending:** use Razorpay Test Mode to exercise the provider integration without completing live KYC. Set the test key pair and `PAYMENT_MODE=razorpay_test` in `.env.local`, run `npm run env:publish`, and redeploy with `vercel --prod --yes`. Use owner access or Hermes for the provider checkout; **Try interactive demo** intentionally remains a separate rehearsal workspace.

In Razorpay **Test Mode**, open **Account & Settings → Webhooks → Add New Webhook**. Set the URL to `https://agentpass-buildx.vercel.app/api/webhooks/razorpay`, select `payment.captured`, and use the same `RAZORPAY_WEBHOOK_SECRET` as the deployed server. If the local private file `.agentpass-private/RAZORPAY-WEBHOOK.txt` exists, it contains the event's webhook settings. Keep its secret private. Configure automatic capture: the app only completes orders after Razorpay reports `captured`.

For the supported UPI-ID test flow, Razorpay documents `success@razorpay` and `failure@razorpay`. Availability depends on the checkout surface; these are simulator inputs, not bank accounts to pay from a real UPI app. Razorpay warns that test UPI cancellation can report success, so use the explicit failure ID for a failure demonstration. See [test UPI details](https://razorpay.com/docs/payments/payments/test-upi-details/) and [test-mode eligibility](https://razorpay.com/docs/payments/quickstart/).

**Verified event sandbox flow (16 September 2026):** select **Card**, request the research brief, and open test checkout. The official test credit card `5555 5100 0008 1006`, expiry `12/29`, CVV `123`, and dummy OTP `123456` completed a ₹20 test payment. Decline saving the card if prompted. Enter the dummy OTP directly; no real bank account or SMS is needed. Razorpay reported `captured` and AgentPass delivered the brief with a signed receipt. See [current test card details](https://razorpay.com/docs/payments/payments/test-card-details/).

UPI-only checkout currently reports **No appropriate payment method found** for this merchant in desktop and emulated mobile-web testing. UPI provider completion is therefore **not yet verified**. Razorpay documents its [Payment Methods settings](https://razorpay.com/docs/payments/dashboard/account-settings/payment-methods/) as Live Mode only; there is no corresponding Test Mode switch to look for. Ask provider support about sandbox UPI availability; do not present the rehearsal UPI flow as a captured provider payment. The webhook was saved by the owner; confirm `payment.captured` delivery HTTP 200 separately in the provider dashboard.

If provider test checkout is unavailable, the explicitly labeled rehearsal still demonstrates policy, persistence, Hermes tools and signed receipts. Neither rehearsal nor provider test mode proves real money movement. A personal UPI QR is not a substitute for provider-verified settlement.

Official references: [Create an account](https://razorpay.com/docs/payments/create-account/), [API keys](https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/), [UPI methods](https://razorpay.com/docs/payments/payment-methods/upi/), [Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/).

## 5. Connect your existing Hermes

Keep Hermes installed normally and put the public `APP_URL` plus the scoped token in local `.env.local`. Then:

```sh
npm run hermes:prepare
npm run hermes:event
```

The launcher creates `.hermes-event` in this repository, copies the existing Hermes configuration and model authentication into it, replaces MCP settings only in that copy, and starts Hermes with a process-local `HERMES_HOME`. Only the `agentpass` toolset is enabled. No shell profile, normal Hermes config, installed Hermes source or normal MCP server is edited.

The four tools are `passport`, `services`, `purchase` and `payment_status`. Numeric backend amounts are paise: **100 paise = ₹1**. The passport also returns a formatted remaining budget.

Try:

> Check my AgentPass identity and budget. Request a research brief using UPI with request ID event-research-001, and give me the checkout link. Do not claim it is paid until you check the payment status.

After confirming payment:

> Check event-research-001 and show the delivered result and signed receipt.

A transport-only check is available as `npx tsx scripts/mcp-smoke.ts`. This proves MCP connectivity and authentication; it does not prove that a model chose the tools correctly. The dashboard's last-seen time updates when a real authenticated agent request arrives.

## 6. Operate and troubleshoot

- **Connect a Postgres database:** hosting has no connection variable. Connect Neon and redeploy.
- **Owner access incorrect:** use the code deployed to Production, not an old local code.
- **Payment setup incomplete:** check the environment and key prefix; test/live keys are not interchangeable.
- **Awaiting checkout:** an order is authorized by AgentPass, not paid. Open its checkout and confirm.
- **Needs reconciliation / authorized at provider:** use **Check provider status** in purchase details. Never create another order merely because a response was lost.
- **Unknown order absent from reconciliation:** the automatic search is bounded to 100 orders in its time window. Inspect Razorpay before any replacement; no reservation is automatically released.
- **Revoked:** new purchases are denied. Existing Razorpay orders may still complete; revocation is not a bank chargeback/cancellation.
- **Agent reports paise as rupees:** ask it to use the formatted `remaining` value; the backend budget is authoritative.
- **Original Hermes hashes differ:** normal Hermes login/token refresh may have changed them independently. Inspect rather than automatically overwriting.

After the event, follow [ROLLBACK.md](docs/ROLLBACK.md).
