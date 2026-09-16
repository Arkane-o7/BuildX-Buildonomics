"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CreditCard,
  Fingerprint,
  Globe,
  KeyRound,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Radio,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import {
  money,
  type Payment,
  type Rail,
  type Receipt,
  type Snapshot,
} from "@/lib/contracts";
async function api(path: string, data?: unknown, method?: string) {
  const r = await fetch(`/api/${path}`, {
    method: method || (data === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || "Request failed.");
  return result;
}
const modeLabel = (m: string) =>
  m === "razorpay_live"
    ? "Live payments"
    : m === "razorpay_test"
      ? "Razorpay test"
      : "Rehearsal · no money moves";
const statusLabel = (s: string) =>
  ({
    awaiting_checkout: "Payer confirmation",
    creating_order: "Preparing checkout",
    unknown: "Needs reconciliation",
    paid: "Completed",
    blocked: "Blocked",
    failed: "Declined",
  })[s] || s;
export default function Home() {
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState("");
  const [rail, setRail] = useState<Rail>("upi"),
    [modal, setModal] = useState<
      "login" | "policy" | "connect" | "receipt" | null
    >(null),
    [code, setCode] = useState("");
  const [selected, setSelected] = useState<{
      payment: Payment;
      checkoutUrl?: string;
      receipt?: Receipt;
    } | null>(null),
    [verified, setVerified] = useState<boolean | null>(null),
    [tab, setTab] = useState("Overview");
  const intents = useRef(new Map<string, string>());
  const refresh = useCallback(async () => {
    try {
      setData(await api("snapshot"));
      setLoadError("");
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const i = setInterval(() => void refresh(), 5000);
    return () => clearInterval(i);
  }, [refresh]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  async function action(name: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(name);
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const writable = data?.role === "owner" || data?.role === "demo",
    a = data?.agent;
  async function buy(serviceId: string) {
    await action(serviceId, async () => {
      const key = `${data?.agent.id}:${serviceId}:${rail}`;
      const pending = data?.payments.find(
        (p) =>
          p.serviceId === serviceId &&
          p.rail === rail &&
          p.source === "Dashboard" &&
          ["awaiting_checkout", "creating_order", "unknown"].includes(p.status),
      );
      let requestId = pending?.requestId || intents.current.get(key);
      if (!requestId) requestId = crypto.randomUUID();
      intents.current.set(key, requestId);
      const r = await api("payments", { serviceId, rail, requestId });
      intents.current.delete(key);
      setSelected(r);
      setNotice(r.payment.reason);
    });
  }
  async function detail(p: Payment) {
    await action(p.id, async () => {
      setVerified(null);
      setSelected(
        writable
          ? await api(`payments/${p.id}`)
          : p.receiptId
            ? { payment: p, ...(await api(`receipts/${p.receiptId}`)) }
            : { payment: p },
      );
      setModal("receipt");
    });
  }
  async function policy(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    await action("policy", async () => {
      await api("policy", {
        name: v.get("name"),
        budget: Math.round(Number(v.get("budget")) * 100),
        perTransaction: Math.round(Number(v.get("cap")) * 100),
        allowedServices: v.getAll("services"),
      });
      setModal(null);
      setNotice("Spending policy updated.");
    });
  }
  function download() {
    if (!selected?.receipt) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(selected.receipt, null, 2)], {
        type: "application/json",
      }),
    );
    const l = document.createElement("a");
    l.href = url;
    l.download = `${selected.receipt.id}.json`;
    l.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Fingerprint size={25} />
          </span>
          agentpass<span className="brand-period">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">B</span>
          <div>
            <strong>BuildX Labs</strong>
            <small>Agent workspace</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav>
          {[
            { name: "Overview", icon: LayoutDashboard },
            { name: "Purchases", icon: Wallet },
            { name: "Activity", icon: Activity },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${tab === name ? "active" : ""}`}
              title={name}
              onClick={() => {
                setTab(name);
                if (name !== "Overview")
                  document
                    .getElementById(name.toLowerCase())
                    ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Icon size={18} />
              {name}
              {name === "Purchases" && (
                <small>{data?.payments.length || 0}</small>
              )}
            </button>
          ))}
          <button
            className="nav-item"
            title="Spending policy"
            disabled={!writable}
            onClick={() => setModal("policy")}
          >
            <SlidersHorizontal size={18} />
            Spending policy
          </button>
          <button
            className="nav-item"
            title="Connect Hermes"
            onClick={() => setModal("connect")}
          >
            <Terminal size={18} />
            Connect Hermes
            <ArrowUpRight size={13} />
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="side-note">
            <ShieldCheck size={20} />
            <strong>
              Give agents permission.
              <br />
              Keep owners in control.
            </strong>
            <p>Every purchase has a policy, a payer, and a record.</p>
          </div>
          <a
            className="nav-item"
            href="https://github.com/Arkane-o7/BuildX-Buildonomics"
            target="_blank"
            rel="noreferrer"
          >
            <Link2 size={18} />
            Project & setup
            <ArrowUpRight size={14} />
          </a>
          <div className="profile">
            <span>BX</span>
            <div>
              <strong>
                {data?.role === "owner"
                  ? "Workspace owner"
                  : data?.role === "demo"
                    ? "Your rehearsal"
                    : "Public showcase"}
              </strong>
              <small>
                {writable ? "Owner controls enabled" : "Read-only access"}
              </small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            Workspace
            <ChevronRight size={13} />
            <strong>{tab}</strong>
          </div>
          <div className="top-actions">
            <span
              className={`mode-chip ${data?.mode === "razorpay_live" ? "live" : ""}`}
            >
              <span className="dot" />
              {data ? modeLabel(data.mode) : "Connecting"}
            </span>
            {writable ? (
              <button
                className="text-button"
                onClick={() =>
                  action("logout", async () => {
                    await api("session", undefined, "DELETE");
                    setSelected(null);
                  })
                }
              >
                Leave {data?.role === "demo" ? "rehearsal" : "owner view"}
              </button>
            ) : (
              <button className="text-button" onClick={() => setModal("login")}>
                <KeyRound size={14} />
                Owner access
              </button>
            )}
          </div>
        </header>
        <main className="dashboard">
          <div className="page-heading">
            <div>
              <div className="eyebrow">THE AGENT CONTROL ROOM</div>
              <h1>Permission to move forward.</h1>
              <p>
                One identity. Clear spending limits. Every action accounted for.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => setModal("connect")}
            >
              <Link2 size={16} />
              Connect agent
            </button>
          </div>
          {(error || loadError) && (
            <div role="alert" className="alert error">
              {error || loadError}
              <button onClick={() => void refresh()}>Retry</button>
            </div>
          )}
          {data?.role === "viewer" && (
            <div className="showcase-banner">
              <div>
                <Sparkles size={19} />
                <span>
                  <strong>Explore AgentPass.</strong> Try the complete flow in
                  your own rehearsal workspace.
                </span>
              </div>
              <button
                disabled={!!busy}
                onClick={() =>
                  action("demo", async () => {
                    await api("demo", {});
                    setSelected(null);
                  })
                }
              >
                Try interactive demo
                <ArrowRight size={16} />
              </button>
            </div>
          )}
          {data?.role === "demo" && (
            <div className="showcase-banner">
              <div>
                <Sparkles size={19} />
                <span>
                  <strong>Your private rehearsal.</strong> Purchases are
                  simulated. The live workspace is separate.
                </span>
              </div>
            </div>
          )}
          {!data || !a ? (
            <div className="loading-state">
              <LoaderCircle className="spin" />
              <h2>Connecting to your workspace</h2>
              <p>Loading identity, spending policy and activity.</p>
            </div>
          ) : (
            <>
              <div className="summary-grid">
                <section className="passport-card">
                  <div className="card-top">
                    <span className="eyebrow">AGENT PASSPORT</span>
                    <span className={`status ${a.status}`}>
                      <span className="dot" />
                      {a.status === "active"
                        ? "Authority active"
                        : "Authority revoked"}
                    </span>
                  </div>
                  <div className="agent-identity">
                    <div className="agent-avatar">
                      <span />
                      <span />
                      <div />
                    </div>
                    <div>
                      <h2>
                        {a.name}
                        <span>01</span>
                      </h2>
                      <p>{a.description}</p>
                    </div>
                  </div>
                  <div className="passport-fields">
                    <div>
                      <small>IDENTITY</small>
                      <strong className="mono">{a.id}</strong>
                    </div>
                    <div>
                      <small>RUNTIME</small>
                      <strong>
                        <Terminal size={14} />
                        Hermes
                      </strong>
                    </div>
                    <div>
                      <small>ISSUED BY</small>
                      <strong>{a.owner}</strong>
                    </div>
                  </div>
                  <div className="passport-footer">
                    <Fingerprint size={17} />
                    <span>
                      Owner-attested identity · funding reference v
                      {a.bindingVersion}
                    </span>
                    <ShieldCheck size={16} />
                  </div>
                </section>
                <section className="budget-card">
                  <div className="card-top">
                    <span className="section-label">Spending allowance</span>
                    <Wallet size={18} />
                  </div>
                  <div className="budget-number">
                    {money(a.budget - a.spent - a.reserved)}
                    <span>available</span>
                  </div>
                  <div className="budget-track">
                    <span
                      style={{
                        width: `${Math.min(100, (a.spent / a.budget) * 100)}%`,
                      }}
                    />
                    <i
                      style={{
                        width: `${Math.min(100, (a.reserved / a.budget) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="budget-legend">
                    <span>
                      <i />
                      {money(a.spent)} spent
                    </span>
                    <span>
                      <i />
                      {money(a.reserved)} reserved
                    </span>
                  </div>
                  <div className="budget-bottom">
                    <span>{money(a.budget)} total allowance</span>
                    <button
                      disabled={!writable}
                      onClick={() => setModal("policy")}
                    >
                      Edit limits
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </section>
              </div>
              <div className="control-strip">
                <div>
                  <ShieldCheck size={18} />
                  <span>
                    <small>Per purchase</small>
                    <strong>{money(a.perTransaction)} limit</strong>
                  </span>
                </div>
                <div>
                  <Check size={18} />
                  <span>
                    <small>Approved services</small>
                    <strong>{a.allowedServices.length} allowed</strong>
                  </span>
                </div>
                <div>
                  <CreditCard size={18} />
                  <span>
                    <small>Payment methods</small>
                    <strong>UPI & credit cards</strong>
                  </span>
                </div>
                <div>
                  <Radio size={18} />
                  <span>
                    <small>Hermes connection</small>
                    <strong>
                      {a.lastSeen
                        ? `Seen ${new Date(a.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : "Not connected yet"}
                    </strong>
                  </span>
                </div>
              </div>
              <div className="content-grid">
                <div className="primary-column">
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Put your agent to work</h2>
                        <p>
                          Request a service. Check the policy. Confirm the
                          payment.
                        </p>
                      </div>
                      <div className="rail-picker" aria-label="Payment method">
                        <button
                          className={rail === "upi" ? "selected" : ""}
                          onClick={() => setRail("upi")}
                        >
                          <Zap size={13} />
                          UPI
                        </button>
                        <button
                          className={rail === "card" ? "selected" : ""}
                          onClick={() => setRail("card")}
                        >
                          <CreditCard size={13} />
                          Card
                        </button>
                      </div>
                    </div>
                    <div className="service-grid">
                      {data.services.map((s, i) => (
                        <article className="service-card" key={s.id}>
                          <div className="service-card-top">
                            <span className={`service-icon service-${i}`}>
                              {i === 0 ? (
                                <Sparkles size={20} />
                              ) : i === 1 ? (
                                <Globe size={20} />
                              ) : i === 2 ? (
                                <ArrowUpRight size={20} />
                              ) : (
                                <LockKeyhole size={20} />
                              )}
                            </span>
                            <span className="service-tag">
                              {s.id === "premium"
                                ? "Limit check"
                                : !a.allowedServices.includes(s.id)
                                  ? "Not approved"
                                  : s.category}
                            </span>
                          </div>
                          <h3>{s.name}</h3>
                          <p>{s.description}</p>
                          <footer>
                            <strong>{money(s.amount)}</strong>
                            <button
                              disabled={!writable || !!busy}
                              onClick={() => buy(s.id)}
                            >
                              {busy === s.id ? (
                                <LoaderCircle size={15} className="spin" />
                              ) : (
                                <>
                                  Request
                                  <ArrowUpRight size={14} />
                                </>
                              )}
                            </button>
                          </footer>
                        </article>
                      ))}
                    </div>
                    <div className="panel-footnote">
                      <LockKeyhole size={13} />
                      {data.mode === "razorpay_live"
                        ? "Live purchases charge real money after you confirm in Razorpay checkout."
                        : "Sample services for this event. Rehearsal and test payments move no real money."}
                    </div>
                  </section>
                  {notice && (
                    <div
                      className={`alert ${selected?.payment.status === "blocked" ? "warning" : "success"}`}
                      role="status"
                    >
                      <span>{notice}</span>
                      {selected?.checkoutUrl && (
                        <a
                          className="button primary small"
                          href={selected.checkoutUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open checkout
                          <ArrowUpRight size={14} />
                        </a>
                      )}
                    </div>
                  )}
                  <section className="panel" id="purchases">
                    <div className="section-heading">
                      <div>
                        <h2>
                          Purchase ledger{" "}
                          <span className="count">{data.payments.length}</span>
                        </h2>
                        <p>
                          Decisions and outcomes, attached to the same identity.
                        </p>
                      </div>
                      <button
                        className="icon-button"
                        aria-label="Refresh purchases"
                        onClick={() => void refresh()}
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                    {!data.payments.length ? (
                      <div className="empty-state">
                        <Wallet size={24} />
                        <strong>Your first purchase starts here</strong>
                        <p>
                          Request a service above, or ask Hermes to make a
                          purchase.
                        </p>
                      </div>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Service / request</th>
                              <th>Amount</th>
                              <th>Method</th>
                              <th>Status</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {data.payments.map((p) => (
                              <tr key={p.id}>
                                <td>
                                  <strong>{p.serviceName}</strong>
                                  <small>
                                    {p.source} ·{" "}
                                    {new Date(p.createdAt).toLocaleTimeString(
                                      [],
                                      { hour: "2-digit", minute: "2-digit" },
                                    )}
                                  </small>
                                </td>
                                <td className="mono">{money(p.amount)}</td>
                                <td>
                                  {(p.actualMethod || p.rail).toUpperCase()}
                                  <small>
                                    {p.mode === "rehearsal"
                                      ? "Simulated"
                                      : p.mode === "razorpay_test"
                                        ? "Test"
                                        : "Live"}
                                  </small>
                                </td>
                                <td>
                                  <span className={`status ${p.status}`}>
                                    {statusLabel(p.status)}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    className="icon-button"
                                    aria-label={`View ${p.serviceName} details`}
                                    onClick={() => detail(p)}
                                  >
                                    <ArrowUpRight size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>
                <div className="secondary-column">
                  <section className="panel activity-panel" id="activity">
                    <div className="section-heading">
                      <h2>Activity stream</h2>
                      <span className="polling">
                        <span className="dot" />
                        5s refresh
                      </span>
                    </div>
                    <div className="timeline">
                      {data.events.slice(0, 15).map((e) => (
                        <article key={e.id}>
                          <div className={`timeline-icon ${e.type}`}>
                            {["blocked", "revoke", "failed"].includes(
                              e.type,
                            ) ? (
                              <X size={13} />
                            ) : e.type === "paid" ? (
                              <Check size={13} />
                            ) : (
                              <Activity size={13} />
                            )}
                          </div>
                          <div>
                            <div className="event-meta">
                              <strong>{e.title}</strong>
                              <time>
                                {new Date(e.time).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </time>
                            </div>
                            <p>{e.detail}</p>
                            <small>{e.source}</small>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                  <section className="authority-panel">
                    <div>
                      <ShieldCheck size={21} />
                      <h3>Owner controls</h3>
                    </div>
                    <p>
                      Pause new spending instantly. Existing provider orders
                      remain accounted for.
                    </p>
                    <button
                      className={`button ${a.status === "active" ? "danger-outline" : "secondary"}`}
                      disabled={!writable || !!busy}
                      onClick={() =>
                        action("authority", async () => {
                          await api(
                            a.status === "active" ? "revoke" : "resume",
                            {},
                          );
                        })
                      }
                    >
                      {a.status === "active"
                        ? "Revoke spending authority"
                        : "Restore spending authority"}
                    </button>
                    <button
                      className="text-button"
                      disabled={!writable || !!busy}
                      onClick={() =>
                        action("rotate", async () => {
                          await api("rotate", {});
                          setNotice(
                            "Funding reference updated; identity and history preserved. Payment credentials are chosen at checkout.",
                          );
                        })
                      }
                    >
                      <RefreshCw size={13} />
                      Rotate funding reference
                    </button>
                    <small>
                      Reference rotation demonstrates identity continuity; it
                      does not rotate bank or card credentials.
                    </small>
                  </section>
                </div>
              </div>
              <footer className="dashboard-footer">
                <span>
                  <Fingerprint size={15} />
                  AgentPass · Built for BuildX
                </span>
                <span>
                  {data.storage === "postgres"
                    ? "Persistent workspace"
                    : "Local development storage"}{" "}
                  · {modeLabel(data.mode)}
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal === "login" && (
              <>
                <span className="modal-symbol">
                  <KeyRound />
                </span>
                <h2>Owner access</h2>
                <p>
                  Enter the private access code from your event setup to manage
                  the connected agent.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action("login", async () => {
                      await api("session", { code });
                      setCode("");
                      setModal(null);
                      setSelected(null);
                    });
                  }}
                >
                  <label>
                    Access code
                    <input
                      autoFocus
                      type="password"
                      autoComplete="current-password"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                    />
                  </label>
                  <button className="button primary" disabled={!!busy}>
                    Open owner workspace
                    <ArrowRight size={16} />
                  </button>
                </form>
              </>
            )}
            {modal === "policy" && a && (
              <>
                <span className="modal-symbol">
                  <SlidersHorizontal />
                </span>
                <h2>Spending policy</h2>
                <p>
                  Rules are enforced before a payment order is created. Amounts
                  below are in rupees.
                </p>
                <form onSubmit={policy}>
                  <label>
                    Agent name
                    <input
                      name="name"
                      defaultValue={a.name}
                      maxLength={40}
                      required
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Total allowance (₹)
                      <input
                        name="budget"
                        type="number"
                        min="1"
                        step="0.01"
                        defaultValue={a.budget / 100}
                        required
                      />
                    </label>
                    <label>
                      Per purchase (₹)
                      <input
                        name="cap"
                        type="number"
                        min="1"
                        step="0.01"
                        defaultValue={a.perTransaction / 100}
                        required
                      />
                    </label>
                  </div>
                  <fieldset>
                    <legend>Approved services</legend>
                    {data?.services.map((s) => (
                      <label className="checkbox" key={s.id}>
                        <input
                          type="checkbox"
                          name="services"
                          value={s.id}
                          defaultChecked={a.allowedServices.includes(s.id)}
                        />
                        {s.name}
                      </label>
                    ))}
                  </fieldset>
                  <button
                    className="button primary"
                    disabled={!!busy || !writable}
                  >
                    Save policy
                    <Check size={16} />
                  </button>
                </form>
              </>
            )}
            {modal === "connect" && (
              <>
                <span className="modal-symbol">
                  <Terminal />
                </span>
                <h2>Bring your Hermes agent</h2>
                <p>
                  Use the event profile to connect Hermes to this workspace.
                  Your usual Hermes setup stays untouched.
                </p>
                <ol className="setup-list">
                  <li>
                    <strong>Set up the event credentials</strong>
                    <span>
                      Follow SETUP.md in the repository. Only the scoped agent
                      token is given to Hermes.
                    </span>
                  </li>
                  <li>
                    <strong>Launch the isolated profile</strong>
                    <code>npm run hermes:event</code>
                  </li>
                  <li>
                    <strong>Give Atlas a task</strong>
                    <blockquote>
                      “Check my AgentPass budget, request a research brief using
                      UPI, and give me the checkout link.”
                    </blockquote>
                  </li>
                </ol>
                <p className="fine-print">
                  Hermes requests purchases. You confirm UPI or card payments in
                  Razorpay. The agent never receives your UPI PIN or card
                  details.
                </p>
                <a
                  className="button primary"
                  href="https://github.com/Arkane-o7/BuildX-Buildonomics"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open setup guide
                  <ArrowUpRight size={16} />
                </a>
              </>
            )}
            {modal === "receipt" && selected && (
              <>
                <span className="modal-symbol">
                  <ShieldCheck />
                </span>
                <h2>{selected.payment.serviceName}</h2>
                <p>{selected.payment.reason}</p>
                <dl className="receipt-details">
                  <dt>Amount</dt>
                  <dd>{money(selected.payment.amount)}</dd>
                  <dt>Status</dt>
                  <dd>{statusLabel(selected.payment.status)}</dd>
                  <dt>Environment</dt>
                  <dd>{modeLabel(selected.payment.mode)}</dd>
                  <dt>Policy / funding</dt>
                  <dd>
                    v{selected.payment.policyVersion} / v
                    {selected.payment.bindingVersion}
                  </dd>
                  <dt>Request ID</dt>
                  <dd className="mono">{selected.payment.requestId}</dd>
                </dl>
                {selected.payment.mode !== "rehearsal" &&
                  writable &&
                  ["unknown", "creating_order", "awaiting_checkout"].includes(
                    selected.payment.status,
                  ) && (
                    <button
                      className="button secondary"
                      disabled={!!busy}
                      onClick={() =>
                        action("reconcile", async () => {
                          await api(
                            `payments/${selected.payment.id}/reconcile`,
                            {},
                          );
                          setSelected(
                            await api(`payments/${selected.payment.id}`),
                          );
                        })
                      }
                    >
                      <RefreshCw size={15} />
                      Check provider status
                    </button>
                  )}
                {selected.payment.result && (
                  <div className="service-result">
                    {selected.payment.result}
                  </div>
                )}
                {selected.checkoutUrl && (
                  <a
                    className="button primary"
                    href={selected.checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open checkout
                    <ArrowUpRight size={16} />
                  </a>
                )}
                {selected.receipt && (
                  <>
                    <div className="form-row">
                      <button className="button secondary" onClick={download}>
                        <ArrowDownToLine size={15} />
                        Export receipt
                      </button>
                      <button
                        className="button primary"
                        disabled={!!busy}
                        onClick={() =>
                          action("verify", async () => {
                            setVerified(
                              (
                                await api("receipts/verify", {
                                  payload: selected.receipt!.payload,
                                  signature: selected.receipt!.signature,
                                })
                              ).valid,
                            );
                          })
                        }
                      >
                        <ShieldCheck size={15} />
                        Verify signature
                      </button>
                    </div>
                    {verified !== null && (
                      <div
                        className={`alert ${verified ? "success" : "error"}`}
                      >
                        {verified
                          ? "Signature verified against the issuer’s public key."
                          : "Signature invalid."}
                      </div>
                    )}
                    <p className="fine-print">
                      A signed receipt proves the recorded outcome has not
                      changed. It does not prove current spending authority.
                    </p>
                  </>
                )}
              </>
            )}
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
