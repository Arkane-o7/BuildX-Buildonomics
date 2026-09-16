import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  authenticate,
  checkOrigin,
  checkoutUrl,
  digest,
  requireCheckout,
  requireWrite,
  same,
  sessionCookie,
} from "@/lib/auth";
import {
  AppError,
  event,
  loginAllowed,
  mutate,
  readWorkspace,
} from "@/lib/store";
import {
  finalize,
  purchase,
  snapshot,
  verifyProviderPayment,
  reconcilePayment,
} from "@/lib/engine";
import {
  checkoutSignature,
  paymentMode,
  webhookSignature,
  razorpay,
} from "@/lib/provider";
import { receiptPublicKey, verifyReceipt } from "@/lib/receipts";
import { SERVICES, money } from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
async function body(req: Request) {
  const text = await req.text();
  if (text.length > 16000) throw new AppError(413, "Request is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(400, "Invalid JSON.");
  }
}
const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);

async function handler(req: Request): Promise<Response> {
  try {
    if (process.env.EVENT_DISABLED === "true")
      throw new AppError(503, "The AgentPass event has ended.");
    const url = new URL(req.url),
      route = url.pathname.slice(5),
      method = req.method;
    if (method === "POST" && route === "session") {
      checkOrigin(req);
      const input = z
        .object({ code: z.string().max(200) })
        .parse(await body(req));
      const ip = digest(
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
      );
      if (!(await loginAllowed(ip)))
        throw new AppError(429, "Too many attempts. Try again in 15 minutes.");
      const expected = process.env.OWNER_ACCESS_CODE;
      if (!expected || expected.length < 12)
        throw new AppError(503, "Owner access has not been configured.");
      if (!same(input.code, expected))
        throw new AppError(401, "Access code is incorrect.");
      return json({ ok: true }, 200, {
        "Set-Cookie": sessionCookie("owner", "owner"),
      });
    }
    if (method === "DELETE" && route === "session") {
      checkOrigin(req);
      return json({ ok: true }, 200, {
        "Set-Cookie":
          "agentpass_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      });
    }
    if (method === "POST" && route === "demo") {
      checkOrigin(req);
      const ip = digest(
        "demo:" +
          (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            "local"),
      );
      if (!(await loginAllowed(ip)))
        throw new AppError(
          429,
          "Too many new demos. Keep using the current session.",
        );
      const id = `demo_${randomUUID()}`;
      await mutate(id, () => {}, true);
      return json({ ok: true }, 200, {
        "Set-Cookie": sessionCookie("demo", id),
      });
    }
    if (method === "GET" && route === "snapshot")
      return json(await snapshot(authenticate(req)));
    if (method === "GET" && route === "services") {
      authenticate(req);
      return json({ services: SERVICES });
    }
    if (method === "GET" && route === "passport") {
      const auth = authenticate(req);
      if (auth.role === "agent")
        await mutate(auth.workspace, (w) => {
          w.agent.lastSeen = new Date().toISOString();
        });
      const w = await readWorkspace(auth.workspace);
      return json({
        agent: w.agent,
        mode: paymentMode(w.demo),
        remaining: money(w.agent.budget - w.agent.spent - w.agent.reserved),
        remainingPaise: w.agent.budget - w.agent.spent - w.agent.reserved,
        amountUnit:
          "All numeric agent amounts are integer paise. 100 paise = 1 INR. Use formatted remaining for the user.",
        identityType: "AgentPass owner-attested identity",
        paymentCompletion:
          "Payer confirms UPI or card checkout; agents never receive card details or UPI PINs.",
      });
    }
    if (method === "POST" && route === "payments") {
      const auth = requireWrite(req);
      const input = z
        .object({
          serviceId: idSchema,
          requestId: idSchema,
          rail: z.enum(["upi", "card"]),
        })
        .strict()
        .parse(await body(req));
      return json(await purchase(auth, input));
    }
    if (method === "GET" && /^payments\/[^/]+$/.test(route)) {
      const auth = authenticate(req);
      if (auth.role === "viewer")
        throw new AppError(403, "Agent or owner access is required.");
      const id = route.split("/")[1],
        w = await readWorkspace(auth.workspace);
      const payment = w.payments.find((p) => p.id === id || p.requestId === id);
      if (!payment) throw new AppError(404, "Purchase not found.");
      return json({
        payment,
        checkoutUrl:
          payment.status === "awaiting_checkout"
            ? checkoutUrl(auth.workspace, payment.id)
            : null,
        receipt: w.receipts.find((r) => r.id === payment.receiptId) || null,
      });
    }
    if (method === "POST" && /^payments\/[^/]+\/reconcile$/.test(route)) {
      const auth = requireWrite(req);
      return json({
        payment: await reconcilePayment(auth.workspace, route.split("/")[1]),
      });
    }
    if (method === "POST" && route === "policy") {
      const auth = requireWrite(req, true);
      const input = z
        .object({
          budget: z.number().int().min(100).max(10000000),
          perTransaction: z.number().int().min(100).max(10000000),
          name: z.string().trim().min(1).max(40),
          allowedServices: z
            .array(z.enum(["research", "market", "premium", "unapproved"]))
            .max(4),
        })
        .strict()
        .parse(await body(req));
      await mutate(auth.workspace, (w) => {
        if (input.budget < w.agent.spent + w.agent.reserved)
          throw new AppError(
            409,
            "Budget cannot be less than spent plus reserved amounts.",
          );
        if (input.perTransaction > input.budget)
          throw new AppError(
            400,
            "Per-purchase limit cannot exceed the total budget.",
          );
        Object.assign(w.agent, input);
        w.agent.policyVersion++;
        event(
          w,
          "policy",
          "Spending policy updated",
          `Policy v${w.agent.policyVersion}. Rules apply to new purchase requests.`,
          "Owner",
        );
      });
      return json({ ok: true });
    }
    if (method === "POST" && route === "rotate") {
      const auth = requireWrite(req, true);
      await mutate(auth.workspace, (w) => {
        w.agent.bindingVersion++;
        w.agent.fundingLabel = `Company account · ${String.fromCharCode(65 + ((w.agent.bindingVersion - 1) % 26))}`;
        event(
          w,
          "rotation",
          "Funding reference rotated",
          `Reference v${w.agent.bindingVersion}. Identity, budget and history preserved. Actual payment details are chosen in checkout.`,
          "Owner",
        );
      });
      return json({ ok: true });
    }
    if (method === "POST" && (route === "revoke" || route === "resume")) {
      const auth = requireWrite(req, true);
      await mutate(auth.workspace, (w) => {
        w.agent.status = route === "revoke" ? "revoked" : "active";
        w.agent.policyVersion++;
        event(
          w,
          route,
          route === "revoke"
            ? "Spending authority revoked"
            : "Spending authority restored",
          route === "revoke"
            ? "New requests are blocked. Existing provider orders remain in flight and accounted for."
            : "New purchases can be authorized within the current policy.",
          "Owner",
        );
      });
      return json({ ok: true });
    }
    if (method === "GET" && /^checkout\/[^/]+$/.test(route)) {
      const id = route.split("/")[1],
        workspace = url.searchParams.get("workspace") || "",
        token = url.searchParams.get("token") || "";
      requireCheckout(workspace, id, token);
      const w = await readWorkspace(workspace),
        payment = w.payments.find((p) => p.id === id);
      if (!payment) throw new AppError(404, "Checkout not found.");
      return json({
        payment,
        agent: { name: w.agent.name, status: w.agent.status },
        keyId:
          payment.mode !== "rehearsal" ? process.env.RAZORPAY_KEY_ID : null,
        receipt: w.receipts.find((r) => r.id === payment.receiptId) || null,
      });
    }
    if (method === "POST" && route === "checkout/simulate") {
      checkOrigin(req);
      const input = z
        .object({
          workspace: idSchema,
          id: z.string().uuid(),
          token: z.string().max(200),
          outcome: z.enum(["success", "failure"]),
        })
        .parse(await body(req));
      requireCheckout(input.workspace, input.id, input.token);
      const payment = await mutate(input.workspace, (w) => {
        const p = w.payments.find((p) => p.id === input.id);
        if (!p || p.mode !== "rehearsal")
          throw new AppError(
            403,
            "Simulation is only available in rehearsal mode.",
          );
        if (w.agent.status !== "active" && p.status !== "paid")
          throw new AppError(
            409,
            "Authority revoked. This rehearsal cannot continue.",
          );
        return finalize(w, input.id, undefined, input.outcome === "failure");
      });
      return json({ payment });
    }
    if (method === "POST" && route === "checkout/verify") {
      checkOrigin(req);
      const input = z
        .object({
          workspace: idSchema,
          id: z.string().uuid(),
          token: z.string().max(200),
          paymentId: idSchema,
          signature: z.string().max(200),
        })
        .parse(await body(req));
      requireCheckout(input.workspace, input.id, input.token);
      const w = await readWorkspace(input.workspace),
        p = w.payments.find((x) => x.id === input.id);
      if (
        !p?.orderId ||
        !checkoutSignature(p.orderId, input.paymentId, input.signature)
      )
        throw new AppError(400, "Payment signature did not match this order.");
      return json({
        payment: await verifyProviderPayment(
          input.workspace,
          input.id,
          input.paymentId,
        ),
      });
    }
    if (method === "POST" && route === "webhooks/razorpay") {
      const raw = await req.text();
      if (
        raw.length > 100000 ||
        !webhookSignature(raw, req.headers.get("x-razorpay-signature") || "")
      )
        throw new AppError(400, "Webhook signature is invalid.");
      const data = JSON.parse(raw);
      if (data.event !== "payment.captured") return json({ received: true });
      const p = data.payload?.payment?.entity;
      if (!p?.notes?.agentpass_workspace || !p?.notes?.agentpass_payment) {
        // Notes may live on the order, so use the signed order entity if provided.
        const notes =
          data.payload?.order?.entity?.notes ||
          (p?.order_id
            ? (
                await razorpay<{ notes: Record<string, string> }>(
                  `orders/${encodeURIComponent(p.order_id)}`,
                )
              ).notes
            : null);
        if (!notes?.agentpass_workspace || !notes?.agentpass_payment)
          return json({ received: true, matched: false });
        await verifyProviderPayment(
          notes.agentpass_workspace,
          notes.agentpass_payment,
          p.id,
        );
      } else
        await verifyProviderPayment(
          p.notes.agentpass_workspace,
          p.notes.agentpass_payment,
          p.id,
        );
      return json({ received: true });
    }
    if (method === "GET" && /^receipts\/[^/]+$/.test(route)) {
      const auth = authenticate(req),
        w = await readWorkspace(auth.workspace);
      const receipt = w.receipts.find((r) => r.id === route.split("/")[1]);
      if (!receipt) throw new AppError(404, "Receipt not found.");
      return json({ receipt });
    }
    if (method === "POST" && route === "receipts/verify") {
      const input = z
        .object({
          payload: z.record(z.unknown()),
          signature: z.string().max(1000),
        })
        .parse(await body(req));
      return json({
        valid: verifyReceipt(
          input.payload,
          input.signature,
          receiptPublicKey(),
        ),
        issuer: "AgentPass BuildX",
        scope:
          "Historical receipt authenticity. This does not establish current authority or service quality.",
      });
    }
    if (method === "GET" && route === "public-key")
      return json({ publicKey: receiptPublicKey(), algorithm: "Ed25519" });
    throw new AppError(404, "Endpoint not found.");
  } catch (e) {
    if (e instanceof z.ZodError)
      return json(
        {
          error:
            "Some fields are invalid. Check the amounts and required inputs.",
          fields: e.issues.map((i) => i.path.join(".")),
        },
        400,
      );
    if (e instanceof AppError) return json({ error: e.message }, e.status);
    console.error(
      "AgentPass request failed",
      e instanceof Error ? e.name : "unknown",
    );
    return json(
      {
        error:
          "The request could not be completed. Check the server setup and try again.",
      },
      500,
    );
  }
}
export { handler as GET, handler as POST, handler as DELETE };
