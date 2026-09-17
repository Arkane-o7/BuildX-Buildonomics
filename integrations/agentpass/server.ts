import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const base = process.env.AGENTPASS_URL?.replace(/\/$/, "");
const token = process.env.AGENTPASS_AGENT_TOKEN;
if (!base || !token?.startsWith("ap1.")) throw new Error("Configure a customer-scoped credential with npm run plugin:configure.");
const url = new URL(base);
if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("AgentPass requires HTTPS outside localhost.");

async function request(path: string, body?: unknown, namespace = "platform") {
  const response = await fetch(`${base}/api/${namespace}/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(25000),
  });
  return { data: await response.json(), error: !response.ok };
}
async function tool(fn: () => ReturnType<typeof request>) {
  try {
    const { data, error } = await fn();
    return { content: [{ type: "text" as const, text: JSON.stringify(data) }], isError: error };
  } catch {
    return { content: [{ type: "text" as const, text: "AgentPass could not respond. Check purchase_history before retrying. Reuse the same requestId and exact purchase parameters. No payment success can be inferred." }], isError: true };
  }
}
const server = new McpServer({ name: "agentpass", version: "2.1.0" });
server.tool("passport", "Read your owner-attested identity, payment-account binding, spending rules and execution capability. Amounts are integer paise: 100 paise = INR 1. A reference_only account cannot execute payments. Check this before shopping.", {}, () => tool(() => request("passport")));
server.tool("authorize_purchase", "Authorize an exact external purchase against owner policy and reserve its total allowance. This does NOT execute payment or place an order. Obtain the real final total including delivery/tax from merchant tools. Use a stable requestId on retries; never invent payment confirmation. Read payment capability from passport. Recheck authority immediately before any supported external execution.", {
  requestId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  item: z.string().min(1).max(200),
  url: z.string().url().max(2000).describe("Exact HTTPS product or checkout URL observed at the external merchant."),
  amountPaise: z.number().int().positive().max(10000000).describe("Final total in integer paise including tax and shipping; INR 799 = 79900."),
}, ({ amountPaise, ...input }) => tool(() => request("authorize", { ...input, amount: amountPaise })));
server.tool("purchase_history", "Read only this agent's purchase intents, policy decisions, reservations and client-reported orders. Reported orders are not provider-verified settlement. Check this after uncertain responses; avoid duplicate purchases.", {}, () => tool(() => request("intents")));
server.tool("verify_authority", "Check current authority for an existing intent. Valid signatures alone do not prove current permission: revocation, expiry, policy changes and account rebinding invalidate authority. This is not payment evidence.", { intentId: z.string().uuid() }, ({ intentId }) => tool(async () => {
  const result = await request("intents");
  if (result.error) return result;
  const intent = result.data.intents.find((i: { id: string }) => i.id === intentId);
  if (!intent?.proof) return { data: { error: "No signed authorization exists for this agent's intent." }, error: true };
  return request("verify", { payload: intent.proof.payload, signature: intent.proof.signature });
}));
server.tool("report_order", "Record an order reference only after observing the merchant's order confirmation. This converts the reserved amount into REPORTED spending, not verified settlement. Never invent an order ID or use policy approval as evidence of payment. This does not place an order or charge funds.", { intentId: z.string().uuid(), orderReference: z.string().min(1).max(100) }, input => tool(() => request("report", input)));
server.tool("send_payment_to_phone", "Send an authorized merchant's actual UPI payment request to the owner's AgentPass phone inbox and connected push devices. This is NOT UPI Collect, a bank connection, or payment confirmation. First obtain current authority and a fresh merchant QR/UPI URI. Copy the exact merchant-issued URI or QR image data URL from checkout; never invent a payee or reconstruct signed parameters. sourceUrl must be the observed merchant page. Requires exact matching amount and transaction reference. The owner opens their UPI app and approves there. If extraction fails, explain that instead of fabricating a URI. Repeated identical calls return the same request without a second alert.", {
  intentId: z.string().uuid(), sourceUrl: z.string().url().max(2000),
  upiUri: z.string().max(8000).optional().describe("Exact upi://pay URI decoded from the merchant QR or provided by its checkout."),
  qrImageDataUrl: z.string().max(1500000).optional().describe("Alternatively, the merchant QR as data:image/png;base64,... or data:image/jpeg;base64,...; server decodes it. Do not send unrelated screenshots."),
}, input => tool(() => request("request", input, "phone")));
server.tool("phone_payment_status", "Check the owner's phone handoff for this intent. pending/opened/user_reported_paid are NOT verified settlement. After owner reports approval, inspect the merchant's order/payment result before report_order. Do not automatically retry an ambiguous payment. If notification delivery is inbox_only, give the owner phoneUrl rather than claiming a notification arrived.", { intentId: z.string().uuid() }, ({ intentId }) => tool(() => request("status?intentId=" + encodeURIComponent(intentId), undefined, "phone")));
await server.connect(new StdioServerTransport());
