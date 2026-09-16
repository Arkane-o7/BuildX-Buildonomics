# Five-minute event showcase

Keep the public dashboard open in one window and the isolated Hermes session in another. Use owner access for the connected workspace; the public interactive demo creates a separate simulated workspace.

1. **Identity:** show Atlas's AgentPass ID, owner, funding reference and configured budget. Explain that this is an owner-issued identity, not verified KYC or a blockchain registry.
2. **Ask Hermes to buy:** check passport, list services, then request `research` using UPI and a stable request ID. Show the new activity, reserved budget and payer-confirmation status.
3. **Confirm checkout:** the human opens the returned link. In live mode they pay through Razorpay. In rehearsal choose “Simulate success” and explicitly say no money moved. After confirmation, Hermes queries status to retrieve the sample content and receipt.
4. **Prove the receipt:** open purchase details, verify its signature, and export its JSON. The receipt records the actual payment environment and provider reference when present.
5. **Show a refusal:** request the ₹1,500 report under the default ₹500 per-purchase cap. Then request the unapproved service. Both should be blocked before a provider order is made.
6. **Owner control:** revoke authority and ask Hermes to make another request. Show the denial. Restore authority when finished.
7. **Identity continuity:** rotate the funding reference and show the same AgentPass ID, budget and historical receipt. Explain that actual bank/card token rotation is future work.

The defensible claim: “We implemented owner-issued agent identity, spending policy, persistent audit, payer-mediated UPI/card integration and verifiable receipts.” Only claim a rail is verified live after an actual captured provider payment has been checked.

Do not claim arbitrary merchant acceptance, autonomous UPI PIN entry, bank/card issuing, production accounting, decentralized identity, live payments from a test receipt, or real payment-credential rotation.
