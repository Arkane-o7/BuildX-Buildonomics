"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Bell, Check, Fingerprint, Smartphone, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./phone.module.css";

type RequestView = { id: string; agentName: string; merchant: string; item: string; payee: string; payeeName: string; amount: number; active: boolean; status: string; expiresAt: string; orderReference: string | null; delivery: string };
async function api(route: string, input?: unknown) {
  const response = await fetch("/api/" + route, { method: input === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
  const value = await response.json();
  if (!response.ok) throw Object.assign(new Error(value.error || "Could not load the request."), { status: response.status });
  return value;
}
export default function Phone() {
  const [owner, setOwner] = useState<string | null>(null), [requests, setRequests] = useState<RequestView[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [connected, setConnected] = useState(false), [supported, setSupported] = useState(false);
  const refresh = useCallback(async () => {
    try { const r = await api("phone/inbox"); setOwner(r.owner); setRequests(r.requests); }
    catch (e) { if ((e as { status?: number }).status === 401) setOwner(null); else setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 5000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => { setSupported("serviceWorker" in navigator && "PushManager" in window && "Notification" in window); }, []);
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    await action(async () => { await api("platform/login", { email: f.get("email"), password: f.get("password") }); await refresh(); });
  }
  async function connect() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Enable notifications in your browser settings, or keep this inbox open for new requests.");
    const config = await api("phone/config");
    if (!config.publicKey) throw new Error("Notifications are not configured on this deployment yet. Requests will still appear here.");
    await navigator.serviceWorker.register("/phone-sw.js", { scope: "/", updateViaCache: "none" });
    const registration = await navigator.serviceWorker.ready;
    const key = Uint8Array.from(atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await api("phone/subscribe", subscription.toJSON());
    setConnected(true); setNotice("This phone is connected. Send a test alert to verify delivery.");
  }
  async function disconnect() {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await api("phone/unsubscribe", { endpoint: sub.endpoint }); await sub.unsubscribe(); }
    setConnected(false); setNotice("Notifications disconnected on this device.");
  }
  async function openPayment(id: string) {
    const r = await api("phone/open", { id });
    setNotice("Complete approval in your UPI app, then return here. Opening the app does not confirm payment.");
    await refresh();
    window.location.href = r.upiUri;
  }
  return <main className={styles.shell}>
    <header className={styles.header}><a href="/" className={styles.brand}><Fingerprint size={30} />agentpass.</a><span>PHONE APPROVALS</span></header>
    <section className={styles.intro}><span className={styles.eyebrow}>YOUR AGENT. YOUR SAY.</span><h1>Review here.<br />Pay in your UPI app.</h1><p>Get your agent’s request on this phone. Check the payee and amount before you approve.</p></section>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {notice && <div className={styles.notice} role="status">{notice}</div>}
    {loading ? <p>Loading your payment inbox…</p> : !owner ? <section className={styles.card}>
      <h2>Connect your workspace</h2><p>Sign in with the same AgentPass account your Hermes agent uses.</p>
      <form onSubmit={login} className={styles.form}><label>Email<Input name="email" type="email" required autoComplete="username" /></label><label>Password<Input name="password" type="password" required autoComplete="current-password" /></label><Button type="submit" disabled={busy}>Sign in on this phone</Button></form>
      <p className={styles.small}>Need an account? <a href="/">Open your dashboard</a>.</p>
    </section> : <>
      <section className={styles.card}><div className={styles.row}><Smartphone /><div><h2>{owner}</h2><p>Your payment inbox</p></div></div>
        {supported ? <div className={styles.actions}><Button disabled={busy} onClick={() => void action(connect)}><Bell size={17} />{connected ? "Reconnect notifications" : "Enable phone notifications"}</Button><Button variant="outline" className={styles.secondary} disabled={busy} onClick={() => void action(async () => { const r = await api("phone/test", {}); setNotice(r.accepted ? "Test alert accepted by the push service. Check this phone’s notifications." : "No alert was accepted. Enable notifications on this phone and try again."); })}>Send test alert</Button>{connected && <Button variant="ghost" className={styles.textButton} disabled={busy} onClick={() => void action(disconnect)}>Disconnect this phone</Button>}</div> : <p>Keep this page open to receive requests. For notifications on iPhone, add AgentPass to your Home Screen and open it from there.</p>}
        <p className={styles.small}>Android: use Chrome and allow notifications. This connects AgentPass alerts, not your bank account.</p>
      </section>
      <div className={styles.sectionLabel}><h2>Payment requests</h2><span>Updates every 5 seconds</span></div>
      {!requests.length && <section className={styles.empty}><Check size={28} /><h3>You’re ready for a request</h3><p>Ask Hermes to send the merchant’s current UPI request to your phone.</p></section>}
      {requests.map(r => <section key={r.id} className={styles.card}>
        <div className={styles.requestTop}><span>{r.agentName} → {r.merchant}</span><span className={styles.badge}>{r.status === "pending" && !r.active ? "Expired / invalid" : r.status.replaceAll("_", " ")}</span></div>
        <h2 className={styles.item}>{r.item}</h2><div className={styles.amount}>₹{(r.amount / 100).toFixed(2)}</div>
        <dl className={styles.details}><dt>Payee in merchant QR</dt><dd>{r.payeeName}</dd><dt>Payee UPI ID</dt><dd>{r.payee}</dd><dt>Request expires</dt><dd>{new Date(r.expiresAt).toLocaleTimeString()}</dd></dl>
        <p className={styles.small}>Provided by your agent from the merchant checkout. Verify these details in your UPI app; AgentPass has not independently verified the payee.</p>
        {r.status === "pending" && r.active && <div className={styles.actions}><Button disabled={busy} onClick={() => void action(() => openPayment(r.id))}>Open UPI app to pay <ArrowUpRight size={18} /></Button><Button variant="outline" className={styles.secondary} disabled={busy} onClick={() => void action(async () => { await api("phone/decision", { id: r.id, decision: "decline" }); await refresh(); })}>Decline request</Button></div>}
        {r.status === "opened" && <><p>Check the result in your UPI app. Don’t pay again if the status is uncertain.</p><Button disabled={busy} onClick={() => void action(async () => { await api("phone/decision", { id: r.id, decision: "paid" }); await refresh(); setNotice("Hermes can now see your report. It must check the merchant’s confirmation."); })}>I approved payment in my UPI app</Button><p className={styles.small}>If the app did not open, return to the merchant checkout. This browser may not support this merchant’s UPI link.</p></>}
        {r.status === "user_reported_paid" && <p className={styles.notice}>You reported payment approval. Merchant confirmation is still required.</p>}
        {r.orderReference && <p>Merchant order reported: <strong>{r.orderReference}</strong>. This is not independently verified settlement.</p>}
      </section>)}
      <a className={styles.dashboard} href="/">Back to dashboard →</a>
    </>}
    <footer className={styles.footer}>Your UPI PIN stays in your payment app. AgentPass never asks for it.</footer>
  </main>;
}
