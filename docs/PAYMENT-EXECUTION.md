# Completing merchant payments

The shopping profile no longer has an unconditional instruction to stop before every payment button. It can continue an explicitly authorized merchant checkout, pause at required bank authentication, then inspect the outcome. This changes the Hermes workflow, not the payment provider capability. AgentPass still has no bank-debit endpoint, card vault, provider token, or delegated-UPI connection.

## UPI with the current build

1. Restart the shopping profile to load the updated instructions: `npm run hermes:shopping -- --cli`.
2. Connect the visible browser inside Hermes with `/browser connect http://[::1]:9222` for the dedicated browser currently running on this machine. Do not open that connection address as a website.
3. Ask Hermes to inspect the existing cart and orders, verify the exact item and current final total, and check current AgentPass authority. Expired or changed authorizations must not be reused.
4. Explicitly authorize the intended purchase and select UPI. Hermes can advance the merchant UI to its real payment request or QR. It must verify the merchant and amount, never fabricate a payee, and never ask for the UPI PIN.
5. Approve in your own UPI app. Then tell Hermes to inspect the merchant result. It must not retry a potentially successful payment just because confirmation is slow.
6. Hermes can record the real order reference with `report_order` after seeing confirmation. This remains client-reported evidence. An order ID or a policy authorization alone does not establish payment settlement.

Do not call this unattended UPI payment. The account label in AgentPass is a masked reference; browser payment-source matching is observational, not bank-enforced. If a different source is selected, update the binding and obtain fresh authority rather than silently using an unrelated card or balance.

## Cards

Use a card already securely stored by the merchant, or a payment-provider vault after a real integration exists. Do not save full card numbers, CVV, OTP, or bank credentials in Hermes or AgentPass configuration. A saved card does not guarantee a challenge-free charge. Hermes should continue the authorized checkout and pause only when authentication or an unresolved user decision is required.

## What unattended execution still needs

A provider connection must supply a supported payment credential/delegation, not just a display label. The server must bind execution to the authorized merchant, amount and current wallet version; prevent duplicate execution; reconcile pending outcomes; and verify provider evidence before marking settlement. Provider onboarding and supported India/merchant coverage are prerequisites to completing that adapter.

NPCI has published an extension of UPI Circle to devices and software profiles, including AI profiles initially in a closed user group. The circular also requires explicit user initiation for IoT debits. This establishes a relevant integration direction, not public API access for this prototype. See the [NPCI circular dated 8 October 2025](https://www.npci.org.in/uploads/UPI_OC_No_201_B_FY_2025_26_Addendum_to_NPCI_UPI_2024_25_OC_201_Introduction_of_Io_T_devices_software_on_UPI_Circle_09ec83c893.pdf).

[Razorpay UPI AutoPay](https://razorpay.com/docs/payments/payment-gateway/s2s-integration/recurring-payments/upi/) uses a customer-approved recurring mandate and provider tokens. It is not a general permission for AgentPass to spend at arbitrary external merchants such as Amazon. Do not recreate the earlier merchant-onboarding detour.

The previously documented stop-before-payment walkthroughs remain useful rehearsal prompts. They intentionally request a stop. For a real purchase, the user must instead request completion with the chosen method and agreed item/total. Material substitutions need agreement before ordering.
