import { randomUUID } from "node:crypto";
import { z } from "zod";
import { checkOrigin, digest } from "@/lib/auth";
import { AppError, loginAllowed } from "@/lib/store";
import { createAccount, accountByEmail, readAccount, updateAccount } from "@/lib/platform-store";
import { authorizeIntent, bindWallet, checkPassword, controlEvent, createManagedAgent, currentAuthority, customerCookie, hashPassword, listAvatars, principal, publicAccount, reportOrder, scopedAgent, signedRecord, tokenFor } from "@/lib/platform";
import { receiptPublicKey, verifyReceipt } from "@/lib/receipts";
import type { OwnerAccount } from "@/lib/platform-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const json = (value: unknown, status = 200, headers = {}) => Response.json(value, { status, headers: { "Cache-Control": "no-store", ...headers } });
async function body(req: Request) {
  const text = await req.text();
  if (text.length > 16000) throw new AppError(413, "Request too large.");
  try { return JSON.parse(text); } catch { throw new AppError(400, "Invalid JSON."); }
}
const domain = z.string().trim().toLowerCase().regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/);
async function handler(req: Request): Promise<Response> {
  try {
    if (process.env.EVENT_DISABLED === "true") throw new AppError(503, "AgentPass is offline.");
    const route = new URL(req.url).pathname.replace(/^\/api\/platform\//, "");
    const post = req.method === "POST";
    if (post && !req.headers.has("authorization")) checkOrigin(req);
    if (post && ["signup", "login"].includes(route)) {
      const input = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(12).max(200), name: z.string().trim().min(1).max(80).optional() }).strict().parse(await body(req));
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
      if (!await loginAllowed(digest("customer-login:" + ip))) throw new AppError(429, "Too many attempts. Try again in 15 minutes.");
      let account: OwnerAccount;
      if (route === "signup") {
        if (!input.name) throw new AppError(400, "Your name is required.");
        receiptPublicKey();
        account = { id: randomUUID(), name: input.name, email: input.email, createdAt: new Date().toISOString(), subscription: { plan: "event_trial", status: "trial", billingConnected: false }, agents: [], wallets: [], intents: [], events: [] };
        controlEvent(account, "account", "Account created. Event trial active; no subscription charge has been made.");
        await createAccount(account, await hashPassword(input.password));
      } else {
        const record = await accountByEmail(input.email);
        const fallback = "0".repeat(32) + ":" + "0".repeat(128);
        const matches = await checkPassword(input.password, record?.passwordHash || fallback);
        if (!record || !matches) throw new AppError(401, "Email or password is incorrect.");
        account = record.state;
      }
      return json({ account: publicAccount(account) }, 200, { "Set-Cookie": customerCookie(account.id) });
    }
    if (post && route === "logout") return json({ ok: true }, 200, { "Set-Cookie": "ap_customer=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
    if (post && route === "verify") {
      const input = z.object({ payload: z.record(z.unknown()), signature: z.string().max(1000) }).strict().parse(await body(req));
      if (!verifyReceipt(input.payload, input.signature, receiptPublicKey()) || !z.string().uuid().safeParse(input.payload.accountId).success)
        return json({ authentic: false, authorized: false, paymentExecuted: false });
      return json(currentAuthority(await readAccount(input.payload.accountId as string), input));
    }
    if (req.method === "GET" && route === "public-key") return json({ publicKey: receiptPublicKey(), algorithm: "Ed25519" });
    if (req.method === "GET" && route === "avatars") return json({ avatars: await listAvatars() });
    const agentRoutes = ["passport", "authorize", "intents", "report"];
    const auth = await principal(req, !agentRoutes.includes(route));
    if (req.method === "GET" && route === "account") return json({ account: publicAccount(await readAccount(auth.accountId)) });
    if (post && route === "agents") {
      const avatars = await listAvatars();
      const input = z.object({ name: z.string().trim().min(1).max(60), runtime: z.string().trim().min(1).max(60), avatar: z.string().refine(v => avatars.includes(v), "Choose a valid sprite.") }).strict().parse(await body(req));
      return json(await updateAccount(auth.accountId, a => createManagedAgent(a, input.name, input.runtime, input.avatar)));
    }
    if (post && /^agents\/[^/]+\/(policy|binding|revoke|resume|token)$/.test(route)) {
      const [, id, action] = route.split("/");
      const raw = await body(req);
      const policy = action === "policy" ? z.object({ budget: z.number().int().min(100).max(10000000), perPurchase: z.number().int().min(100).max(10000000), allowedMerchants: z.array(domain).min(1).max(30) }).strict().parse(raw) : null;
      const binding = action === "binding" ? z.object({ walletId: z.string().uuid() }).strict().parse(raw) : null;
      return json(await updateAccount(auth.accountId, a => {
        const agent = scopedAgent(a, auth, id);
        if (policy) {
          if (policy.budget < agent.spent + agent.reserved || policy.perPurchase > policy.budget) throw new AppError(409, "Budget must cover recorded spending and reservations; per-purchase limit cannot exceed it.");
          Object.assign(agent, policy);
          agent.policyVersion++;
          controlEvent(a, "policy", `${agent.name}'s policy updated. Existing authorizations must be rechecked.`, id);
        } else if (binding) bindWallet(a, agent, binding.walletId);
        else if (action === "token") {
          const token = tokenFor(a.id, agent.id);
          agent.tokenHash = digest(token);
          controlEvent(a, "credential", `${agent.name}'s plugin credential rotated. Previous credential is invalid.`, id);
          return { token };
        } else {
          agent.status = action === "revoke" ? "revoked" : "active";
          agent.policyVersion++;
          controlEvent(a, action, `${agent.name}'s new spending authority ${agent.status === "active" ? "restored" : "revoked"}. This does not cancel external orders.`, id);
        }
        return { ok: true };
      }));
    }
    if (post && route === "wallets") {
      const input = z.object({ label: z.string().trim().min(1).max(60), kind: z.enum(["upi", "card"]), reference: z.string().trim().min(1).max(100) }).strict().parse(await body(req));
      if (input.kind === "card" && !/^\d{4}$/.test(input.reference)) throw new AppError(400, "Enter only the last four card digits. Never enter the card number or CVV.");
      if (input.kind === "upi" && !/^[a-zA-Z0-9._-]{2,80}@[a-zA-Z0-9.-]{2,30}$/.test(input.reference)) throw new AppError(400, "Enter a UPI ID such as name@bank. Never enter a UPI PIN.");
      return json(await updateAccount(auth.accountId, a => {
        if (a.wallets.length >= 20) throw new AppError(429, "Event trial payment-account limit reached.");
        const maskedReference = input.kind === "card" ? "•••• " + input.reference : input.reference.slice(0, 2) + "•••@" + input.reference.split("@")[1];
        const wallet = { id: randomUUID(), label: input.label, kind: input.kind, maskedReference, connection: "reference_only" as const, createdAt: new Date().toISOString() };
        a.wallets.push(wallet);
        controlEvent(a, "wallet", `${input.label} added as a masked ${input.kind.toUpperCase()} reference. Bank ownership and payment execution are not verified.`);
        return { wallet };
      }));
    }
    if (req.method === "GET" && route === "passport") {
      const id = auth.agentId || new URL(req.url).searchParams.get("agentId") || "";
      return json(await updateAccount(auth.accountId, a => {
        const agent = scopedAgent(a, auth, id);
        agent.lastSeen = new Date().toISOString();
        const { tokenHash, ...safe } = agent; void tokenHash;
        return { agent: safe, owner: { id: a.id, name: a.name, attestation: "owner_attested" }, wallet: a.wallets.find(w => w.id === agent.walletId) || null, remainingPaise: agent.budget - agent.spent - agent.reserved, currency: "INR", paymentExecution: { available: false, reason: "Payment accounts are references only. Use the user's merchant checkout; payer confirmation is required. AgentPass does not execute UPI/card debits." }, passport: signedRecord({ type: "agent_identity", accountId: a.id, agentId: agent.id, owner: a.name, walletId: agent.walletId, bindingVersion: agent.bindingVersion, status: agent.status, issuedAt: new Date().toISOString(), identityVerification: "owner_attested" }) };
      }));
    }
    if (post && route === "authorize") {
      const input = z.object({ agentId: z.string().uuid().optional(), requestId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), item: z.string().trim().min(1).max(200), url: z.string().url().max(2000), amount: z.number().int().min(1).max(10000000) }).strict().parse(await body(req));
      const agentId = auth.agentId || input.agentId;
      if (!agentId || (auth.agentId && input.agentId && auth.agentId !== input.agentId)) throw new AppError(403, "Select an agent belonging to this credential.");
      return json({ intent: await updateAccount(auth.accountId, a => authorizeIntent(a, auth, { ...input, agentId })), paymentExecuted: false });
    }
    if (req.method === "GET" && route === "intents") {
      const a = await readAccount(auth.accountId);
      if (auth.agentId) scopedAgent(a, auth, auth.agentId);
      return json({ intents: a.intents.filter(i => !auth.agentId || i.agentId === auth.agentId) });
    }
    if (post && route === "report") {
      const input = z.object({ intentId: z.string().uuid(), orderReference: z.string().trim().min(1).max(100) }).strict().parse(await body(req));
      return json({ intent: await updateAccount(auth.accountId, a => reportOrder(a, auth, input.intentId, input.orderReference)), providerVerified: false });
    }
    if (post && route === "cancel") {
      const input = z.object({ intentId: z.string().uuid(), confirmNoPayment: z.literal(true) }).strict().parse(await body(req));
      return json(await updateAccount(auth.accountId, a => {
        const intent = a.intents.find(i => i.id === input.intentId);
        if (!intent) throw new AppError(404, "Intent not found.");
        if (intent.status === "cancelled") return { ok: true };
        if (intent.status !== "authorized") throw new AppError(409, "Only pending authorizations can be cancelled.");
        const agent = scopedAgent(a, auth, intent.agentId);
        agent.reserved -= intent.amount;
        if (agent.reserved < 0) throw new AppError(500, "Reservation invariant failed.");
        intent.status = "cancelled";
        intent.reason = "Owner confirmed no payment occurred and released the reservation. This does not cancel an external merchant order.";
        controlEvent(a, "cancelled", intent.reason, agent.id);
        return { ok: true };
      }));
    }
    throw new AppError(404, "Endpoint not found.");
  } catch (e) {
    if (e instanceof AppError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError) return json({ error: "Check the required fields and amount limits.", fields: e.issues.map(i => i.path.join(".")) }, 400);
    console.error("AgentPass control plane request failed", e instanceof Error ? e.name : "unknown");
    return json({ error: "Unable to complete the request. Please retry." }, 500);
  }
}
export { handler as GET, handler as POST };
