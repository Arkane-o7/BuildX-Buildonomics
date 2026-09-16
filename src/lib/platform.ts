import { randomBytes, randomUUID, scrypt, sign } from "node:crypto";
import { promisify } from "node:util";
import { digest, same, signToken } from "./auth";
import { AppError } from "./store";
import { readAccount } from "./platform-store";
import { canonical, receiptPublicKey, verifyReceipt } from "./receipts";
import type { OwnerAccount, ManagedAgent, PublicAccount, PurchaseIntent, SignedRecord } from "./platform-types";

const derive = promisify(scrypt);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await derive(password, salt, 64) as Buffer).toString("hex")}`;
}
export async function checkPassword(password: string, encoded: string) {
  const [salt, hash] = encoded.split(":");
  return same((await derive(password, salt, 64) as Buffer).toString("hex"), hash);
}
export function customerCookie(id: string) {
  const data = Buffer.from(JSON.stringify({ id, exp: Date.now() + 7 * 86400000 })).toString("base64url");
  return `ap_customer=${data}.${signToken("customer:" + data)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.VERCEL ? "; Secure" : ""}`;
}
export interface Principal { accountId: string; agentId: string | null; tokenHash?: string }
export async function principal(req: Request, ownerOnly = false): Promise<Principal> {
  const bearer = req.headers.get("authorization");
  if (bearer) {
    if (ownerOnly) throw new AppError(403, "This action requires the account owner.");
    const token = bearer.replace(/^Bearer /, "");
    const parts = token.split(".");
    if (parts.length !== 4 || parts[0] !== "ap1" || !/^[a-f0-9-]{36}$/.test(parts[1]) || !/^[a-f0-9-]{36}$/.test(parts[2]))
      throw new AppError(401, "Invalid agent credential.");
    const account = await readAccount(parts[1]);
    const agent = account.agents.find(a => a.id === parts[2]);
    const tokenHash = digest(token);
    if (!agent || !same(agent.tokenHash, tokenHash)) throw new AppError(401, "Agent credential expired or was rotated.");
    return { accountId: account.id, agentId: agent.id, tokenHash };
  }
  const cookie = req.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith("ap_customer="))?.slice(12);
  try {
    const [data, signature] = cookie?.split(".") || [];
    if (data && signature && same(signature, signToken("customer:" + data))) {
      const decoded = JSON.parse(Buffer.from(data, "base64url").toString());
      if (decoded.exp > Date.now() && /^[a-f0-9-]{36}$/.test(decoded.id)) return { accountId: decoded.id, agentId: null };
    }
  } catch { /* Invalid sessions require sign-in. */ }
  throw new AppError(401, "Sign in to your AgentPass account.");
}
export function publicAccount(account: OwnerAccount): PublicAccount {
  return { ...account, agents: account.agents.map(({ tokenHash, ...agent }) => { void tokenHash; return agent; }) };
}
export function controlEvent(account: OwnerAccount, type: string, detail: string, agentId?: string) {
  account.events.unshift({ id: randomUUID(), time: new Date().toISOString(), type, detail, ...(agentId ? { agentId } : {}) });
  account.events = account.events.slice(0, 300);
}
export function tokenFor(accountId: string, agentId: string) {
  return `ap1.${accountId}.${agentId}.${randomBytes(32).toString("base64url")}`;
}
export function createManagedAgent(account: OwnerAccount, name: string, runtime: string) {
  if (account.agents.length >= 10) throw new AppError(429, "The event trial supports up to ten agents.");
  const id = randomUUID(), token = tokenFor(account.id, id);
  const agent: ManagedAgent = { id, name, runtime, status: "active", walletId: null, bindingVersion: 1, policyVersion: 1, budget: 200000, perPurchase: 80000, allowedMerchants: ["amazon.in"], spent: 0, reserved: 0, tokenHash: digest(token), createdAt: new Date().toISOString(), lastSeen: null };
  account.agents.push(agent);
  controlEvent(account, "identity", `${name} registered with an owner-attested identity.`, id);
  return { agent: publicAccount({ ...account, agents: [agent] }).agents[0], token };
}
export function scopedAgent(account: OwnerAccount, auth: Principal, id: string) {
  if (auth.accountId !== account.id || (auth.agentId && auth.agentId !== id)) throw new AppError(403, "This credential cannot access that agent.");
  const agent = account.agents.find(a => a.id === id);
  if (!agent) throw new AppError(404, "Agent not found.");
  if (auth.agentId && (!auth.tokenHash || !same(agent.tokenHash, auth.tokenHash))) throw new AppError(401, "Agent credential was rotated.");
  return agent;
}
export function signedRecord(payload: Record<string, unknown>): SignedRecord {
  const publicKey = receiptPublicKey();
  const signature = sign(null, Buffer.from(canonical(payload)), process.env.RECEIPT_PRIVATE_KEY!.replace(/\\n/g, "\n")).toString("base64");
  return { payload, signature, publicKey, algorithm: "Ed25519" };
}
export function bindWallet(account: OwnerAccount, agent: ManagedAgent, walletId: string) {
  if (!account.wallets.some(w => w.id === walletId)) throw new AppError(404, "Payment account not found in your workspace.");
  agent.walletId = walletId;
  agent.bindingVersion++;
  controlEvent(account, "binding", `${agent.name}'s payment account changed. Identity, budget and history are preserved. Existing authorizations need rechecking.`, agent.id);
}
export interface IntentInput { agentId: string; requestId: string; item: string; url: string; amount: number }
export function authorizeIntent(account: OwnerAccount, auth: Principal, input: IntentInput, now = Date.now()) {
  const agent = scopedAgent(account, auth, input.agentId);
  const url = new URL(input.url);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new AppError(400, "Use the merchant's HTTPS product or checkout URL.");
  if (!Number.isSafeInteger(input.amount) || input.amount < 1) throw new AppError(400, "Amount must be positive integer paise, including shipping and tax.");
  const normalizedUrl = url.href;
  const previous = account.intents.find(i => i.agentId === agent.id && i.requestId === input.requestId);
  if (previous) {
    if (previous.url !== normalizedUrl || previous.item !== input.item || previous.amount !== input.amount) throw new AppError(409, "Request ID already belongs to a different purchase. Do not change its amount or merchant.");
    return previous;
  }
  if (account.intents.length >= 500) throw new AppError(429, "Event trial intent capacity reached.");
  const merchant = url.hostname.toLowerCase();
  let reason: string | null = null;
  if (agent.status !== "active") reason = "Agent spending authority is revoked.";
  else if (!agent.walletId) reason = "Bind a payment account before authorizing purchases.";
  else if (!agent.allowedMerchants.some(domain => merchant === domain || merchant.endsWith("." + domain))) reason = "Merchant is not allowed by the owner policy.";
  else if (input.amount > agent.perPurchase) reason = "Purchase exceeds the per-purchase limit.";
  else if (agent.spent + agent.reserved + input.amount > agent.budget) reason = "Purchase exceeds the remaining spending allowance.";
  const intent: PurchaseIntent = { id: randomUUID(), requestId: input.requestId, agentId: agent.id, walletId: agent.walletId, bindingVersion: agent.bindingVersion, policyVersion: agent.policyVersion, item: input.item, url: normalizedUrl, merchant, amount: input.amount, currency: "INR", status: reason ? "blocked" : "authorized", reason: reason || "Policy approved. Payment has NOT been executed. This payment-account reference requires payer confirmation in the merchant checkout.", createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 15 * 60000).toISOString() };
  if (!reason) {
    agent.reserved += intent.amount;
    intent.proof = signedRecord({ type: "spending_authorization", version: 1, accountId: account.id, agentId: agent.id, intentId: intent.id, walletId: intent.walletId, bindingVersion: intent.bindingVersion, policyVersion: intent.policyVersion, merchant, url: normalizedUrl, item: input.item, amountPaise: input.amount, currency: "INR", expiresAt: intent.expiresAt, paymentExecuted: false });
  }
  agent.lastSeen = new Date(now).toISOString();
  account.intents.unshift(intent);
  controlEvent(account, reason ? "blocked" : "authorized", `${agent.name}: ${input.item} · ₹${input.amount / 100} at ${merchant}. ${intent.reason}`, agent.id);
  return intent;
}
export function currentAuthority(account: OwnerAccount, record: Pick<SignedRecord, "payload" | "signature">, now = Date.now()) {
  const authenticity = verifyReceipt(record.payload, record.signature, receiptPublicKey());
  if (!authenticity || record.payload.type !== "spending_authorization" || record.payload.accountId !== account.id) return { authentic: false, authorized: false, paymentExecuted: false, reason: "Invalid authorization signature or issuer scope." };
  const intent = account.intents.find(i => i.id === record.payload.intentId);
  const agent = account.agents.find(a => a.id === intent?.agentId);
  const valid = !!intent && !!agent && intent.status === "authorized" && agent.status === "active" && intent.policyVersion === agent.policyVersion && intent.bindingVersion === agent.bindingVersion && intent.walletId === agent.walletId && Date.parse(intent.expiresAt) > now && canonical(intent.proof?.payload) === canonical(record.payload);
  return { authentic: true, authorized: valid, paymentExecuted: false, reason: valid ? "Current AgentPass policy authorization is valid. This does not prove payment or grant access to bank credentials." : "Authorization is expired, consumed, cancelled, revoked, or superseded by a policy or wallet change." };
}
export function reportOrder(account: OwnerAccount, auth: Principal, id: string, orderReference: string) {
  const intent = account.intents.find(i => i.id === id);
  if (!intent) throw new AppError(404, "Purchase intent not found.");
  const agent = scopedAgent(account, auth, intent.agentId);
  if (intent.status === "reported") {
    if (intent.orderReference !== orderReference) throw new AppError(409, "A different order reference is already recorded.");
    return intent;
  }
  if (intent.status !== "authorized") throw new AppError(409, "Only an authorized intent can record an order.");
  intent.status = "reported";
  intent.orderReference = orderReference;
  intent.evidenceSource = auth.agentId ? "agent_report" : "owner_report";
  intent.reason = "Order reported by the client. No provider-verified payment evidence has been received.";
  agent.reserved -= intent.amount;
  agent.spent += intent.amount;
  if (agent.reserved < 0) throw new AppError(500, "Reservation invariant failed.");
  controlEvent(account, "reported", `${agent.name} reported order ${orderReference}. Settlement is not provider verified.`, agent.id);
  return intent;
}
