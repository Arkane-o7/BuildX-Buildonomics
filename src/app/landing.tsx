"use client";
import { useId } from "react";
import { ArrowRight, ArrowDown, ArrowUpRight, Terminal } from "lucide-react";
import Image from "next/image";
import styles from "./landing.module.css";
import { Button } from "@/components/ui/button";
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
  return <main className={styles.landing}>
    <section className={styles.hero} aria-labelledby="landing-title">
      <Image src="/landing-architecture.png" alt="" fill preload sizes="100vw" className={styles.artwork} />
      <div className={styles.shade} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.brand}><Brand compact /><span aria-hidden="true">AgentPass</span></div>
        <nav aria-label="Main navigation"><a className={styles.howLink} href="#how-it-works">How it works</a><button className={styles.signIn} onClick={onSignIn}>Sign in <ArrowUpRight size={15} /></button></nav>
      </header>
      <div className={styles.heroContent}>
        <h1 id="landing-title">Your agents.<br />Your accounts.<br /><span>Your rules.</span></h1>
        <p>Let your agents get to work.<br />You decide where they spend and how much.</p>
        <div className={styles.actions}><Button className={styles.startButton} onClick={onStart}>Create your workspace <ArrowRight size={17} /></Button><a href="https://github.com/Arkane-o7/BuildX-Buildonomics#development" target="_blank" rel="noreferrer" className={styles.pluginButton}><Terminal size={17} />Add plugin <ArrowUpRight size={15} /></a></div>
      </div>
      <div className={styles.heroFooter}><a href="#how-it-works" aria-label="Explore how AgentPass works"><ArrowDown size={17} /></a></div>
    </section>
    <section id="how-it-works" className={styles.workflow} aria-labelledby="workflow-title">
      <div className={styles.sectionHeading}><span className={styles.sectionLabel}>HOW IT WORKS</span><h2 id="workflow-title">Give them autonomy.<br />Keep the authority.</h2></div>
      <div className={styles.steps}>
        {[
          { title: "Give it an identity", detail: "Register your agent and connect it with its own scoped credential." },
          { title: "Set its boundaries", detail: "Choose a payment reference, allowed websites, and spending limits." },
          { title: "Stay in control", detail: "Review purchase requests, track activity, and revoke access when you need to." },
        ].map((step, index) => <article className={styles.step} key={step.title}><span className={styles.stepNumber}>0{index + 1}</span><h3>{step.title}</h3><p>{step.detail}</p></article>)}
      </div>
    </section>
    <section className={styles.connection} aria-labelledby="connection-title"><div className={styles.connectionTitle}><Terminal size={24} strokeWidth={1.5} /><div><h2 id="connection-title">Your agent. Already compatible.</h2><p>Connect Hermes or another MCP-compatible runtime.</p></div></div><button onClick={onStart}>Connect your agent <ArrowUpRight size={18} /></button></section>
    <footer className={styles.footer}><span>AgentPass</span><a href="https://github.com/Arkane-o7/BuildX-Buildonomics" target="_blank" rel="noreferrer">Source & setup <ArrowUpRight size={13} /></a></footer>
  </main>;
}
