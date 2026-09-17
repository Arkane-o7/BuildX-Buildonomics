"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Activity, ArrowLeft, ArrowRight, Check, ChevronRight, Copy, Fingerprint, Search, ShieldCheck, SlidersHorizontal, Wallet } from "lucide-react";
import type { PublicAccount } from "@/lib/platform-types";
import { money } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import styles from "./dashboard.module.css";

type Agent = PublicAccount["agents"][number];
type Props = {
  account: PublicAccount;
  busy: boolean;
  onAdd: () => void;
  onNavigate: (tab: string) => void;
  onSave: (path: string, values: unknown) => Promise<string | null>;
  onConnect: (agentId: string) => void;
};

function Status({ agent }: { agent: Agent }) {
  return <span className={`${styles.status} ${agent.status === "revoked" ? styles.revoked : ""}`}><span />{agent.status === "active" ? "Active" : "Revoked"}</span>;
}
function AllowanceMeter({ agent }: { agent: Agent }) {
  const total = Math.max(agent.budget, agent.spent + agent.reserved, 1);
  return <div className={styles.meter} role="img" aria-label={`${money(agent.spent)} reported spend, ${money(agent.reserved)} reserved, ${money(agent.budget - agent.spent - agent.reserved)} remaining authority`}><span className={styles.spent} style={{ width: `${agent.spent / total * 100}%` }} /><span className={styles.reserved} style={{ width: `${agent.reserved / total * 100}%` }} /></div>;
}
function lastConnected(value: string | null) {
  if (!value) return "Not connected";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AgentsDashboard({ account, busy, onAdd, onNavigate, onSave, onConnect }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<"policy" | "account" | "revoke" | null>(null);
  const [editError, setEditError] = useState("");
  const [copied, setCopied] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const agent = account.agents.find(a => a.id === selected);
  const active = account.agents.filter(a => a.status === "active");
  const spent = account.agents.reduce((sum, a) => sum + a.spent, 0);
  const reserved = account.agents.reduce((sum, a) => sum + a.reserved, 0);
  const visible = account.agents.filter(a => (filter === "all" || a.status === filter) && `${a.name} ${a.runtime}`.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { if (selected) titleRef.current?.focus(); }, [selected]);
  function edit(mode: typeof editing) { setEditError(""); setEditing(mode); }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!agent || busy) return;
    const form = new FormData(e.currentTarget);
    const path = editing === "policy" ? "policy" : editing === "account" ? "binding" : "revoke";
    const values = editing === "policy" ? {
      budget: Math.round(Number(form.get("budget")) * 100),
      perPurchase: Math.round(Number(form.get("cap")) * 100),
      allowedMerchants: String(form.get("merchants")).split(/[,\n]/).map(s => s.trim()).filter(Boolean),
    } : editing === "account" ? { walletId: form.get("walletId") } : {};
    const error = await onSave(`agents/${agent.id}/${path}`, values);
    if (error) setEditError(error);
    else edit(null);
  }
  const wallet = account.wallets.find(w => w.id === agent?.walletId);
  return <div className={styles.dashboard}>
    {agent ? <>
      <button className={styles.back} onClick={() => setSelected(null)}><ArrowLeft size={15} /> All agents</button>
      <div className={styles.detailHeading}><div className={styles.identity}><img src={`/${agent.avatar}`} alt="" /><div><div className={styles.titleLine}><h1 ref={titleRef} tabIndex={-1}>{agent.name}</h1><Status agent={agent} /></div><p>{agent.runtime} <span>·</span> {agent.lastSeen ? `Last connected ${lastConnected(agent.lastSeen)}` : "Not connected yet"}</p></div></div><Button variant="outline" onClick={() => onConnect(agent.id)}><Fingerprint />Connect agent</Button></div>
      <div className={styles.detailGrid}>
        <section className={`${styles.panel} ${styles.allowancePanel}`}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>SPENDING AUTHORITY</span><h2>Allowance</h2></div><ShieldCheck size={22} /></div><p className={styles.bigAmount}>{money(agent.budget - agent.spent - agent.reserved)}<span>remaining allowance</span></p><AllowanceMeter agent={agent} /><div className={styles.legend}><span><i className={styles.spentDot} />Reported <strong>{money(agent.spent)}</strong></span><span><i className={styles.reservedDot} />Reserved <strong>{money(agent.reserved)}</strong></span><span><i />Remaining <strong>{money(agent.budget - agent.spent - agent.reserved)}</strong></span></div></section>
        <section className={styles.panel}><div className={styles.sectionHeading}><h2>Spending rules</h2><Button size="sm" variant="outline" onClick={() => edit("policy")}><SlidersHorizontal />Edit limits</Button></div><dl className={styles.rules}><div><dt>Per purchase</dt><dd>{money(agent.perPurchase)}</dd></div><div><dt>Total allowance</dt><dd>{money(agent.budget)}</dd></div><div><dt>Allowed websites</dt><dd className={styles.domains}>{agent.allowedMerchants.length ? agent.allowedMerchants.map(domain => <span key={domain}>{domain}</span>) : "No websites allowed"}</dd></div></dl></section>
        <section className={styles.panel}><div className={styles.sectionHeading}><h2>Payment account</h2><Button variant="ghost" size="sm" onClick={() => account.wallets.length ? edit("account") : onNavigate("Payment accounts")}>{wallet ? "Change" : "Add account"}<ArrowRight /></Button></div><div className={styles.accountSummary}><span className={styles.iconTile}><Wallet size={20} /></span><div><strong>{wallet?.label || "No account assigned"}</strong><p>{wallet ? `${wallet.kind.toUpperCase()} · ${wallet.maskedReference}` : "Choose a payment reference for this agent."}</p></div></div></section>
        <section className={styles.panel}><div className={styles.sectionHeading}><h2>Agent identity</h2><Fingerprint size={19} /></div><dl className={styles.rules}><div><dt>Owner</dt><dd>{account.name}</dd></div><div><dt>Identity assurance</dt><dd>Owner attested</dd></div></dl><details className={styles.technical}><summary>Technical details</summary><div><span>Stable identity</span><code>{agent.id}</code><Button size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(agent.id); setCopied(true); } catch { setCopied(false); } }}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy ID"}</Button></div><p>Binding v{agent.bindingVersion} · Policy v{agent.policyVersion}</p></details></section>
      </div>
      <section className={styles.danger}><div><h2>Spending authority</h2><p>{agent.status === "active" ? "Revoke this agent’s authority to authorize new purchases." : "This agent’s spending authority has been revoked."}</p></div><Button variant="outline" disabled={busy} className={agent.status === "active" ? "text-destructive" : ""} onClick={() => agent.status === "active" ? edit("revoke") : void onSave(`agents/${agent.id}/resume`, {})}>{agent.status === "active" ? "Revoke authority" : "Restore authority"}</Button></section>
    </> : <>
      <div className={styles.pageHeading}><div><span className={styles.eyebrow}>WORKSPACE OVERVIEW</span><h1>Your agents, under control.</h1></div><Button onClick={onAdd}><span className={styles.plus}>+</span>Add agent</Button></div>
      <div className={styles.stats}>
        {[{ label: "Active agents", value: String(active.length).padStart(2, "0"), icon: Fingerprint }, { label: "Reported spend", value: money(spent), icon: Activity }, { label: "Reserved allowance", value: money(reserved), icon: ShieldCheck }, { label: "Payment accounts", value: String(account.wallets.length).padStart(2, "0"), icon: Wallet }].map(({ label, value, icon: Icon }) => <div key={label} className={styles.stat}><div><span>{label}</span><Icon size={16} /></div><strong>{value}</strong></div>)}
      </div>
      <section className={styles.panel + " " + styles.agentsPanel}>
        <div className={styles.tableHeading}><div><h2>Agents <span className={styles.count}>{account.agents.length}</span></h2></div></div>
        <div className={styles.toolbar}><div className={styles.filters} role="group" aria-label="Filter agents">{["all", "active", "revoked"].map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "all" ? "All agents" : value === "active" ? "Active" : "Revoked"}{value === "all" && <span>{account.agents.length}</span>}</button>)}</div><label className={styles.search}><Search size={16} /><input aria-label="Search agents" placeholder="Search agents…" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
        {visible.length ? <div className={styles.tableScroll}><table className={styles.agentTable}><thead><tr><th>Agent</th><th>Status</th><th>Remaining allowance</th><th>Per purchase</th><th>Last connected</th><th><span className="sr-only">Open agent</span></th></tr></thead><tbody>{visible.map(a => <tr key={a.id}><td><button className={styles.agentLink} onClick={() => { setSelected(a.id); setCopied(false); }}><img src={`/${a.avatar}`} alt="" /><span><strong>{a.name}</strong><small>{a.runtime}</small></span></button></td><td><Status agent={a} /></td><td><div className={styles.tableAllowance}><strong>{money(a.budget - a.spent - a.reserved)}<span> / {money(a.budget)}</span></strong><AllowanceMeter agent={a} /></div></td><td className={styles.numeric}>{money(a.perPurchase)}</td><td className={styles.lastSeen}>{lastConnected(a.lastSeen)}</td><td><button className={styles.openAgent} aria-label={`Open ${a.name}`} onClick={() => { setSelected(a.id); setCopied(false); }}><ChevronRight size={17} /></button></td></tr>)}</tbody></table></div> : <div className={styles.empty}><Fingerprint size={32} /><h3>{account.agents.length ? "No matching agents" : "Your first agent starts here"}</h3><p>{account.agents.length ? "Try a different name or status filter." : "Create an identity, set its limits, and connect your agent."}</p><Button variant="outline" onClick={() => account.agents.length ? (setQuery(""), setFilter("all")) : onAdd()}>{account.agents.length ? "Clear filters" : "Add your first agent"}</Button></div>}
        <div className={styles.tableFooter}><span>{visible.length} of {account.agents.length} agents</span></div>
      </section>
      <div className={styles.bottomGrid}><section className={styles.panel}><div className={styles.sectionHeading}><h2>Recent activity</h2><button className={styles.textLink} onClick={() => onNavigate("Activity")}>View all<ArrowRight size={14} /></button></div>{account.events.length ? <div className={styles.activityList}>{account.events.slice(0, 3).map(event => <div key={event.id}><span className={styles.eventIcon}><Activity size={15} /></span><div><strong>{event.type.replace(/[_.]/g, " ")}</strong><p>{event.detail}</p></div><time>{new Date(event.time).toLocaleDateString([], { month: "short", day: "numeric" })}</time></div>)}</div> : <div className={styles.quietEmpty}><Activity size={22} /><p>Your agents’ activity will appear here.</p><button className={styles.textLink} onClick={() => onNavigate("Connect plugin")}>Connect an agent<ArrowRight size={14} /></button></div>}</section></div>
    </>}
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !busy) edit(null); }}><DialogContent className={`sm:max-w-lg ${styles.editDialog}`}><DialogHeader><DialogTitle>{editing === "policy" ? "Edit spending limits" : editing === "account" ? "Change payment account" : "Revoke spending authority?"}</DialogTitle><DialogDescription>{editing === "revoke" ? `This stops ${agent?.name} from authorizing new purchases. It does not cancel existing merchant orders or payments. You can restore authority later.` : editing === "policy" ? `Set the rules for ${agent?.name}. Allowances are permissions, not a funded balance.` : "Switch references without resetting this agent’s history."}</DialogDescription></DialogHeader>{agent && <form className={styles.editForm} onSubmit={save}>{editing === "policy" && <><div className={styles.formColumns}><label>Total allowance (₹)<Input name="budget" type="number" min="1" max="100000" step="0.01" defaultValue={agent.budget / 100} required /></label><label>Per purchase (₹)<Input name="cap" type="number" min="1" max="100000" step="0.01" defaultValue={agent.perPurchase / 100} required /></label></div><label>Allowed websites<Input name="merchants" defaultValue={agent.allowedMerchants.join(", ")} placeholder="amazon.in, flipkart.com" required /><small>Separate domains with commas. Subdomains are included.</small></label></>}{editing === "account" && <label>Payment account<NativeSelect name="walletId" defaultValue={agent.walletId || ""} required className="w-full"><NativeSelectOption value="" disabled>Select an account</NativeSelectOption>{account.wallets.map(w => <NativeSelectOption key={w.id} value={w.id}>{w.label} · {w.maskedReference}</NativeSelectOption>)}</NativeSelect><small>References do not connect a bank or enable payment execution.</small></label>}{editError && <p role="alert" className="text-sm text-destructive">{editError}</p>}<div className={styles.formActions}><Button variant="outline" disabled={busy} onClick={() => edit(null)}>Cancel</Button><Button type="submit" variant={editing === "revoke" ? "destructive" : "default"} disabled={busy}>{busy ? "Saving…" : editing === "revoke" ? "Revoke authority" : "Save changes"}</Button></div></form>}</DialogContent></Dialog>
  </div>;
}
