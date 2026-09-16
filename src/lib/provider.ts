import { createHmac } from "node:crypto";
import { same } from "./auth";
import { AppError } from "./store";
import type { Mode } from "./contracts";

export function paymentMode(demo = false): Mode {
  return !demo &&
    ["razorpay_test", "razorpay_live"].includes(process.env.PAYMENT_MODE || "")
    ? (process.env.PAYMENT_MODE as Mode)
    : "rehearsal";
}
export function providerReady() {
  return Boolean(
    process.env.RAZORPAY_KEY_ID?.startsWith(
      paymentMode() === "razorpay_live" ? "rzp_live_" : "rzp_test_",
    ) && process.env.RAZORPAY_KEY_SECRET,
  );
}
export async function razorpay<T>(path: string, body?: unknown): Promise<T> {
  if (!providerReady())
    throw new AppError(
      503,
      "Add matching Razorpay API keys to enable UPI and card checkout.",
    );
  let response: Response;
  try {
    response = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
  } catch {
    throw new AppError(
      502,
      "Payment provider did not respond. The request is retained for reconciliation.",
    );
  }
  const result = await response.json();
  if (!response.ok)
    throw new AppError(
      502,
      "Payment provider rejected the request. Check the merchant account configuration.",
    );
  return result as T;
}
export function checkoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
) {
  if (!process.env.RAZORPAY_KEY_SECRET) return false;
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return same(expected, signature);
}
export function webhookSignature(raw: string, signature: string) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return false;
  return same(
    createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(raw)
      .digest("hex"),
    signature,
  );
}
export interface ProviderPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  captured: boolean;
}
