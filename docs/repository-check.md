# Repository and package check

Checked 16 September 2026 using GitHub API metadata, current README/license files and selected code. Stars are recorded as context, not a security score. Last push can include nonfunctional changes. None of these packages was installed or executed in this review.

| Repository | License observed | Archived | Last push (UTC) | Stars | Recommendation / caveat |
|---|---|---|---|---:|---|
| [AgentVeins/agentveins](https://github.com/AgentVeins/agentveins) | MIT | No | 2026-09-03 | 0 | Real policy/signing reference. Low public adoption evidence; no runtime audit performed. |
| [nirholas/x402-agent-wallet](https://github.com/nirholas/x402-agent-wallet) | Apache-2.0 | No | 2026-09-15 | 4 | Real policy wrapper. Inspected signing uses HMAC; paying wrapper has no reservation between check and external payment. See assessment. |
| [nirholas/onchain-agent-wallets](https://github.com/nirholas/onchain-agent-wallets) | NOASSERTION | No | 2026-09-15 | 5 | Current LICENSE says proprietary / all rights reserved. Do not classify the current tree as permissively reusable OSS. |
| [YouthAIAgent/agentwallet](https://github.com/YouthAIAgent/agentwallet) | MIT | Yes | 2026-08-17 | 4 | Archived. Useful feature reference; poor new-project foundation. |
| [VanarChain/xbpp-sdk](https://github.com/VanarChain/xbpp-sdk) | MIT | No | 2026-04-09 | 5 | Policy SDK exists. ALLOW/BLOCK/ESCALATE idea is established; chain independence not integration-tested. |
| [up2itnow0822/agent-wallet-sdk](https://github.com/up2itnow0822/agent-wallet-sdk) | MIT | No | 2026-09-16 | 11 | Current README explicitly lacks Solidity sources and an official deployment manifest. Do not assume turnkey on-chain wallet enforcement. |
| [up2itnow0822/agentpay-wallet-starter](https://github.com/up2itnow0822/agentpay-wallet-starter) | MIT | No | 2026-09-13 | 0 | Starter exists; demo behavior is not proof of production settlement or available smart-contract deployments. |
| [wgopar/a2a-x402-agent-template](https://github.com/wgopar/a2a-x402-agent-template) | MIT | No | 2026-04-22 | 2 | Useful demo merchant. Inspected payment module accepts payment for priced routes; buyer authorization still needs implementation. |
| [fzn0x/8004sdk](https://github.com/fzn0x/8004sdk) | MIT | No | 2026-02-26 | 1 | Small identity wrapper; verify ABI compatibility before selecting. Direct viem calls are sufficient for the proposed scope. |
| [tetratorus/erc-8004-js](https://github.com/tetratorus/erc-8004-js) | Not detected | No | 2026-01-07 | 6 | No root license file in the inspected tree and no detected GitHub license. Do not repeat the unqualified MIT claim without checking package-specific terms. |
| [open-mid/8004-facilitator](https://github.com/open-mid/8004-facilitator) | MIT | No | 2026-02-22 | 14 | Facilitator/identity reference. Its payment verification does not establish an organization-authority verifier. |
| [google-agentic-commerce/AP2](https://github.com/google-agentic-commerce/AP2) | Apache-2.0 | No | 2026-06-17 | 3180 | Official protocol models and samples. Reference first; integration and conformance are separate work. |
| [google-agentic-commerce/a2a-x402](https://github.com/google-agentic-commerce/a2a-x402) | Apache-2.0 | No | 2026-08-04 | 560 | Official extension exists. Add only if the demo actually needs agent-to-agent task messaging. |
| [x402-foundation/x402](https://github.com/x402-foundation/x402) | Apache-2.0 | No | 2026-09-16 | 6616 | Preferred payment dependency. Pin matching packages and validate wallet/token/facilitator compatibility. |
| [coinbase/agentkit](https://github.com/coinbase/agentkit) | Apache-2.0 in LICENSE.md | No | 2026-09-03 | 1312 | Wallet/framework toolkit. LICENSE.md states Apache-2.0 despite GitHub NOASSERTION. Optional; direct CDP SDK can be smaller. |
| [zpaynow/ZeroPay](https://github.com/zpaynow/ZeroPay) | GPL-3.0 | No | 2026-05-12 | 3 | GPL-3.0, not an assumed MIT component. Self-hosted facilitator adds unnecessary initial scope. |
| [up2itnow0822/ap2-payment-handler](https://github.com/up2itnow0822/ap2-payment-handler) | MIT | No | 2026-08-31 | 0 | Repository exists. Autonomous mandate/settlement correctness and deployed availability not verified. |
| [valdo99/clawpayer](https://github.com/valdo99/clawpayer) | MIT | No | 2026-02-19 | 0 | Card-vault reference; outside the proposed x402 MVP. |
| [tokamak-network/Tokagentos-monorepo](https://github.com/tokamak-network/Tokagentos-monorepo) | MIT | No | 2026-08-24 | 2 | Large framework fork; avoid importing framework complexity for one purchasing tool. |
| [Trustdev-eth/x402-erc8004-agent](https://github.com/Trustdev-eth/x402-erc8004-agent) | NOASSERTION | No | 2026-02-25 | 13 | README claims MIT but fetched LICENSE is an informal sentence. Licensing is not a verified standard MIT grant. |
| [Sperax/erc8004-agents](https://github.com/Sperax/erc8004-agents) | NOASSERTION | No | 2026-07-06 | 7 | Fetched LICENSE contains only an attribution heading; README license claims do not establish standard Apache terms. |

**Other named components**

| Component | Evidence checked | Decision |
|---|---|---|
| [@agntos/agentwallet](https://www.npmjs.com/package/@agntos/agentwallet) | Registry reports v1.2.0 / MIT and points to [0xArtex/agentwallet-aos](https://github.com/0xArtex/agentwallet-aos); source tree contains Solidity. | Candidate for a later on-chain-enforcement evaluation; exact session-key/x402 behavior and deployability not verified. |
| [@t402/agent-policy](https://www.npmjs.com/package/@t402/agent-policy) | Registry reports v1.0.0-beta.1 / MIT, with source at [t402-io/t402](https://github.com/t402-io/t402/tree/main/typescript/packages/advanced/agent-policy). | Beta policy component; evaluate durable reservation semantics before depending on it. |
| [pyagentgate](https://pypi.org/project/pyagentgate/) | PyPI v0.1.0, links [Peterc3-dev/agentgate](https://github.com/Peterc3-dev/agentgate); metadata license field is empty. | Exists; not selected for the TypeScript project. Full license and behavior not verified. |
| [ap2-x402-bridge](https://pypi.org/project/ap2-x402-bridge/) | PyPI v0.1.0 / Apache-2.0, links [source](https://github.com/c6zks4gssn-droid/ap2-x402-bridge). | Existence confirmed. “Only bridge” and protocol conformance are unverified maintainer claims. |
| [tryx402](https://github.com/crypto-yannso/tryx402) | README describes provider-independent governance, receipts, retries and budget controls; says MIT. | Strong overlap reference. No execution or verification of its exactly-once-style marketing promises. |
| [Fystack policy engine](https://github.com/fystack/programmable-policy-engine) | Public project listed as MIT; [maintainer announcement](https://fystack.io/blog/fystacks-policy-engine-static-permissions-meet-programmable-controls-2) confirms the core engine was open-sourced. | Core engine exists. Do not infer the full custody platform is an unrestricted, fully open deployment. |
| [Open Wallet Standard](https://openwallet.sh/) | [MoonPay announcement](https://www.moonpay.com/newsroom/open-wallet-standard) confirms March 23 release, MIT and more than 15 contributing organizations. | Wallet interoperability reference and possible future adapter. Operational compatibility not tested. |
| [ERC-8004 contracts](https://github.com/erc-8004/erc-8004-contracts) | Maintainer deployment list includes Base and Base Sepolia identity/reputation. | Consume deployed interfaces; do not start by forking the registry. Full contract set was not license-audited. |

**Direct source evidence for the most consequential corrections**

- [Solana wallet LICENSE](https://github.com/nirholas/onchain-agent-wallets/blob/main/LICENSE): current proprietary terms contradict the suggested “likely MIT.”
- [Smart-wallet SDK current README](https://github.com/up2itnow0822/agent-wallet-sdk/blob/main/README.md): contract/deployment boundaries are explicit.
- [AgentKit LICENSE.md](https://github.com/coinbase/agentkit/blob/main/LICENSE.md): resolve misleading API metadata by reading the file.
- [x402-agent-wallet HMAC implementation](https://github.com/nirholas/x402-agent-wallet/blob/main/src/sign.ts) and [paying wrapper](https://github.com/nirholas/x402-agent-wallet/blob/main/src/wrap.ts): source-backed distinction between authenticated local verdicts, publicly verifiable receipts and durable budgets.
- [wgopar payment module](https://github.com/wgopar/a2a-x402-agent-template/blob/main/src/payments/x402.ts): merchant/resource-server middleware.

A public source repository, a README claim, a package version and a demonstrated production service are four different levels of evidence. This check should narrow a dependency shortlist; it does not certify any project.
