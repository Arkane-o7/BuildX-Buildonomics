import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import type { Payment, Receipt, Workspace } from "./contracts";
import { AppError } from "./store";

export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
    .join(",")}}`;
}
export function receiptPublicKey() {
  if (!process.env.RECEIPT_PRIVATE_KEY)
    throw new AppError(503, "Receipt signing key has not been configured.");
  const key = createPrivateKey(
    process.env.RECEIPT_PRIVATE_KEY.replace(/\\n/g, "\n"),
  );
  return createPublicKey(key)
    .export({ type: "spki", format: "pem" })
    .toString();
}
export function issueReceipt(w: Workspace, p: Payment): Receipt {
  const id = `rcpt_${p.id}`;
  const payload = {
    version: 1,
    id,
    issuer: "AgentPass BuildX",
    agentId: w.agent.id,
    paymentId: p.id,
    requestId: p.requestId,
    service: p.serviceName,
    amountPaise: p.amount,
    currency: "INR",
    method: p.actualMethod || p.rail,
    mode: p.mode,
    status: p.status,
    policyVersion: p.policyVersion,
    bindingVersion: p.bindingVersion,
    providerOrderId: p.orderId || null,
    providerPaymentId: p.providerPaymentId || null,
    timestamp: p.updatedAt,
  };
  const publicKey = receiptPublicKey();
  const signature = sign(
    null,
    Buffer.from(canonical(payload)),
    process.env.RECEIPT_PRIVATE_KEY!.replace(/\\n/g, "\n"),
  ).toString("base64");
  return { id, payload, signature, publicKey, algorithm: "Ed25519" };
}
export function verifyReceipt(
  payload: unknown,
  signature: string,
  publicKey: string,
) {
  try {
    return verify(
      null,
      Buffer.from(canonical(payload)),
      publicKey,
      Buffer.from(signature, "base64"),
    );
  } catch {
    return false;
  }
}
