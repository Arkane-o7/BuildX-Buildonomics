# What AgentPass builds and reuses

AgentPass is the owner-facing identity and spending-authority product. It does not need a new general-purpose agent, browser engine, payment network or wallet custody system.

| Part | Current choice | AgentPass-specific work |
|---|---|---|
| Agent runtime | Existing Hermes installation | MCP tool adapter and removable profile |
| Tool protocol | Official MCP TypeScript SDK | Five scoped identity/authorization tools |
| Web app | Existing Next.js/React app | Customer workspace and management interface |
| Storage | Existing Neon/Postgres | Customer isolation and atomic policy reservations |
| Signing | Node Ed25519 and existing signing code | Exact purchase authorization, current-authority verification |
| Money movement | Not connected | Integrate a supported delegated payment service, verify settlement |
| SaaS billing | Free trial only | Integrate subscription checkout and billing entitlements |

## Payment implementation candidate checked on 2026-09-17

[Crossmint agent-checkout-quickstart](https://github.com/Crossmint/agent-checkout-quickstart/blob/main/README.md) is a public implementation for product-URL checkout, buyer/browser profiles, asynchronous checkout state and receipts. It requires production Crossmint and live Stytch credentials and may request human shipping/payment input. Its demo uses an intentionally very high spending cap, which must not be copied into AgentPass. Its source code does not replace access to the hosted service; review the repository license before copying code.

[Crossmint's agent payment documentation](https://docs.crossmint.com/agents/how-agents-pay) describes card vaulting and scoped allowances using supported network rails, with explicit user verification. Its encrypted-card fallback has a different security boundary from network-enforced delegation and must not be treated as equivalent. The documentation does not establish automatic payment from this user's Indian UPI account.

No Crossmint code or service has been integrated into this build. No substitute provider account has been created. Confirm India, merchant, card/UPI, delegation, settlement and sandbox availability before choosing an execution dependency.

## Effort assessment

The control-plane prototype is a small application/integration task, implemented and testable in this repository. Payment execution is the gating integration: implementation time cannot be estimated honestly until a supported provider and account access are confirmed. A reliable public SaaS additionally needs billing, verified account recovery, session management, abuse controls and production payment operations; it is not a three-hour completion claim.
