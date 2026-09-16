import { randomUUID } from "node:crypto";
import {
  SERVICES,
  money,
  type Payment,
  type Rail,
  type Workspace,
  type Snapshot,
} from "./contracts";
import { AppError, event, mutate, readWorkspace, databaseKind } from "./store";
import { checkoutUrl, type Auth } from "./auth";
import { issueReceipt, receiptPublicKey } from "./receipts";
import {
  paymentMode,
  providerReady,
  razorpay,
  type ProviderPayment,
} from "./provider";

export function evaluate(
  w: Workspace,
  serviceId: string,
  amount: number,
): string | null {
  if (w.agent.status !== "active") return "Agent authority has been revoked.";
  if (!w.agent.allowedServices.includes(serviceId))
    return "This merchant is not on the approved list.";
  if (!Number.isSafeInteger(amount) || amount < 1)
    return "Payment amount is invalid.";
  if (amount > w.agent.perTransaction)
    return `Exceeds the ${money(w.agent.perTransaction)} per-purchase limit.`;
  if (w.agent.spent + w.agent.reserved + amount > w.agent.budget)
    return "Insufficient remaining budget. Pending checkouts also count.";
  return null;
}
export async function snapshot(auth: Auth): Promise<Snapshot> {
  const w = await readWorkspace(auth.workspace);
  return {
    agent: w.agent,
    payments: w.payments.map((p) => {
      const { checkoutTokenHash, ...publicPayment } = p;
      void checkoutTokenHash;
      return publicPayment;
    }),
    events: w.events,
    services: SERVICES,
    mode: paymentMode(w.demo),
    role: auth.role === "agent" ? "viewer" : auth.role,
    providerReady: providerReady(),
    storage: databaseKind(),
  };
}
export async function purchase(
  auth: Auth,
  input: { serviceId: string; requestId: string; rail: Rail },
) {
  const service = SERVICES.find((s) => s.id === input.serviceId);
  if (!service) throw new AppError(400, "Unknown service.");
  receiptPublicKey(); // Fail before reserving if evidence cannot be signed.
  const admission = await mutate(auth.workspace, (w) => {
    const previous = w.payments.find((p) => p.requestId === input.requestId);
    if (previous) {
      if (
        previous.serviceId !== input.serviceId ||
        previous.rail !== input.rail
      )
        throw new AppError(
          409,
          "This request ID already belongs to a different purchase.",
        );
      return { payment: structuredClone(previous), fresh: false };
    }
    if (w.payments.length >= 200)
      throw new AppError(
        429,
        "This event session has reached its request limit.",
      );
    const mode = paymentMode(w.demo),
      reason = evaluate(w, service.id, service.amount);
    if (!reason && mode !== "rehearsal" && !providerReady())
      throw new AppError(
        503,
        "Payment setup is incomplete. Add matching Razorpay API keys.",
      );
    const now = new Date().toISOString();
    if (auth.role === "agent") w.agent.lastSeen = now;
    const payment: Payment = {
      id: randomUUID(),
      requestId: input.requestId,
      serviceId: service.id,
      serviceName: service.name,
      amount: service.amount,
      currency: "INR",
      rail: input.rail,
      source: auth.role === "agent" ? "Hermes" : "Dashboard",
      status: reason
        ? "blocked"
        : mode === "rehearsal"
          ? "awaiting_checkout"
          : "creating_order",
      reason: reason || "Within policy. Waiting for payer confirmation.",
      policyVersion: w.agent.policyVersion,
      bindingVersion: w.agent.bindingVersion,
      fundingLabel: w.agent.fundingLabel,
      mode,
      createdAt: now,
      updatedAt: now,
    };
    if (!reason) w.agent.reserved += payment.amount;
    w.payments.unshift(payment);
    event(
      w,
      reason ? "blocked" : "authorized",
      reason ? "Purchase blocked" : "Purchase authorized",
      `${service.name} · ${money(service.amount)}. ${payment.reason}`,
      payment.source,
      payment.id,
    );
    return { payment: structuredClone(payment), fresh: true };
  });
  let p = admission.payment;
  if (admission.fresh && p.status === "creating_order") {
    try {
      const order = await razorpay<{
        id: string;
        amount: number;
        currency: string;
      }>("orders", {
        amount: p.amount,
        currency: "INR",
        receipt: p.id,
        notes: { agentpass_workspace: auth.workspace, agentpass_payment: p.id },
      });
      if (!order.id || order.amount !== p.amount || order.currency !== "INR")
        throw new AppError(502, "Provider returned an unexpected order.");
      p = await mutate(auth.workspace, (w) => {
        const current = w.payments.find((x) => x.id === p.id)!;
        current.orderId = order.id;
        current.status = "awaiting_checkout";
        current.updatedAt = new Date().toISOString();
        event(
          w,
          "checkout",
          "Checkout ready",
          "UPI or card confirmation is required from the payer.",
          "Razorpay",
          p.id,
        );
        return structuredClone(current);
      });
    } catch {
      p = await mutate(auth.workspace, (w) => {
        const current = w.payments.find((x) => x.id === p.id)!;
        current.status = "unknown";
        current.reason =
          "Order creation could not be confirmed. Budget remains reserved; do not retry with a new request ID.";
        event(
          w,
          "unknown",
          "Provider confirmation pending",
          current.reason,
          "Razorpay",
          p.id,
        );
        return structuredClone(current);
      });
    }
  }
  return {
    payment: p,
    checkoutUrl:
      p.status === "awaiting_checkout"
        ? checkoutUrl(auth.workspace, p.id)
        : null,
    reused: !admission.fresh,
  };
}
const results: Record<string, string> = {
  research:
    "Demo research brief: Evaluate a paid API using coverage, freshness, latency, licensing and cost per successful response. Start with a small budget, measure outcomes, and expand only after the service meets your requirements.",
  market:
    "Demo competitor brief: Compare agent payment platforms on identity, supported payment methods, owner controls, audit evidence and integration effort. A wallet address alone does not establish business authority.",
  premium:
    "Demo industry report: This premium sample is available only after the owner raises the hard transaction ceiling and the payment completes.",
  unapproved: "Demo vendor response.",
};
export function finalize(
  w: Workspace,
  id: string,
  verified?: ProviderPayment,
  failure = false,
) {
  const p = w.payments.find((x) => x.id === id);
  if (!p) throw new AppError(404, "Payment not found.");
  if (p.status === "paid" || p.status === "failed") return structuredClone(p);
  if (p.status === "blocked")
    throw new AppError(409, "Blocked requests cannot be paid.");
  if (p.mode !== "rehearsal") {
    if (
      !verified ||
      verified.order_id !== p.orderId ||
      verified.amount !== p.amount ||
      verified.currency !== "INR" ||
      !verified.captured ||
      verified.status !== "captured"
    )
      throw new AppError(
        409,
        "Payment has not been independently confirmed as captured.",
      );
    if (
      w.payments.some(
        (x) => x.providerPaymentId === verified.id && x.id !== p.id,
      )
    )
      throw new AppError(409, "Provider payment was already used.");
  }
  p.status = failure ? "failed" : "paid";
  p.updatedAt = new Date().toISOString();
  p.reason = failure
    ? "Rehearsal checkout declined. Reservation released."
    : p.mode === "rehearsal"
      ? "Rehearsal completed. No money moved."
      : p.mode === "razorpay_live"
        ? "Live Razorpay payment captured."
        : "Razorpay test payment captured. No real money moved.";
  w.agent.reserved -= p.amount;
  if (w.agent.reserved < 0) throw new AppError(500, "Budget invariant failed.");
  if (!failure) {
    w.agent.spent += p.amount;
    if (verified) {
      p.providerPaymentId = verified.id;
      p.actualMethod = verified.method;
    }
    p.result = results[p.serviceId];
    const receipt = issueReceipt(w, p);
    p.receiptId = receipt.id;
    w.receipts.unshift(receipt);
  }
  event(
    w,
    failure ? "failed" : "paid",
    failure
      ? "Checkout declined"
      : p.mode === "rehearsal"
        ? "Rehearsal purchase completed"
        : p.mode === "razorpay_live"
          ? "Live payment captured"
          : "Test payment captured",
    `${p.serviceName} · ${money(p.amount)}. ${p.reason}`,
    p.mode === "rehearsal" ? "Rehearsal" : "Razorpay",
    p.id,
  );
  return structuredClone(p);
}
export async function verifyProviderPayment(
  workspace: string,
  id: string,
  providerPaymentId: string,
) {
  const w = await readWorkspace(workspace),
    p = w.payments.find((x) => x.id === id);
  if (!p || p.mode === "rehearsal")
    throw new AppError(400, "Provider payment is not expected.");
  if (p.mode !== paymentMode())
    throw new AppError(
      409,
      "This order belongs to a different payment environment. Restore its matching provider configuration before reconciling.",
    );
  const result = await razorpay<ProviderPayment>(
    `payments/${encodeURIComponent(providerPaymentId)}`,
  );
  return mutate(workspace, (state) => finalize(state, id, result));
}

export async function reconcilePayment(workspace: string, id: string) {
  let w = await readWorkspace(workspace),
    p = w.payments.find((x) => x.id === id);
  if (!p || p.mode === "rehearsal")
    throw new AppError(400, "Only provider payments require reconciliation.");
  if (p.mode !== paymentMode())
    throw new AppError(
      409,
      "Restore the matching test/live configuration for this order.",
    );
  if (p.status === "paid" || p.status === "blocked" || p.status === "failed")
    return p;
  if (!p.orderId) {
    // Recover an order accepted by Razorpay when the create response was lost.
    const from = Math.floor(new Date(p.createdAt).getTime() / 1000) - 60;
    const orders = await razorpay<{
      items: Array<{
        id: string;
        receipt: string;
        amount: number;
        currency: string;
        notes?: Record<string, string>;
      }>;
    }>(`orders?from=${from}&count=100`);
    const order = orders.items.find(
      (o) =>
        o.receipt === p!.id &&
        o.amount === p!.amount &&
        o.currency === "INR" &&
        o.notes?.agentpass_workspace === workspace,
    );
    if (!order)
      throw new AppError(
        409,
        "No matching order found among the first 100 provider orders in this time window. Funds stay reserved; inspect the merchant dashboard before creating any replacement.",
      );
    const paymentId = p.id;
    await mutate(workspace, (state) => {
      const current = state.payments.find((x) => x.id === paymentId)!;
      if (current.status !== "paid") {
        current.orderId = order.id;
        current.status = "awaiting_checkout";
        current.updatedAt = new Date().toISOString();
        event(
          state,
          "checkout",
          "Provider order recovered",
          "Original request retained. No new order created.",
          "Razorpay",
          paymentId,
        );
      }
    });
    w = await readWorkspace(workspace);
    p = w.payments.find((x) => x.id === paymentId)!;
  }
  const result = await razorpay<{ items: ProviderPayment[] }>(
    `orders/${encodeURIComponent(p.orderId!)}/payments`,
  );
  const captured = result.items.find(
    (x) => x.captured && x.status === "captured",
  );
  if (captured) return verifyProviderPayment(workspace, p.id, captured.id);
  return p;
}
