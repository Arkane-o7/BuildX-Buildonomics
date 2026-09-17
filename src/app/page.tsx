"use client";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Activity, ArrowRight, ArrowUpRight, Copy, CreditCard, Fingerprint, KeyRound, LoaderCircle, LogOut, Plus, ShieldCheck, Terminal, Wallet } from "lucide-react";
import { money } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import type { PublicAccount, PurchaseIntent } from "@/lib/platform-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { ConnectPhone } from "./connect-phone";
import SubscriptionPlans from "./subscription-plans";
import { Landing, Brand } from "./landing";
import { ThemeToggle } from "./theme-toggle";
import AgentsDashboard from "./agents-dashboard";

function Message({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <Alert variant={error ? "destructive" : "default"} role={error ? "alert" : "status"}><AlertDescription>{children}</AlertDescription></Alert>;
}
function EmptyState({ title, detail, children }: { title: string; detail: string; children?: ReactNode }) {
  return <Card className="items-center gap-5 px-5 py-12 text-center sm:py-16">
    <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Wallet className="size-6" /></div>
    <div className="w-full max-w-md space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
    {children && <div className="flex max-w-full justify-center">{children}</div>}
  </Card>;
}
function WorkspaceNavigation({ tab, setTab, logout }: { tab: string; setTab: (tab: string) => void; logout: () => void }) {
  const { setOpenMobile } = useSidebar();
  return <Sidebar collapsible="icon">
    <SidebarHeader className="gap-5 p-4 group-data-[collapsible=icon]:p-2"><div className="group-data-[collapsible=icon]:hidden"><Brand /></div><div className="hidden group-data-[collapsible=icon]:block"><Brand compact /></div></SidebarHeader>
    <SidebarContent>{[{label:"Workspace",items:tabs.filter(t=>["Agents","Activity"].includes(t.name))},{label:"Manage",items:tabs.filter(t=>!["Agents","Activity"].includes(t.name))}].map(group=><SidebarGroup key={group.label}><SidebarGroupLabel>{group.label}</SidebarGroupLabel><SidebarMenu>{group.items.map(({name,icon: Icon})=><SidebarMenuItem key={name}><SidebarMenuButton aria-label={name} tooltip={name} isActive={tab===name} onClick={()=>{setTab(name);setOpenMobile(false);}}><Icon /><span>{name}</span></SidebarMenuButton></SidebarMenuItem>)}{group.label==="Manage"&&<SidebarMenuItem><ConnectPhone /></SidebarMenuItem>}</SidebarMenu></SidebarGroup>)}</SidebarContent>
    <SidebarFooter className="p-3"><SidebarMenu><SidebarMenuItem><SidebarMenuButton aria-label="Sign out" tooltip="Sign out" onClick={logout}><LogOut /><span>Sign out</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter>
  </Sidebar>;
}

async function api(path: string, input?: unknown) {
  const r = await fetch(`/api/platform/${path}`, { method: input === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || "Request failed.");
  return result;
}
const tabs = [{ name: "Agents", icon: Fingerprint }, { name: "Payment accounts", icon: Wallet }, { name: "Activity", icon: Activity }, { name: "Connect plugin", icon: Terminal }, { name: "Subscription", icon: CreditCard }];
export default function AgentPass() {
  const [account, setAccount] = useState<PublicAccount | null>(null);
  const [loading, setLoading] = useState(true), [signup, setSignup] = useState(false), [authOpen, setAuthOpen] = useState(false);
  const [tab, setTab] = useState("Agents"), [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [modal, setModal] = useState<"agent" | "wallet" | "token" | "intent" | null>(null);
  const [token, setToken] = useState(""), [walletKind, setWalletKind] = useState("upi");
  const [intent, setIntent] = useState<PurchaseIntent | null>(null), [verification, setVerification] = useState("");
  const [avatars, setAvatars] = useState<string[]>([]);
  const refresh = useCallback(async () => { const result = await api("account"); setAccount(result.account); }, []);
  useEffect(() => { void refresh().catch(() => {}).finally(() => setLoading(false)); }, [refresh]);
  useEffect(() => { void api("avatars").then(r => setAvatars(r.avatars || [])).catch(() => {}); }, []);
  useEffect(() => { if (!account) return; const timer = setInterval(() => void refresh().catch(() => {}), 5000); return () => clearInterval(timer); }, [!!account, refresh]);
  const agent = account?.agents.find(a => a.id === selected) || account?.agents[0];
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function close() { setModal(null); setToken(""); }
  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = new FormData(e.currentTarget);
    await action(async () => { const result = await api(signup ? "signup" : "login", { email: data.get("email"), password: data.get("password"), ...(signup ? { name: data.get("name") } : {}) }); setAccount(result.account); setAuthOpen(false); });
  }
  async function formAction(e: FormEvent<HTMLFormElement>, path: string, transform?: (values: FormData) => unknown) {
    e.preventDefault(); const values = new FormData(e.currentTarget);
    await action(async () => {
      const result = await api(path, transform ? transform(values) : Object.fromEntries(values));
      if (result.token) { setToken(result.token); setModal("token"); if (result.agent) setSelected(result.agent.id); }
      else setModal(null);
      await refresh(); setNotice("Saved.");
    });
  }
  const authForm = <form onSubmit={signIn}>
    <FieldGroup>
      {signup && <Field><FieldLabel htmlFor="auth-name">Your name</FieldLabel><Input id="auth-name" name="name" autoComplete="name" maxLength={80} required /></Field>}
      <Field><FieldLabel htmlFor="auth-email">Email</FieldLabel><Input id="auth-email" name="email" type="email" autoComplete="email" maxLength={200} required /></Field>
      <Field><FieldLabel htmlFor="auth-password">Password</FieldLabel><Input id="auth-password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={12} maxLength={200} required aria-describedby="password-help" /><FieldDescription id="password-help" className="text-xs">At least 12 characters. Email verification and password recovery are not available in this event build.</FieldDescription></Field>
      <Button type="submit" disabled={busy}>{busy && <LoaderCircle className="animate-spin" />}{signup ? "Create trial account" : "Sign in"}</Button>
      <Button variant="ghost" className="h-auto whitespace-normal" onClick={() => { setSignup(!signup); setError(""); }}>{signup ? "Already have an account? Sign in" : "New to AgentPass? Create an account"}</Button>
    </FieldGroup>
  </form>;
  if (loading) return <main className="grid min-h-svh place-content-center justify-items-center gap-4 bg-background text-muted-foreground"><LoaderCircle className="size-7 animate-spin" /><p className="text-sm">Opening AgentPass…</p></main>;
  return <>
    {!account ? <Landing onStart={() => { setSignup(true); setAuthOpen(true); }} onSignIn={() => { setSignup(false); setAuthOpen(true); }} /> : <SidebarProvider className="workspace-shell">
      <WorkspaceNavigation tab={tab} setTab={setTab} logout={() => action(async () => { await api("logout", {}); setAccount(null); setToken(""); })} />
      <SidebarInset className="min-w-0">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-4 md:px-7"><div className="flex items-center gap-3"><SidebarTrigger /><Separator orientation="vertical" className="!h-4" /><span className="hidden text-sm text-muted-foreground sm:block">Workspace</span><span className="text-sm font-medium">{tab}</span></div><div className="flex items-center gap-2"><Badge variant="outline" className="hidden sm:inline-flex">Event trial</Badge><ThemeToggle /></div></header>
        <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 md:p-7 lg:px-10 lg:py-9">
          {tab !== "Subscription" && tab !== "Agents" && <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">{tab === "Agents" ? "Your agents" : tab}</h1></div>{tab === "Agents" && <Button onClick={() => setModal("agent")}><Plus />Register agent</Button>}{tab === "Payment accounts" && <Button onClick={() => setModal("wallet")}><Plus />Add account reference</Button>}</div>}
          {error && <Message error>{error}</Message>}{notice && <Message>{notice}</Message>}
          {tab === "Agents" && <AgentsDashboard account={account} busy={busy} onAdd={() => setModal("agent")} onNavigate={setTab} onConnect={id => { setSelected(id); setTab("Connect plugin"); }} onSave={async (path, values) => {
            if (busy) return "A change is already being saved.";
            setBusy(true); setError(""); setNotice("");
            try { await api(path, values); await refresh(); setNotice("Changes saved."); return null; }
            catch (e) { const message = (e as Error).message; setError(message); return message; }
            finally { setBusy(false); }
          }} />}
          {tab === "Payment accounts" && <>
            {!account.wallets.length ? <EmptyState title="No payment accounts yet" detail="Add a UPI or card reference, then bind it to an agent."><Button onClick={()=>setModal("wallet")}>Add account reference</Button></EmptyState> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{account.wallets.map(w=><Card key={w.id}><CardHeader><div className="mb-3 flex items-center justify-between"><Wallet className="size-5" /><Badge variant="outline">Reference only</Badge></div><CardTitle>{w.label}</CardTitle><CardDescription>{w.kind.toUpperCase()} · {w.maskedReference}</CardDescription></CardHeader><CardFooter className="flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{account.agents.filter(a=>a.walletId===w.id).length} agents bound</span></CardFooter></Card>)}</div>}
          </>}
          {tab === "Activity" && <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]"><Card className="min-w-0"><CardHeader><CardTitle>Purchase intents</CardTitle></CardHeader><CardContent>{!account.intents.length?<p className="py-8 text-center text-sm text-muted-foreground">No requests yet. Connect your plugin to get started.</p>:<Table><TableHeader><TableRow><TableHead>Purchase / merchant</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Details</span></TableHead></TableRow></TableHeader><TableBody>{account.intents.map(i=><TableRow key={i.id}><TableCell className="min-w-44 max-w-64 whitespace-normal"><p className="font-medium">{i.item}</p><p className="mt-1 text-xs text-muted-foreground">{i.merchant}</p></TableCell><TableCell className="tabular-nums">{money(i.amount)}</TableCell><TableCell><Badge variant={i.status==="blocked"?"destructive":"outline"}>{i.status==="reported"?"Order reported":i.status}</Badge></TableCell><TableCell><Button variant="ghost" size="icon" aria-label={`Inspect ${i.item}`} onClick={()=>{setIntent(i);setVerification("");setModal("intent");}}><ArrowUpRight /></Button></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card><Card><CardHeader><CardTitle>Audit trail</CardTitle></CardHeader><CardContent className="max-h-[600px] space-y-5 overflow-auto">{account.events.slice(0,30).map(e=><div key={e.id} className="flex gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted"><Activity className="size-4 text-muted-foreground" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-1 text-xs"><span className="font-medium capitalize">{e.type}</span><time className="text-muted-foreground">{new Date(e.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</time></div><p className="mt-1 text-sm leading-6 break-words text-muted-foreground">{e.detail}</p></div></div>)}</CardContent></Card></div>}
          {tab === "Connect plugin" && <Card className="max-w-3xl"><CardHeader><CardTitle>Give your agent its passport</CardTitle><CardAction><Terminal className="size-5 text-muted-foreground" /></CardAction></CardHeader><CardContent className="space-y-6"><ol className="ml-5 list-decimal space-y-5 text-sm marker:text-muted-foreground"><li className="pl-2"><p className="font-medium">Register an agent and bind its account</p><p className="mt-1 leading-6 text-muted-foreground">Configure the merchant allowlist and spending limits under Agents.</p></li><li className="pl-2"><p className="font-medium">Get a scoped plugin credential</p><p className="mt-1 leading-6 text-muted-foreground">Credentials are shown once at registration. Rotation invalidates the previous credential.</p></li><li className="pl-2"><p className="font-medium">Connect Hermes or another MCP client</p><code className="my-2 block rounded-lg border bg-muted p-3 text-xs">npm run plugin:configure</code><p className="leading-6 text-muted-foreground">Run from this repository. Paste the credential into the local prompt, then run <code className="text-foreground">npm run hermes:platform</code>.</p></li><li className="pl-2"><p className="font-medium">Use your agent’s shopping tools</p><blockquote className="mt-2 rounded-lg border bg-muted/50 p-3 leading-6 text-muted-foreground">Find an umbrella on Amazon India under ₹800. Use AgentPass to check my identity and authorize the exact item and final total. Only report payment when the merchant confirms it.</blockquote></li></ol>{agent&&<div className="space-y-3 border-t pt-5"><Field><FieldLabel htmlFor="plugin-agent">Agent</FieldLabel><NativeSelect id="plugin-agent" className="w-full" value={agent.id} onChange={e=>setSelected(e.target.value)}>{account.agents.map(a=><NativeSelectOption key={a.id} value={a.id}>{a.name}</NativeSelectOption>)}</NativeSelect></Field><Button variant="outline" disabled={busy} onClick={()=>action(async()=>{const r=await api(`agents/${agent.id}/token`,{});setToken(r.token);setModal("token");await refresh();})}><KeyRound />Rotate & show new credential</Button></div>}</CardContent></Card>}
          {tab === "Subscription" && <SubscriptionPlans agentCount={account.agents.length} walletCount={account.wallets.length} intentCount={account.intents.length} onConnect={()=>setTab("Connect plugin")} />}
        </div>
      </SidebarInset>
    </SidebarProvider>}
    <Dialog open={authOpen || !!modal} onOpenChange={open=>{if(!open){close();setAuthOpen(false);}}}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>{authOpen ? signup ? "Your agents start here" : "Welcome back" : modal==="agent"?"Register an agent":modal==="wallet"?"Add an account reference":modal==="token"?"Your agent credential":intent?.item||"Purchase details"}</DialogTitle><DialogDescription>{authOpen?signup?"Create your AgentPass event-trial workspace.":"Sign in to manage your identities and spending rules.":modal==="agent"?"Create a stable identity and a scoped plugin credential.":modal==="wallet"?"We store a masked reference. This does not connect a bank or enable automatic payment.":modal==="token"?"Shown once. Store it in your local plugin configuration, not in prompts.":intent?.reason}</DialogDescription></DialogHeader>
        {authOpen && authForm}
        {modal==="agent"&&<form onSubmit={e=>formAction(e,"agents")}><FieldGroup><Field><FieldLabel htmlFor="agent-name">Agent name</FieldLabel><Input id="agent-name" name="name" placeholder="Atlas" maxLength={60} required /></Field><Field><FieldLabel htmlFor="agent-runtime">Runtime</FieldLabel><Input id="agent-runtime" name="runtime" defaultValue="Hermes" maxLength={60} required /></Field><fieldset><legend className="mb-3 text-sm font-medium">Choose a sprite</legend><div className="flex flex-wrap gap-3">{avatars.map(file=>{const taken=account?.agents.some(x=>x.status==="active"&&x.avatar===file);return <label key={file} className={cn("relative cursor-pointer rounded-xl border-2 border-transparent bg-muted p-1 has-[:checked]:border-sidebar-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",taken&&"cursor-not-allowed opacity-30")} title={taken?`${file} is already in use`:file}><input type="radio" name="avatar" value={file} required disabled={taken} className="sr-only" aria-label={file} /><img src={`/${file}`} alt="" className="size-11 rounded-lg object-cover" /></label>;})}</div></fieldset><Button type="submit" disabled={busy||!avatars.length}>Register agent</Button></FieldGroup></form>}
        {modal==="wallet"&&<form onSubmit={e=>formAction(e,"wallets")}><FieldGroup><Field><FieldLabel htmlFor="account-label">Account label</FieldLabel><Input id="account-label" name="label" placeholder="Personal UPI" maxLength={60} required /></Field><Field><FieldLabel htmlFor="account-kind">Account type</FieldLabel><NativeSelect id="account-kind" className="w-full" name="kind" value={walletKind} onChange={e=>setWalletKind(e.target.value)}><NativeSelectOption value="upi">UPI</NativeSelectOption><NativeSelectOption value="card">Card</NativeSelectOption></NativeSelect></Field><Field><FieldLabel htmlFor="account-reference">{walletKind==="upi"?"UPI ID":"Last four card digits only"}</FieldLabel><Input id="account-reference" key={walletKind} name="reference" placeholder={walletKind==="upi"?"name@bank":"1234"} maxLength={walletKind==="upi"?100:4} pattern={walletKind==="card"?"[0-9]{4}":undefined} required autoComplete="off" aria-describedby="reference-help" /><FieldDescription id="reference-help" className="text-xs">Never enter a UPI PIN, complete card number, CVV or OTP.</FieldDescription></Field><Button type="submit" disabled={busy}>Save masked reference</Button></FieldGroup></form>}
        {modal==="token"&&<><Textarea className="min-h-28 break-all font-mono text-xs" aria-label="Agent credential" readOnly value={token} /><Button onClick={()=>action(async()=>{await navigator.clipboard.writeText(token);setNotice("Credential copied. Paste it into the local plugin setup prompt.");})}><Copy />Copy credential</Button><p className="text-xs leading-5 text-muted-foreground">Access is restricted to this account and agent. Rotate the credential to invalidate it.</p></>}
        {modal==="intent"&&intent&&<><dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">{[["Merchant",intent.merchant],["Total",money(intent.amount)],["Status",intent.status],["Payment evidence",intent.evidenceSource||"No payment confirmed"],["Authorization expiry",new Date(intent.expiresAt).toLocaleString()],["Request ID",intent.requestId]].map(([label,value])=><div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="break-all">{value}</dd></div>)}</dl>{intent.proof&&<Button disabled={busy} onClick={()=>action(async()=>{const r=await api("verify",{payload:intent.proof!.payload,signature:intent.proof!.signature});setVerification(`${r.authorized?"Current authority valid":"Not currently authorized"}. ${r.reason}`);})}><ShieldCheck />Verify current authority</Button>}{verification&&<Message>{verification}</Message>}{intent.status==="authorized"&&<Button variant="outline" className="h-auto whitespace-normal py-2" disabled={busy} onClick={()=>action(async()=>{await api("cancel",{intentId:intent.id,confirmNoPayment:true});setModal(null);await refresh();})}>Confirm no payment occurred & release reservation</Button>}<p className="text-xs leading-5 text-muted-foreground">Releasing a reservation does not cancel an order or payment at the merchant.</p></>}
        {error&&<Message error>{error}</Message>}{notice&&<p role="status" className="text-xs text-muted-foreground">{notice}</p>}
      </DialogContent>
    </Dialog>
  </>;
}
