"use client";
import { useId } from "react";
import { ArrowRight, Fingerprint, ShieldCheck, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "./theme-toggle";
export function Brand({ compact = false }: { compact?: boolean }) {
  const logoId = useId();
  return <a href="/" aria-label="AgentPass" className={compact ? "flex size-8 shrink-0 items-center justify-center" : "inline-flex items-center gap-2 text-xl font-semibold tracking-tight"}>
    {compact ? <svg viewBox="0 0 440 402" className="size-8 shrink-0" aria-hidden="true">
      <defs>
        <filter id={`${logoId}-invert`} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0" />
        </filter>
        <mask id={`${logoId}-mask`} x="0" y="0" width="440" height="402" maskUnits="userSpaceOnUse" style={{ maskType: "luminance" }}>
          <image href="/logo.png" width="440" height="402" filter={`url(#${logoId}-invert)`} />
        </mask>
      </defs>
      <rect width="440" height="402" fill="currentColor" mask={`url(#${logoId}-mask)`} />
    </svg> : <img src="/logo.png" className="size-8 shrink-0 object-contain mix-blend-multiply dark:invert dark:mix-blend-screen" alt="" />}
    {!compact && "AgentPass"}
  </a>;
}
export function Landing({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) {
  return <div className="mx-auto max-w-6xl px-5 sm:px-8">
    <header className="flex h-20 items-center justify-between gap-4"><Brand /><nav className="flex items-center gap-3"><a className="hidden text-sm text-muted-foreground sm:block" href="#how-it-works">How it works</a><ThemeToggle /><Button variant="outline" onClick={onSignIn}>Sign in</Button></nav></header>
    <main><section className="grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
      <div><Badge variant="outline">Identity & spending authority</Badge><h1 className="my-6 text-5xl leading-[1.12] font-semibold tracking-tight sm:text-6xl">Your agents.<br />Your accounts.<br /><span className="text-foreground">Your rules.</span></h1><p className="max-w-md text-base leading-7 text-muted-foreground">Give every agent an identity. Bind it to your payment accounts. Set the rules once, and keep control as your agents work.</p><Button className="mt-7" size="lg" onClick={onStart}>Create your workspace <ArrowRight /></Button></div>
      <Card className="[--card-spacing:--spacing(6)]"><CardHeader><Fingerprint className="mb-3 size-7 text-muted-foreground" /><CardTitle>One identity. Every connection.</CardTitle><CardDescription>Illustrative agent passport</CardDescription></CardHeader><CardContent className="space-y-5"><div className="flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-xl bg-muted text-xl">A</div><div><p className="font-medium">Atlas</p><p className="text-sm text-muted-foreground">Owned by you</p></div><ShieldCheck className="ml-auto size-5 text-muted-foreground" /></div><div className="rounded-lg bg-muted p-4"><p className="text-xs text-muted-foreground">Payment account</p><p className="mt-1 text-sm">Your UPI or card reference</p></div><div className="rounded-lg bg-muted p-4"><p className="text-xs text-muted-foreground">Spending policy</p><p className="mt-1 text-sm">Merchant · Amount · Authority</p></div></CardContent></Card>
    </section><section id="how-it-works" className="border-t py-12"><h2 className="mb-8 text-2xl font-medium tracking-tight">One place to manage what your agents can do.</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Register an identity","Give each agent its own credential and an owner-attested passport."],["Bind an account","Choose the account reference, allowed merchants, and spending limits."],["Authorize purchases","Check permission for a specific merchant, item, and final total."],["Keep the evidence","Review requests, track reported orders, and revoke authority."]].map(([title,detail],i)=><Card key={title}><CardHeader><CardDescription>0{i+1}</CardDescription><CardTitle>{title}</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">{detail}</CardContent></Card>)}</div></section>
    <Card className="mb-12"><CardHeader><CardTitle className="flex items-center gap-2"><Terminal className="size-5" />A plugin for the agent you already use.</CardTitle><CardDescription>AgentPass supplies identity and authorization. Your agent’s shopping tools handle the merchant.</CardDescription></CardHeader><CardFooter><Button variant="outline" onClick={onStart}>Connect an agent <ArrowRight /></Button></CardFooter></Card></main>
    <footer className="flex flex-wrap justify-between gap-4 border-t py-7 text-xs text-muted-foreground"><span>AgentPass</span><a href="https://github.com/Arkane-o7/BuildX-Buildonomics" target="_blank" rel="noreferrer">Source & setup ↗</a></footer>
  </div>;
}
