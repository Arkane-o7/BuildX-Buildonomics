import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { authorizeIntent, bindWallet, createManagedAgent, customerCookie, publicAccount } from "../src/lib/platform";
import { createPhoneRequest, activePhoneRequest, openPhonePayment, decidePhonePayment, validateUpi, decodePaymentQr } from "../src/lib/phone-payments";
import { validatePushEndpoint } from "../src/lib/phone-push";
import { createAccount, readAccount } from "../src/lib/platform-store";
import { digest } from "../src/lib/auth";
import { GET, POST } from "../src/app/api/phone/[...path]/route";
import type { OwnerAccount } from "../src/lib/platform-types";

const original = process.cwd(); let dir: string;
before(() => {
  dir = mkdtempSync(join(tmpdir(), "agentpass-phone-")); process.chdir(dir);
  delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL; delete process.env.VERCEL; delete process.env.EVENT_DISABLED;
  delete process.env.PHONE_VAPID_PUBLIC_KEY; delete process.env.PHONE_VAPID_PRIVATE_KEY;
  process.env.SESSION_SECRET = "phone-tests-".repeat(5);
  process.env.RECEIPT_PRIVATE_KEY = generateKeyPairSync("ed25519").privateKey.export({ format: "pem", type: "pkcs8" }).toString();
});
after(() => { process.chdir(original); rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const a: OwnerAccount = { id: randomUUID(), name: "Phone test", email: randomUUID() + "@example.com", createdAt: new Date().toISOString(), subscription: { plan: "event_trial", status: "trial", billingConnected: false }, agents: [], wallets: [], intents: [], events: [] };
  const { token } = createManagedAgent(a, "Hermes", "Hermes", "agent-avatar-crab.gif"), agent = a.agents[0];
  a.wallets.push({ id: randomUUID(), label: "Test UPI", kind: "upi", maskedReference: "te•••@bank", connection: "reference_only", createdAt: new Date().toISOString() });
  bindWallet(a, agent, a.wallets[0].id);
  const auth = { accountId: a.id, agentId: agent.id, tokenHash: digest(token) };
  const intent = authorizeIntent(a, auth, { agentId: agent.id, requestId: "phone-test", item: "Synthetic test", url: "https://www.amazon.in/dp/TEST", amount: 12500 });
  const input = { intentId: intent.id, sourceUrl: "https://www.amazon.in/payment", upiUri: "upi://pay?pa=merchant@bank&pn=Merchant&tr=TEST_ONLY&am=125.00&cu=INR&sign=original%2Bsignature" };
  return { a, agent, auth, token, intent, input };
}
test("UPI requests bind exact amounts, preserve the original URI and reserve no extra funds", () => {
  const { a, auth, input, agent } = fixture();
  const first = createPhoneRequest(a, auth, input);
  assert.equal(first.request.upiUri, input.upiUri);
  assert.equal(createPhoneRequest(a, auth, input).created, false);
  assert.equal(a.phoneRequests!.length, 1);
  assert.equal(agent.reserved, 12500);
  assert.throws(() => createPhoneRequest(a, auth, { ...input, upiUri: input.upiUri.replace("TEST_ONLY", "DIFFERENT") }), /different payment/);
});
test("rejects QR amount mismatch, ambiguous fields, arbitrary links, missing reference and untrusted source host", () => {
  const { a, auth, input } = fixture();
  for (const uri of [input.upiUri.replace("125.00", "126"), input.upiUri + "&am=125", "https://evil.test/pay", input.upiUri.replace("&tr=TEST_ONLY", ""), input.upiUri.replace("INR", "USD")]) assert.throws(() => validateUpi(uri, 12500));
  assert.throws(() => createPhoneRequest(a, auth, { ...input, sourceUrl: "https://www.amazon.in.evil.test/pay" }), /authorized merchant/);
  assert.throws(() => decodePaymentQr("data:image/png;base64,AAAA"), /decode/);
});
test("revocation, wallet rebinding, cancellation and expiry prevent phone payment launch", () => {
  for (const change of ["revoke", "binding", "cancel", "expire"]) {
    const { a, auth, input, agent, intent } = fixture();
    const { request } = createPhoneRequest(a, auth, input);
    if (change === "revoke") agent.status = "revoked";
    if (change === "binding") agent.bindingVersion++;
    if (change === "cancel") intent.status = "cancelled";
    if (change === "expire") request.expiresAt = new Date(0).toISOString();
    assert.equal(activePhoneRequest(a, request), false);
    assert.throws(() => openPhonePayment(a, request.id), /no longer authorized/);
  }
});
test("opening once and an owner approval report never mark payment verified or consume allowance", () => {
  const { a, auth, input, agent } = fixture();
  const { request } = createPhoneRequest(a, auth, input);
  assert.throws(() => decidePhonePayment(a, request.id, "paid"), /Open the payment app/);
  assert.equal(openPhonePayment(a, request.id).paymentConfirmed, false);
  assert.throws(() => openPhonePayment(a, request.id), /already opened/);
  assert.throws(() => decidePhonePayment(a, request.id, "decline"), /may have been submitted/);
  const status = decidePhonePayment(a, request.id, "paid");
  assert.equal(status.status, "user_reported_paid"); assert.equal(status.providerVerified, false);
  assert.equal(agent.spent, 0); assert.equal(agent.reserved, 12500);
});
test("public account omits push endpoints and complete UPI payment requests", () => {
  const { a, auth, input } = fixture();
  createPhoneRequest(a, auth, input);
  a.phoneDevices = [{ id: randomUUID(), endpoint: "https://fcm.googleapis.com/private", keys: { auth: "secret", p256dh: "secret" }, createdAt: new Date().toISOString() }];
  assert(!JSON.stringify(publicAccount(a)).includes("fcm.googleapis"));
  assert(!JSON.stringify(publicAccount(a)).includes("upi://pay"));
});
test("push endpoints cannot be used as arbitrary network targets", () => {
  validatePushEndpoint("https://fcm.googleapis.com/fcm/send/example");
  for (const url of ["http://fcm.googleapis.com/a", "https://localhost/a", "https://fcm.googleapis.com.evil.test/a", "https://fcm.googleapis.com:8443/a", "https://user@fcm.googleapis.com/a"])
    assert.throws(() => validatePushEndpoint(url));
});
test("HTTP flow enforces owner/device isolation, scoped agent requests, CSRF and truthful inbox-only delivery", async () => {
  const { a, token, input, agent } = fixture(); await createAccount(a, "unused");
  const other = fixture(); await createAccount(other.a, "unused");
  const agentHeaders = { authorization: "Bearer " + token, "Content-Type": "application/json" };
  assert.equal((await POST(new Request("https://app.test/api/phone/subscribe", { method: "POST", headers: agentHeaders, body: "{}" }))).status, 403);
  const send = await POST(new Request("https://app.test/api/phone/request", { method: "POST", headers: agentHeaders, body: JSON.stringify(input) }));
  assert.equal(send.status, 200); const sent = await send.json();
  assert.equal(sent.request.delivery, "inbox_only"); assert.equal(sent.paymentConfirmed, false);
  const foreign = await GET(new Request("https://app.test/api/phone/status", { headers: { authorization: "Bearer " + other.token } }));
  assert.deepEqual((await foreign.json()).requests, []);
  const cookie = customerCookie(a.id).split(";")[0];
  assert.equal((await POST(new Request("https://app.test/api/phone/open", { method: "POST", headers: { cookie }, body: JSON.stringify({ id: sent.request.id }) }))).status, 403);
  const foreignOpen = await POST(new Request("https://app.test/api/phone/open", { method: "POST", headers: { cookie: customerCookie(other.a.id).split(";")[0], origin: "https://app.test" }, body: JSON.stringify({ id: sent.request.id }) }));
  assert.equal(foreignOpen.status, 404);
  const opened = await POST(new Request("https://app.test/api/phone/open", { method: "POST", headers: { cookie, origin: "https://app.test" }, body: JSON.stringify({ id: sent.request.id }) }));
  assert.equal(opened.status, 200); assert.equal((await opened.json()).upiUri, input.upiUri);
  assert.equal((await readAccount(a.id)).agents.find(x => x.id === agent.id)!.spent, 0);
});
