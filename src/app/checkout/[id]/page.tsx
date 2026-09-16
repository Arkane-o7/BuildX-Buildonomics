"use client";
import { use, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CreditCard,
  Fingerprint,
  LoaderCircle,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { money, type Payment, type Receipt } from "@/lib/contracts";
type Checkout = {
  payment: Payment;
  agent: { name: string; status: string };
  keyId: string | null;
  receipt: Receipt | null;
};
type RazorpayResult = {
  razorpay_payment_id: string;
  razorpay_signature: string;
};
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open(): void;
      on(event: string, handler: () => void): void;
    };
  }
}
export default function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params),
    [data, setData] = useState<Checkout | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [access, setAccess] = useState<{ workspace: string; token: string } | null>(
      null,
    );
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setAccess({
      workspace: q.get("workspace") || "",
      token: q.get("token") || "",
    });
  }, []);
  const refresh = useCallback(async () => {
    if (!access) return;
    const r = await fetch(`/api/checkout/${id}?${new URLSearchParams(access)}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setData(d);
  }, [id, access]);
  useEffect(() => {
    if (data && ["paid", "failed", "blocked"].includes(data.payment.status))
      return;
    void refresh().catch((e) => setError(e.message));
    const timer = setInterval(() => void refresh().catch(() => {}), 4000);
    return () => clearInterval(timer);
  }, [refresh, data?.payment.status]);
  async function post(path: string, extra: Record<string, unknown>) {
    const r = await fetch(`/api/checkout/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...access, ...extra }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    await refresh();
    return d;
  }
  async function simulate(outcome: string) {
    setBusy(true);
    setError("");
    try {
      await post("simulate", { outcome });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function pay() {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      if (!window.Razorpay)
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => {
            script.remove();
            reject(
              new Error(
                "Checkout could not load. Check your connection and try again.",
              ),
            );
          };
          document.head.appendChild(script);
        });
      if (!window.Razorpay) throw new Error("Checkout is unavailable.");
      const checkout = new window.Razorpay({
        key: data.keyId,
        order_id: data.payment.orderId,
        amount: data.payment.amount,
        currency: "INR",
        name: "AgentPass",
        description: data.payment.serviceName,
        notes: {
          agentpass_workspace: access?.workspace,
          agentpass_payment: id,
        },
        config: {
          display: {
            blocks: {
              preferred: {
                name:
                  data.payment.rail === "upi"
                    ? "Pay with UPI"
                    : "Pay with card",
                instruments: [{ method: data.payment.rail }],
              },
            },
            sequence: ["block.preferred"],
            preferences: { show_default_blocks: false },
          },
        },
        theme: { color: "#545dd4" },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (result: RazorpayResult) => {
          try {
            await post("verify", {
              paymentId: result.razorpay_payment_id,
              signature: result.razorpay_signature,
            });
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        },
      });
      checkout.on("payment.failed", () => {
        setError(
          "Payment attempt failed. You can retry this same order; its reservation remains in place.",
        );
        setBusy(false);
      });
      checkout.open();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  const p = data?.payment;
  return (
    <main className="checkout-shell">
      <a href="/" className="brand">
        <span className="brand-mark">
          <Fingerprint size={25} />
        </span>
        agentpass<span className="brand-period">.</span>
      </a>
      <section className="checkout-card">
        {!p ? (
          <>
            <LoaderCircle className="spin" />
            <h1>Opening your checkout</h1>
          </>
        ) : (
          <>
            <span
              className={`mode-chip ${p.mode === "razorpay_live" ? "live" : ""}`}
            >
              <span className="dot" />
              {p.mode === "rehearsal"
                ? "Rehearsal · no money moves"
                : p.mode === "razorpay_test"
                  ? "Razorpay test · no real money"
                  : "Live payment · real money"}
            </span>
            <h1>
              {p.status === "paid"
                ? "Purchase completed"
                : p.status === "failed"
                  ? "Checkout declined"
                  : "A purchase needs your approval"}
            </h1>
            <p>
              {data.agent.name} requested <strong>{p.serviceName}</strong>.{" "}
              {p.mode === "rehearsal"
                ? "This is a simulated purchase of sample content."
                : "Payment is collected by the connected Razorpay merchant for this sample service."}
            </p>
            <div className="checkout-amount">{money(p.amount)}</div>
            <dl className="receipt-details">
              <dt>Payment method</dt>
              <dd>{(p.actualMethod || p.rail).toUpperCase()}</dd>
              <dt>Spending policy</dt>
              <dd>Approved under v{p.policyVersion}</dd>
              <dt>Funding reference</dt>
              <dd>{p.fundingLabel}</dd>
            </dl>
            {p.status === "paid" ? (
              <>
                <div className="alert success">
                  <Check size={18} />
                  {p.reason}
                </div>
                {p.result && <div className="service-result">{p.result}</div>}
                {data.receipt && (
                  <button
                    className="button secondary"
                    onClick={() => {
                      const blob = new Blob(
                        [JSON.stringify(data.receipt, null, 2)],
                        { type: "application/json" },
                      );
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${data.receipt!.id}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <ShieldCheck size={16} />
                    Download signed receipt
                  </button>
                )}
              </>
            ) : p.status === "awaiting_checkout" ? (
              p.mode === "rehearsal" ? (
                <>
                  <p>
                    No bank or card will be charged. Choose an outcome to
                    exercise the policy, ledger and receipt flow.
                  </p>
                  <div className="form-row">
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => simulate("failure")}
                    >
                      Simulate decline
                    </button>
                    <button
                      className="button primary"
                      disabled={busy || data.agent.status !== "active"}
                      onClick={() => simulate("success")}
                    >
                      Simulate success
                      <Check size={15} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    Continue to Razorpay to confirm using your{" "}
                    {p.rail === "upi" ? "UPI app or QR code" : "card"}.
                    AgentPass never receives your PIN or card details.
                  </p>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={pay}
                  >
                    {busy ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : p.rail === "upi" ? (
                      <Zap size={16} />
                    ) : (
                      <CreditCard size={16} />
                    )}{" "}
                    {p.mode === "razorpay_live"
                      ? `Pay ${money(p.amount)}`
                      : "Open test checkout"}
                  </button>
                </>
              )
            ) : (
              <div className="alert warning">{p.reason}</div>
            )}
          </>
        )}
        {error && (
          <div role="alert" className="alert error">
            {error}
          </div>
        )}
        <footer>
          <a href="/">
            <ArrowLeft size={12} /> Back to the control room
          </a>
        </footer>
      </section>
    </main>
  );
}
