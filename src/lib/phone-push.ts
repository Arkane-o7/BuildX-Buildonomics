import webpush from "web-push";
import { AppError } from "./store";
import type { PhoneDevice } from "./platform-types";

export function pushConfigured() {
  return !!(process.env.PHONE_VAPID_PUBLIC_KEY && process.env.PHONE_VAPID_PRIVATE_KEY && process.env.APP_URL?.startsWith("https://"));
}
export function validatePushEndpoint(endpoint: string) {
  const u = new URL(endpoint);
  const allowed = u.hostname === "fcm.googleapis.com" || u.hostname === "web.push.apple.com" || u.hostname.endsWith(".push.apple.com") || u.hostname === "updates.push.services.mozilla.com";
  if (u.protocol !== "https:" || !allowed || u.username || u.password || u.port || u.hash) throw new AppError(400, "Unsupported browser push service.");
}
export async function notifyPhones(devices: PhoneDevice[], test = false) {
  if (!pushConfigured()) return { accepted: 0, expired: [] as string[] };
  const results = await Promise.all(devices.map(async d => {
    try {
      validatePushEndpoint(d.endpoint);
      await webpush.sendNotification({ endpoint: d.endpoint, keys: d.keys }, JSON.stringify({
        title: test ? "AgentPass is connected" : "AgentPass payment request",
        body: test ? "Your phone can receive payment requests. No payment was created." : "Open AgentPass to review your agent’s request.",
        url: "/phone", tag: test ? "agentpass-test" : "agentpass-payment",
      }), { TTL: 300, timeout: 6000, vapidDetails: {
        subject: process.env.APP_URL!, publicKey: process.env.PHONE_VAPID_PUBLIC_KEY!, privateKey: process.env.PHONE_VAPID_PRIVATE_KEY!,
      } });
      return { accepted: true, expired: "" };
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      return { accepted: false, expired: status === 410 || status === 404 ? d.id : "" };
    }
  }));
  return { accepted: results.filter(r => r.accepted).length, expired: results.map(r => r.expired).filter(Boolean) };
}
