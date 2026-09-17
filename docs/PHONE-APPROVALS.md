# Phone approval setup

This feature sends an **AgentPass notification** linking to the owner's authenticated payment inbox. The owner reviews the merchant's request and opens their UPI app to authorize it. It is not a UPI Collect request, a bank-account connection, or an unattended debit.

## Android setup

1. Open https://agentpass-buildx.vercel.app/phone in Android Chrome.
2. Sign in to the same AgentPass workspace used by Hermes. Do not create a second account.
3. Tap **Enable phone notifications**, then allow the browser permission.
4. Tap **Send test alert**. Check the notification tray. “Accepted by the push service” is not proof that the phone displayed it.
5. Keep the inbox open if notifications are unavailable. It refreshes every five seconds.

The dashboard links to this page. You do not need to paste your UPI PIN or card details into AgentPass.

## Hermes setup

Restart with npm run hermes:shopping -- --cli to load the two new MCP tools, send_payment_to_phone and phone_payment_status. Inside Hermes, reconnect the current machine's visible browser with /browser connect http://[::1]:9222.

Suggested prompt:

> Check my existing order/payment state first. For the purchase I authorize, obtain a fresh merchant checkout total and valid AgentPass authorization. Read the merchant's exact UPI URI or PNG/JPEG QR image data URL from checkout. Use send_payment_to_phone with the intent ID and observed merchant source URL. Never invent a payee, amount, transaction reference or signed field. Tell me whether the push service accepted the alert or it is inbox-only. Wait for my response, then use phone_payment_status and inspect the merchant confirmation before recording an order.

The API checks the exact INR amount, merchant source host, transaction reference and current authority. It preserves the merchant URI verbatim, including signed fields. Off-domain gateways are currently rejected and need an explicit provider integration. A stale QR or expired authorization must not be reused.

On your phone, tap the notification, check the payee name, UPI ID and amount, then **Open UPI app to pay**. Select the appropriate app/account and authorize there. Return and tap **I approved payment in my UPI app**. That is an owner report only; Hermes must still inspect the merchant's actual outcome.

If Android or the payment app rejects the merchant URI, the original merchant checkout remains the fallback. Some merchant QR payloads may not work as external app links; test with the actual phone and provider. Do not rewrite signed fields or claim compatibility before that test.

## Payment state and retries

- Creating a phone request adds no second reservation.
- Repeating the identical request returns the same ID without another alert.
- The app rechecks authority when the owner opens the payment link.
- Requests expire at authorization expiry or five minutes, whichever comes first. The merchant QR may expire sooner.
- Opening the app or reporting approval never sets provider-verified payment.
- Requests cannot be opened again automatically. Check the app and merchant state before any further attempt.
- Declining does not cancel an external order or release allowance. Release unused reservations separately only after confirming no payment.

## Deployment

Run npm run phone:setup -- --publish to generate a VAPID pair privately and configure the linked Vercel production project. Existing keys are preserved. APP_URL must be the public HTTPS application origin. Redeploy afterward.

The service worker caches no authenticated pages or payment requests. Notifications contain generic text; details require owner sign-in. Push endpoints/keys and payment URIs are excluded from the general public account response and agent status response.

Automated tests cover isolation, amounts, signed-URI preservation, retry behavior, revocation, expiry and evidence states. Device notification delivery and the merchant-to-UPI-app handoff require an Android test. A build or unit test does not establish successful real payment.
