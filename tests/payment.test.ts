import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { initialWorkspace, mutate, readWorkspace } from "../src/lib/store";
import {
  evaluate,
  purchase,
  finalize,
  verifyProviderPayment,
} from "../src/lib/engine";
import { verifyReceipt } from "../src/lib/receipts";
import {
  authenticate,
  sessionCookie,
  checkoutToken,
  requireCheckout,
  requireWrite,
} from "../src/lib/auth";
import {
  paymentMode,
  providerReady,
  checkoutSignature,
  webhookSignature,
} from "../src/lib/provider";
import { createHmac } from "node:crypto";
const original = process.cwd();
let dir: string;
const auth = { role: "agent" as const, workspace: "owner" };
before(() => {
  dir = mkdtempSync(join(tmpdir(), "agentpass-test-"));
  process.chdir(dir);
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  delete process.env.VERCEL;
  process.env.PAYMENT_MODE = "rehearsal";
  process.env.SESSION_SECRET = "s".repeat(40);
  process.env.AGENTPASS_AGENT_TOKEN = "a".repeat(40);
  process.env.RECEIPT_PRIVATE_KEY = generateKeyPairSync("ed25519")
    .privateKey.export({ format: "pem", type: "pkcs8" })
    .toString();
});
after(() => {
  process.chdir(original);
  rmSync(dir, { recursive: true, force: true });
});
async function reset() {
  await mutate("owner", (w) => Object.assign(w, initialWorkspace("owner")));
}
test("policy denies revoked agents, unknown merchants, invalid amounts and cap breaches", () => {
  const w = initialWorkspace("test");
  assert.equal(evaluate(w, "research", 2000), null);
  assert.match(evaluate(w, "unapproved", 100)!, /approved/);
  assert.match(evaluate(w, "research", 0)!, /invalid/);
  assert.match(evaluate(w, "premium", 150000)!, /limit/);
  w.agent.status = "revoked";
  assert.match(evaluate(w, "research", 2000)!, /revoked/);
});
test("concurrent purchases reserve budget atomically and cannot overspend", async () => {
  await reset();
  await mutate("owner", (w) => {
    w.agent.budget = 10000;
    w.agent.perTransaction = 5000;
  });
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      purchase(auth, {
        serviceId: "research",
        rail: "upi",
        requestId: `parallel-${i}`,
      }),
    ),
  );
  assert.equal(
    results.filter((r) => r.payment.status === "awaiting_checkout").length,
    5,
  );
  assert.equal(results.filter((r) => r.payment.status === "blocked").length, 7);
  const w = await readWorkspace("owner");
  assert.equal(w.agent.reserved, 10000);
  assert.equal(w.agent.spent, 0);
});
test("duplicate concurrent intent reserves only once; changed parameters conflict", async () => {
  await reset();
  const input = {
    serviceId: "research",
    rail: "card" as const,
    requestId: "same-intent",
  };
  const results = await Promise.all([
    purchase(auth, input),
    purchase(auth, input),
    purchase(auth, input),
  ]);
  assert.equal(new Set(results.map((r) => r.payment.id)).size, 1);
  assert.equal((await readWorkspace("owner")).agent.reserved, 2000);
  await assert.rejects(
    purchase(auth, { ...input, rail: "upi" }),
    /different purchase/,
  );
});
test("settlement is idempotent and receipts detect tampering", async () => {
  await reset();
  const { payment } = await purchase(auth, {
    serviceId: "research",
    rail: "upi",
    requestId: "settle",
  });
  await mutate("owner", (w) => finalize(w, payment.id));
  await mutate("owner", (w) => finalize(w, payment.id));
  const w = await readWorkspace("owner");
  assert.equal(w.agent.spent, 2000);
  assert.equal(w.agent.reserved, 0);
  assert.equal(w.receipts.length, 1);
  const r = w.receipts[0];
  assert(verifyReceipt(r.payload, r.signature, r.publicKey));
  assert(
    !verifyReceipt({ ...r.payload, amountPaise: 1 }, r.signature, r.publicKey),
  );
});
test("rehearsal decline releases reservation without spend or receipt", async () => {
  await reset();
  const { payment } = await purchase(auth, {
    serviceId: "market",
    rail: "card",
    requestId: "decline",
  });
  await mutate("owner", (w) => finalize(w, payment.id, undefined, true));
  const w = await readWorkspace("owner");
  assert.equal(w.agent.reserved, 0);
  assert.equal(w.agent.spent, 0);
  assert.equal(w.receipts.length, 0);
});
test("funding reference changes preserve identity and historical receipt", async () => {
  await reset();
  const { payment } = await purchase(auth, {
    serviceId: "research",
    rail: "upi",
    requestId: "rotation",
  });
  await mutate("owner", (w) => finalize(w, payment.id));
  const before = await readWorkspace("owner");
  await mutate("owner", (w) => {
    w.agent.bindingVersion++;
    w.agent.fundingLabel = "Company account · B";
  });
  const after = await readWorkspace("owner");
  assert.equal(before.agent.id, after.agent.id);
  assert.equal(after.receipts[0].payload.bindingVersion, 1);
  assert.deepEqual(before.receipts, after.receipts);
});
test("auth separates public viewers, demo owners and scoped agent credentials", () => {
  assert.equal(
    authenticate(new Request("http://localhost/api/passport")).role,
    "viewer",
  );
  const req = new Request("http://localhost/api/policy", {
    headers: { Authorization: `Bearer ${process.env.AGENTPASS_AGENT_TOKEN}` },
  });
  assert.equal(authenticate(req).role, "agent");
  assert.throws(() => requireWrite(req, true), /Owner access/);
  assert.throws(
    () =>
      authenticate(
        new Request("http://localhost", {
          headers: { Authorization: "Bearer nope" },
        }),
      ),
    /invalid/,
  );
  const cookie = sessionCookie("demo", "demo_123").split(";")[0];
  assert.equal(
    authenticate(new Request("http://localhost", { headers: { cookie } }))
      .workspace,
    "demo_123",
  );
  assert.throws(
    () =>
      requireWrite(
        new Request("http://localhost/api/policy", {
          headers: { cookie, origin: "https://evil.example" },
        }),
      ),
    /origin/,
  );
  const token = checkoutToken("owner", "payment");
  assert.doesNotThrow(() => requireCheckout("owner", "payment", token));
  assert.throws(() => requireCheckout("demo_123", "payment", token), /invalid/);
});
test("live/test keys cannot be accidentally interchanged; public demos stay rehearsal", () => {
  process.env.PAYMENT_MODE = "razorpay_live";
  process.env.RAZORPAY_KEY_ID = "rzp_test_example";
  process.env.RAZORPAY_KEY_SECRET = "secret";
  assert.equal(providerReady(), false);
  process.env.RAZORPAY_KEY_ID = "rzp_live_example";
  assert.equal(providerReady(), true);
  assert.equal(paymentMode(true), "rehearsal");
  process.env.PAYMENT_MODE = "rehearsal";
});
test("provider settlement requires matching order, amount, currency and capture", async () => {
  await reset();
  const { payment } = await purchase(auth, {
    serviceId: "research",
    rail: "upi",
    requestId: "provider",
  });
  await mutate("owner", (w) => {
    w.payments[0].mode = "razorpay_live";
    w.payments[0].orderId = "order_expected";
  });
  const valid = {
    id: "pay_verified",
    order_id: "order_expected",
    amount: 2000,
    currency: "INR",
    status: "captured",
    captured: true,
    method: "upi",
  };
  for (const change of [
    { order_id: "order_other" },
    { amount: 1 },
    { currency: "USD" },
    { captured: false },
    { status: "authorized" },
  ])
    await assert.rejects(
      mutate("owner", (w) => finalize(w, payment.id, { ...valid, ...change })),
      /confirmed/,
    );
  await mutate("owner", (w) => finalize(w, payment.id, valid));
  assert.equal((await readWorkspace("owner")).agent.spent, 2000);
});
test("checkout and webhook HMAC are checked against server-owned values", () => {
  process.env.RAZORPAY_KEY_SECRET = "provider-secret";
  const signature = createHmac("sha256", "provider-secret")
    .update("order_1|pay_1")
    .digest("hex");
  assert(checkoutSignature("order_1", "pay_1", signature));
  assert(!checkoutSignature("order_2", "pay_1", signature));
  process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret";
  const raw = '{"event":"payment.captured"}';
  const sig = createHmac("sha256", "webhook-secret").update(raw).digest("hex");
  assert(webhookSignature(raw, sig));
  assert(!webhookSignature(raw + " ", sig));
});
test("provider API fetch is authoritative; callback ID alone does not settle", async () => {
  await reset();
  const { payment } = await purchase(auth, {
    serviceId: "research",
    rail: "upi",
    requestId: "fetch",
  });
  await mutate("owner", (w) => {
    w.payments[0].mode = "razorpay_live";
    w.payments[0].orderId = "order_fetch";
  });
  process.env.PAYMENT_MODE = "razorpay_live";
  process.env.RAZORPAY_KEY_ID = "rzp_live_example";
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      id: "pay_real",
      order_id: "order_fetch",
      amount: 2000,
      currency: "INR",
      status: "authorized",
      captured: false,
      method: "upi",
    });
  try {
    await assert.rejects(
      verifyProviderPayment("owner", payment.id, "pay_real"),
      /confirmed/,
    );
    assert.equal((await readWorkspace("owner")).agent.reserved, 2000);
  } finally {
    globalThis.fetch = fetchOriginal;
    process.env.PAYMENT_MODE = "rehearsal";
  }
});
