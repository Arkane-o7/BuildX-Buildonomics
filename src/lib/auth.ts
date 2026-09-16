import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "./store";

export type Auth = {
  role: "owner" | "demo" | "agent" | "viewer";
  workspace: string;
};
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const same = (a: string, b: string) =>
  timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32)
    throw new AppError(503, "Server session key has not been configured.");
  return value;
}
export function signToken(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}
export function sessionCookie(role: "owner" | "demo", workspace: string) {
  const data = Buffer.from(
    JSON.stringify({ role, workspace, exp: Date.now() + 86400000 }),
  ).toString("base64url");
  return `agentpass_session=${data}.${signToken(data)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${process.env.VERCEL ? "; Secure" : ""}`;
}
export function authenticate(req: Request): Auth {
  if (process.env.EVENT_DISABLED === "true")
    throw new AppError(503, "This event has ended. AgentPass is offline.");
  const bearer = req.headers.get("authorization");
  if (bearer) {
    const token = process.env.AGENTPASS_AGENT_TOKEN;
    if (token && token.length >= 24 && same(bearer, `Bearer ${token}`))
      return { role: "agent", workspace: "owner" };
    throw new AppError(401, "Agent token is invalid.");
  }
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("agentpass_session="))
    ?.slice("agentpass_session=".length);
  if (cookie) {
    try {
      const [data, signature] = cookie.split(".");
      if (data && signature && same(signature, signToken(data))) {
        const parsed = JSON.parse(Buffer.from(data, "base64url").toString());
        if (
          parsed.exp > Date.now() &&
          ["owner", "demo"].includes(parsed.role) &&
          typeof parsed.workspace === "string" &&
          (parsed.role !== "owner" || parsed.workspace === "owner")
        )
          return { role: parsed.role, workspace: parsed.workspace };
      }
    } catch {
      /* Invalid sessions become a public viewer. */
    }
  }
  return { role: "viewer", workspace: "owner" };
}
export function requireWrite(req: Request, ownerOnly = false): Auth {
  const auth = authenticate(req);
  if (auth.role === "viewer" || (ownerOnly && auth.role === "agent"))
    throw new AppError(403, "Owner access is required for this action.");
  if (auth.role !== "agent") checkOrigin(req);
  return auth;
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin)
    throw new AppError(403, "Request origin could not be verified.");
}
export function checkoutToken(workspace: string, payment: string) {
  return signToken(`checkout:${workspace}:${payment}`);
}
export function requireCheckout(
  workspace: string,
  payment: string,
  token: string,
) {
  if (process.env.EVENT_DISABLED === "true")
    throw new AppError(503, "This event has ended.");
  if (!token || !same(token, checkoutToken(workspace, payment)))
    throw new AppError(403, "Checkout link is invalid.");
}
export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
export const checkoutUrl = (workspace: string, id: string) =>
  `${appUrl()}/checkout/${id}?workspace=${encodeURIComponent(workspace)}&token=${checkoutToken(workspace, id)}`;
