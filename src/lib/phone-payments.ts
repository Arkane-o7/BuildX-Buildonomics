import { randomUUID } from "node:crypto";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { AppError } from "./store";
import { controlEvent, currentAuthority, scopedAgent, type Principal } from "./platform";
import type { OwnerAccount, PhoneRequest } from "./platform-types";

export function decodePaymentQr(image: string): string {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!match || image.length > 1500000) throw new AppError(400, "Provide a PNG/JPEG of the merchant QR, at most 1 MB.");
  const bytes = Buffer.from(match[2], "base64");
  try {
    if (match[1] === "png" && (bytes.length < 24 || bytes.readUInt32BE(16) * bytes.readUInt32BE(20) > 2000000)) throw Error();
    const decoded = match[1] === "png" ? PNG.sync.read(bytes) : jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 2, maxMemoryUsageInMB: 32 });
    if (!decoded.width || !decoded.height || decoded.width * decoded.height > 2000000) throw Error();
    const result = jsQR(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height);
    if (!result) throw Error();
    return result.data;
  } catch { throw new AppError(400, "Could not decode this merchant QR. Use a clear, current payment QR image."); }
}

export function validateUpi(uri: string, amount: number) {
  let url: URL;
  try { url = new URL(uri); } catch { throw new AppError(400, "Invalid UPI payment request."); }
  if (uri.length > 8000 || url.protocol !== "upi:" || url.hostname !== "pay" || (url.pathname && url.pathname !== "/") || url.username || url.password || url.port || url.hash)
    throw new AppError(400, "Only a merchant upi://pay request is supported.");
  for (const key of url.searchParams.keys()) if (url.searchParams.getAll(key).length !== 1) throw new AppError(400, "Ambiguous UPI parameters.");
  const p = url.searchParams;
  const am = p.get("am") || "";
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(am) || p.get("cu") !== "INR") throw new AppError(400, "The merchant request must specify an exact INR amount.");
  const [whole, fraction = ""] = am.split(".");
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (paise !== amount) throw new AppError(409, "QR amount does not match the authorized total.");
  const payee = p.get("pa") || "", payeeName = p.get("pn") || "", reference = p.get("tr") || "";
  if (!/^[A-Za-z0-9._-]{2,100}@[A-Za-z0-9.-]{2,50}$/.test(payee) || !payeeName.trim() || payeeName.length > 150 || !reference.trim() || reference.length > 200 || /[\x00-\x1f]/.test(payeeName + reference))
    throw new AppError(400, "Use a merchant payment request with payee, name and transaction reference. Static personal QR codes are not supported.");
  return { payee, payeeName, reference };
}

export function activePhoneRequest(account: OwnerAccount, request: PhoneRequest, now = Date.now()) {
  const intent = account.intents.find(i => i.id === request.intentId);
  return !!intent?.proof && Date.parse(request.expiresAt) > now && currentAuthority(account, intent.proof, now).authorized;
}

export function createPhoneRequest(account: OwnerAccount, auth: Principal, input: { intentId: string; upiUri: string; sourceUrl: string }, now = Date.now()) {
  const intent = account.intents.find(i => i.id === input.intentId);
  if (!intent) throw new AppError(404, "Purchase authorization not found.");
  const agent = scopedAgent(account, auth, intent.agentId);
  if (!intent.proof || !currentAuthority(account, intent.proof, now).authorized) throw new AppError(409, "Obtain current purchase authority before requesting payment.");
  const source = new URL(input.sourceUrl);
  if (source.protocol !== "https:" || source.username || source.password || source.port || source.hostname !== intent.merchant)
    throw new AppError(400, "The QR source must be an HTTPS page on the authorized merchant host.");
  const upi = validateUpi(input.upiUri, intent.amount);
  const requests = account.phoneRequests ??= [];
  const existing = requests.find(r => r.intentId === intent.id);
  if (existing) {
    if (existing.upiUri !== input.upiUri) throw new AppError(409, "A different payment request already exists for this intent. Check its result before any replacement.");
    return { request: existing, created: false };
  }
  if (requests.some(r => r.payee === upi.payee && r.reference === upi.reference)) throw new AppError(409, "This merchant payment reference was already sent. Check its existing status.");
  if (requests.length >= 500) throw new AppError(429, "Phone request limit reached.");
  if (requests.some(r => now - Date.parse(r.createdAt) < 15000)) throw new AppError(429, "Wait a few seconds before sending another phone request.");
  const timestamp = new Date(now).toISOString();
  const request: PhoneRequest = {
    id: randomUUID(), intentId: intent.id, agentId: agent.id, upiUri: input.upiUri, ...upi,
    // Preserve signed merchant query fields exactly; never reconstruct a payment.
    sourceUrl: source.origin + source.pathname, createdAt: timestamp, updatedAt: timestamp,
    expiresAt: new Date(Math.min(Date.parse(intent.expiresAt), now + 5 * 60000)).toISOString(),
    status: "pending", delivery: "sending",
  };
  requests.unshift(request);
  controlEvent(account, "phone_request", `${agent.name} requested phone approval for ₹${intent.amount / 100} at ${intent.merchant}. Payment has not been confirmed.`, agent.id);
  return { request, created: true };
}

export function phoneView(account: OwnerAccount, request: PhoneRequest) {
  const intent = account.intents.find(i => i.id === request.intentId)!;
  const { upiUri, ...safe } = request; void upiUri;
  return { ...safe, item: intent.item, amount: intent.amount, merchant: intent.merchant,
    agentName: account.agents.find(a => a.id === request.agentId)?.name || "Agent",
    active: activePhoneRequest(account, request), providerVerified: false,
    orderReference: intent.orderReference || null, evidenceSource: intent.evidenceSource || null };
}

export function openPhonePayment(account: OwnerAccount, id: string) {
  const request = account.phoneRequests?.find(r => r.id === id);
  if (!request) throw new AppError(404, "Phone request not found.");
  if (!activePhoneRequest(account, request) || request.status !== "pending") throw new AppError(409, "Request expired, was already opened, or is no longer authorized. Check the merchant before retrying.");
  request.status = "opened";
  request.updatedAt = new Date().toISOString();
  controlEvent(account, "payment_app_opened", "Owner requested the UPI app handoff. This is not payment confirmation.", request.agentId);
  return { upiUri: request.upiUri, paymentConfirmed: false };
}

export function decidePhonePayment(account: OwnerAccount, id: string, decision: "paid" | "decline") {
  const request = account.phoneRequests?.find(r => r.id === id);
  if (!request) throw new AppError(404, "Phone request not found.");
  if (decision === "paid") {
    if (!["opened", "user_reported_paid"].includes(request.status)) throw new AppError(409, "Open the payment app before reporting its outcome.");
    if (request.status === "user_reported_paid") return phoneView(account, request);
    request.status = "user_reported_paid";
  } else {
    if (request.status !== "pending") throw new AppError(409, "This request may have been submitted. Check the merchant before cancelling anything.");
    request.status = "declined";
  }
  request.updatedAt = new Date().toISOString();
  controlEvent(account, decision === "paid" ? "owner_payment_report" : "phone_declined", decision === "paid" ? "Owner reports payment approval. Merchant confirmation is still required; no provider settlement verified." : "Owner declined the phone request. The external order and allowance reservation are unchanged.", request.agentId);
  return phoneView(account, request);
}
