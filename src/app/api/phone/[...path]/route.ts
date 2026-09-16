import { randomUUID } from "node:crypto";
import { z } from "zod";
import { checkOrigin } from "@/lib/auth";
import { principal } from "@/lib/platform";
import { readAccount, updateAccount } from "@/lib/platform-store";
import { AppError } from "@/lib/store";
import { createPhoneRequest, decodePaymentQr, decidePhonePayment, openPhonePayment, phoneView } from "@/lib/phone-payments";
import { notifyPhones, pushConfigured, validatePushEndpoint } from "@/lib/phone-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
async function body(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new AppError(400, "Missing request body.");
  const chunks: Uint8Array[] = []; let length = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.length;
    if (length > 1600000) { await reader.cancel(); throw new AppError(413, "Request too large."); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new AppError(400, "Invalid JSON."); }
}
async function handler(req: Request) {
  try {
    if (process.env.EVENT_DISABLED === "true") throw new AppError(503, "AgentPass is offline.");
    const route = new URL(req.url).pathname.replace(/^\/api\/phone\//, "");
    const post = req.method === "POST";
    if (post && !req.headers.has("authorization")) checkOrigin(req);
    const auth = await principal(req, !["request", "status"].includes(route));
    if (!post && route === "config") return json({ publicKey: pushConfigured() ? process.env.PHONE_VAPID_PUBLIC_KEY : null });
    if (!post && route === "inbox") {
      const a = await readAccount(auth.accountId);
      return json({ owner: a.name, devices: a.phoneDevices?.length || 0, requests: (a.phoneRequests || []).map(r => phoneView(a, r)) });
    }
    if (!post && route === "status") {
      const a = await readAccount(auth.accountId);
      const intentId = new URL(req.url).searchParams.get("intentId");
      return json({ requests: (a.phoneRequests || []).filter(r => (!auth.agentId || r.agentId === auth.agentId) && (!intentId || r.intentId === intentId)).map(r => phoneView(a, r)), paymentConfirmed: false });
    }
    if (post && route === "subscribe") {
      const input = z.object({ endpoint: z.string().url().max(2000), keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{87,88}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/) }), expirationTime: z.number().nullable().optional() }).strict().parse(await body(req));
      validatePushEndpoint(input.endpoint);
      if (!pushConfigured()) throw new AppError(503, "Phone notifications are not configured yet.");
      return json(await updateAccount(auth.accountId, a => {
        const devices = a.phoneDevices ??= [];
        const found = devices.find(d => d.endpoint === input.endpoint);
        if (found) { found.keys = input.keys; return { id: found.id }; }
        if (devices.length >= 5) throw new AppError(429, "Five devices are already connected. Disconnect an old device first.");
        const device = { id: randomUUID(), endpoint: input.endpoint, keys: input.keys, createdAt: new Date().toISOString() };
        devices.push(device); return { id: device.id };
      }));
    }
    if (post && route === "unsubscribe") {
      const { endpoint } = z.object({ endpoint: z.string().max(2000) }).parse(await body(req));
      await updateAccount(auth.accountId, a => { a.phoneDevices = (a.phoneDevices || []).filter(d => d.endpoint !== endpoint); });
      return json({ ok: true });
    }
    if (post && route === "test") {
      const a = await readAccount(auth.accountId);
      // Reuse the existing account event timestamps as a per-owner notification throttle.
      if (a.events.some(e => e.type === "phone_test" && Date.now() - Date.parse(e.time) < 30000)) throw new AppError(429, "Wait 30 seconds before testing again.");
      await updateAccount(auth.accountId, state => {
        if (state.events.some(e => e.type === "phone_test" && Date.now() - Date.parse(e.time) < 30000)) throw new AppError(429, "Wait before testing again.");
        state.events.unshift({ id: randomUUID(), time: new Date().toISOString(), type: "phone_test", detail: "Owner requested a notification connection test. No payment." });
        state.events = state.events.slice(0, 300);
      });
      const result = await notifyPhones(a.phoneDevices || [], true);
      return json({ accepted: result.accepted, delivered: "unknown" });
    }
    if (post && route === "request") {
      const input = z.object({ intentId: z.string().uuid(), sourceUrl: z.string().url().max(2000), upiUri: z.string().max(8000).optional(), qrImageDataUrl: z.string().max(1500000).optional() }).strict().refine(v => !!v.upiUri !== !!v.qrImageDataUrl, "Provide either the merchant URI or its QR image.").parse(await body(req));
      const upiUri = input.upiUri || decodePaymentQr(input.qrImageDataUrl!);
      const result = await updateAccount(auth.accountId, a => createPhoneRequest(a, auth, { ...input, upiUri }));
      if (result.created) {
        const a = await readAccount(auth.accountId);
        const delivery = await notifyPhones(a.phoneDevices || []);
        await updateAccount(auth.accountId, state => {
          const saved = state.phoneRequests!.find(r => r.id === result.request.id)!;
          saved.delivery = delivery.accepted ? "accepted_by_push_service" : "inbox_only";
          state.phoneDevices = (state.phoneDevices || []).filter(d => !delivery.expired.includes(d.id));
        });
      }
      const a = await readAccount(auth.accountId);
      return json({ request: phoneView(a, a.phoneRequests!.find(r => r.id === result.request.id)!), phoneUrl: `${process.env.APP_URL || new URL(req.url).origin}/phone`, paymentConfirmed: false });
    }
    if (post && route === "open") {
      const { id } = z.object({ id: z.string().uuid() }).strict().parse(await body(req));
      return json(await updateAccount(auth.accountId, a => openPhonePayment(a, id)));
    }
    if (post && route === "decision") {
      const { id, decision } = z.object({ id: z.string().uuid(), decision: z.enum(["paid", "decline"]) }).strict().parse(await body(req));
      return json(await updateAccount(auth.accountId, a => decidePhonePayment(a, id, decision)));
    }
    throw new AppError(404, "Endpoint not found.");
  } catch (e) {
    if (e instanceof AppError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError) return json({ error: "Check the required request fields." }, 400);
    console.error("Phone request failed", e instanceof Error ? e.name : "unknown");
    return json({ error: "Could not complete the phone request. Check its status before retrying." }, 500);
  }
}
export { handler as GET, handler as POST };
