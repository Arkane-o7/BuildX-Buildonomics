import assert from "node:assert/strict";
import { verify } from "node:crypto";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { canonical } from "../src/lib/receipts";

// Uses the same customer-scoped MCP launcher as Hermes; never reads owner secrets.
const client = new Client({ name: "agentpass-identity-wallet-demo", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: "python3", args: [resolve("scripts/platform-plugin.py"), "mcp"] }));
async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(`${name} failed; inspect the account before retrying.`);
  const block = (result.content as { type: string; text?: string }[]).find(b => b.type === "text");
  return JSON.parse(block!.text!);
}
const rupees = (paise: number) => `INR ${(paise / 100).toFixed(2)}`;
try {
  const before = await call("passport");
  assert.equal(before.paymentExecution.available, false);
  assert(verify(null, Buffer.from(canonical(before.passport.payload)), before.passport.publicKey, Buffer.from(before.passport.signature, "base64")), "Passport signature must verify");
  console.log(`PASS Identity: ${before.agent.name} (${before.agent.id}), owner ${before.owner.name}`);
  console.log("PASS Passport signature matches the public key returned by AgentPass. Owner-attested identity, not KYC.");
  assert(before.wallet, "Bind a payment-account reference in the dashboard first.");
  console.log(`PASS Account binding: ${before.wallet.label}, ${before.wallet.kind}, ${before.wallet.maskedReference}, ${before.wallet.connection}`);
  console.log(`Allowance ${rupees(before.agent.budget)} | reserved ${rupees(before.agent.reserved)} | available ${rupees(before.remainingPaise)}`);

  const history = await call("purchase_history");
  const intent = history.intents.find((i: any) => i.proof && i.status === "authorized" && Date.parse(i.expiresAt) > Date.now());
  if (!intent) throw new Error("No unexpired authorized request exists. Prepare a fresh, explicitly labelled authorization test or use a newly verified merchant quote first.");
  const validity = await call("verify_authority", { intentId: intent.id });
  assert.equal(validity.authorized, true, validity.reason);
  console.log(`PASS Current authorization: ${intent.requestId}, ${rupees(intent.amount)}; payment not executed.`);
  const repeat = await call("authorize_purchase", { requestId: intent.requestId, item: intent.item, url: intent.url, amountPaise: intent.amount });
  assert.equal(repeat.intent.id, intent.id);
  assert.equal((await call("passport")).agent.reserved, before.agent.reserved);
  console.log("PASS Exact retry returned the same intent without another reservation.");

  // These are explicit synthetic policy checks, not merchant quotes or purchases.
  const overLimit = before.agent.perPurchase + 100;
  assert(overLimit <= 10000000, "Configured purchase cap exceeds this demo's supported range.");
  const blocked = await call("authorize_purchase", {
    requestId: `demo-cap-${before.agent.policyVersion}-${overLimit}`,
    item: "DEMO ONLY: synthetic over-limit authorization test",
    url: intent.url, amountPaise: overLimit,
  });
  assert.equal(blocked.intent.status, "blocked");
  assert.match(blocked.intent.reason, /per-purchase limit/);
  console.log(`PASS ${rupees(overLimit)} request blocked: ${blocked.intent.reason}`);
  const merchant = await call("authorize_purchase", {
    requestId: `demo-merchant-${before.agent.policyVersion}`,
    item: "DEMO ONLY: synthetic unapproved merchant test",
    url: "https://unapproved-merchant.invalid/demo", amountPaise: 100,
  });
  assert.equal(merchant.intent.status, "blocked");
  assert.match(merchant.intent.reason, /Merchant is not allowed/);
  const after = await call("passport");
  assert.equal(after.agent.reserved, before.agent.reserved);
  assert.equal(after.agent.spent, before.agent.spent);
  console.log(`PASS Unapproved merchant blocked: ${merchant.intent.reason}`);
  console.log("PASS Tests did not change reserved allowance or reported spending.");
  console.log("Open AgentPass → Activity to show the authorized request and two labelled blocked tests.");
  console.log("No bank debit or merchant order was attempted. This demonstrates identity, account binding and spending authority.");
} finally {
  await client.close();
}
