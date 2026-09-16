import assert from "node:assert/strict";
const base = process.argv[2] || "http://localhost:3000";
let cookie = "";
async function req(path: string, body?: unknown, expected = 200) {
  const r = await fetch(`${base}/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal(r.status, expected, `${path}: ${r.status}`);
  const c = r.headers.get("set-cookie");
  if (c) cookie = c.split(";")[0];
  return r.json();
}
await req(
  "payments",
  { serviceId: "research", rail: "upi", requestId: "unauthorized" },
  403,
);
await req("demo", {});
const initial = await req("snapshot");
assert.equal(initial.mode, "rehearsal");
assert.equal(initial.role, "demo");
const input = { serviceId: "research", rail: "upi", requestId: "http-proof" };
const admitted = await req("payments", input);
assert.equal(admitted.payment.status, "awaiting_checkout");
assert.equal((await req("payments", input)).payment.id, admitted.payment.id);
const checkout = new URL(admitted.checkoutUrl);
assert.equal(
  checkout.origin,
  base,
  "Checkout must use the configured public origin",
);
const workspace = checkout.searchParams.get("workspace"),
  token = checkout.searchParams.get("token"),
  id = admitted.payment.id;
await req(
  `checkout/${id}?workspace=${workspace}&token=invalid`,
  undefined,
  403,
);
await req("checkout/simulate", { workspace, token, id, outcome: "success" });
await req("checkout/simulate", { workspace, token, id, outcome: "success" });
const settled = await req(`payments/${id}`);
assert.equal(settled.payment.status, "paid");
assert(settled.payment.result);
assert(settled.receipt);
assert.equal(
  (
    await req("receipts/verify", {
      payload: settled.receipt.payload,
      signature: settled.receipt.signature,
    })
  ).valid,
  true,
);
assert.equal(
  (
    await req("receipts/verify", {
      payload: { ...settled.receipt.payload, amountPaise: 1 },
      signature: settled.receipt.signature,
    })
  ).valid,
  false,
);
let snapshot = await req("snapshot");
assert.equal(snapshot.agent.spent, 2000);
assert.equal(snapshot.agent.reserved, 0);
assert.equal(
  (
    await req("payments", {
      serviceId: "premium",
      rail: "card",
      requestId: "cap-proof",
    })
  ).payment.status,
  "blocked",
);
assert.equal(
  (
    await req("payments", {
      serviceId: "unapproved",
      rail: "upi",
      requestId: "allowlist-proof",
    })
  ).payment.status,
  "blocked",
);
await req("revoke", {});
assert.equal(
  (
    await req("payments", {
      serviceId: "market",
      rail: "upi",
      requestId: "revoke-proof",
    })
  ).payment.status,
  "blocked",
);
await req("rotate", {});
snapshot = await req("snapshot");
assert.equal(snapshot.agent.id, initial.agent.id);
assert.equal(snapshot.agent.bindingVersion, 2);
await req("resume", {});
const card = await req("payments", {
  serviceId: "market",
  rail: "card",
  requestId: "card-proof",
});
const cardLink = new URL(card.checkoutUrl);
await req("checkout/simulate", {
  workspace: cardLink.searchParams.get("workspace"),
  token: cardLink.searchParams.get("token"),
  id: card.payment.id,
  outcome: "failure",
});
snapshot = await req("snapshot");
assert.equal(snapshot.agent.spent, 2000);
assert.equal(snapshot.agent.reserved, 0);
console.log(
  "HTTP flow passed: isolated rehearsal, auth, UPI success, card decline, duplicate settlement, receipt verification/tampering, policy denials, revocation and identity continuity.",
);
await req("policy", {
  name: snapshot.agent.name,
  budget: 10000,
  perTransaction: 5000,
  allowedServices: snapshot.agent.allowedServices,
});
const concurrent = await Promise.all(
  Array.from({ length: 8 }, (_, i) =>
    req("payments", {
      serviceId: "research",
      rail: "upi",
      requestId: `db-concurrency-${i}`,
    }),
  ),
);
assert.equal(
  concurrent.filter((x) => x.payment.status === "awaiting_checkout").length,
  4,
);
assert.equal(
  concurrent.filter((x) => x.payment.status === "blocked").length,
  4,
);
snapshot = await req("snapshot");
assert.equal(snapshot.agent.spent + snapshot.agent.reserved, 10000);
console.log(
  `Concurrent HTTP reservations passed against ${snapshot.storage} storage.`,
);
