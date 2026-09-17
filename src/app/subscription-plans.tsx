"use client";

import { useState } from "react";
import { ArrowRight, Building2, Check, ChevronDown, Fingerprint, Layers3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import styles from "./subscription-plans.module.css";

const rupees = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;
const plans = [
  {
    name: "Startup", icon: Fingerprint, description: "Your first team. Clear spending rules.",
    monthly: 4999, annual: 49990, agents: "10", requests: "5,000",
    lead: "The essentials for one team",
    features: ["Agent identities & scoped credentials", "Per-agent budgets & merchant rules", "Owner approval inbox", "90-day activity history & exports", "Core MCP integration"],
    fit: "For a single team that needs per-agent spending controls and owner approvals.",
  },
  {
    name: "Business", icon: Layers3, description: "More teams. One view of spending.",
    monthly: 19999, annual: 199990, agents: "50", requests: "25,000",
    lead: "Everything in Startup, plus",
    features: ["Shared budgets across agents & teams", "Approval routing by amount or merchant", "Team roles & permissions", "Reports, alerts & standard integrations", "One-year activity history"],
    fit: "For multiple teams that need shared budgets, routed approvals and reporting.",
  },
  {
    name: "Enterprise", icon: Building2, description: "Company-wide control. Built around you.",
    monthly: null, annual: 900000, agents: "Custom", requests: "Custom",
    lead: "Everything in Business, plus",
    features: ["SSO / SAML & user provisioning", "Custom roles & separation of duties", "Multi-entity administration", "Custom integrations & retention", "Contractual support & SLA"],
    fit: "For organizations with identity, integration, retention and contractual support requirements. Implementation is scoped separately.",
  },
] as const;

const questions = [
  ["Can I subscribe to a paid plan now?", "Not yet. These are proposed packages and prices. Paid billing and several listed features are still being built. Previewing a plan does not start a subscription or change your free event trial."],
  ["What counts as an authorization request?", "The proposed allowance counts one valid, unique purchase intent evaluated against your rules, whether approved or blocked. Retries of that intent, status checks, verification, revocation and internal errors do not count again. Authorization is permission to purchase, not proof of payment."],
  ["What happens if I need more requests?", "Startup and Business are planned to offer 5,000 additional requests for ₹1,000, purchased explicitly. There are no automatic overage purchases by default. You would receive usage alerts before new requests pause; revocation and existing-request verification remain available. Packs would be valid for 12 months and used after the included monthly allowance."],
  ["How does annual billing work?", "The proposed annual Startup and Business subscriptions cost ten monthly payments, paid upfront—approximately 16.7% less than paying monthly for a year. Request allowances still reset monthly and do not roll over. Enterprise starts at ₹9 lakh per year on a negotiated contract."],
  ["Does the subscription pay for my agents’ purchases?", "No. It covers AgentPass software. Merchant purchases, model usage and external payment-provider fees are separate. Automatic UPI/card payment execution is not connected in the current build; a phone payment handoff still requires your approval in your payment app."],
  ["Can I change or cancel a paid plan?", "The planned billing experience will let owners disable renewal from their account and retain service through the paid term. Upgrades will show any prorated charge before confirmation; downgrades will take effect at renewal. Final terms will be shown before any paid subscription becomes available. Your current trial has no subscription to cancel."],
];

export default function SubscriptionPlans({ agentCount, walletCount, intentCount, onConnect }: {
  agentCount: number; walletCount: number; intentCount: number; onConnect: () => void;
}) {
  const [annual, setAnnual] = useState(false);
  const [preview, setPreview] = useState<(typeof plans)[number]>(plans[0]);
  const [open, setOpen] = useState(false);

  function previewPlan(plan: (typeof plans)[number]) {
    setPreview(plan);
    setOpen(true);
  }

  return <div className={styles.page}>
    <header className={styles.hero}>
      <span className={styles.eyebrow}>PLANS FOR EVERY STAGE</span>
      <h1>More agents. <span>The same control.</span></h1>

    </header>

    <div className={styles.planToolbar}>
      <div className={styles.billing} role="group" aria-label="Billing period">
        <Button aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly</Button>
        <Button aria-pressed={annual} onClick={() => setAnnual(true)}>Annually <span>Save 16.7%</span></Button>
      </div>
    </div>

    <div className={styles.cards}>
      {plans.map(plan => {
        const featured = plan.name === "Business";
        const enterprise = plan.monthly === null;
        return <Card key={plan.name} className={`${styles.card} ${featured ? styles.featured : ""}`}>
          <div className={styles.cardLabel}>{featured ? "RECOMMENDED FOR MULTIPLE TEAMS" : enterprise ? "FOR YOUR ORGANIZATION" : "FOR YOUR FIRST TEAM"}</div>
          <div className={styles.cardBody}>
            <div className={styles.planName}><plan.icon size={22} strokeWidth={1.6} aria-hidden="true" /><h2>{plan.name}</h2></div>
            <p className={styles.planDescription}>{plan.description}</p>
            <div className={styles.priceBlock} aria-live="polite" aria-atomic="true">
              <div className={styles.price}>{enterprise ? "Custom" : rupees(annual ? plan.annual : plan.monthly!)}{!enterprise && <span>/{annual ? "year" : "month"}</span>}</div>
              <p>{enterprise ? `From ${rupees(plan.annual)} / year · annual contract` : annual ? "Billed annually · two months saved" : "Billed monthly · per workspace"}</p>
            </div>
            <Button className={`${styles.planButton} ${featured ? styles.primary : ""}`} onClick={() => previewPlan(plan)}>Preview {plan.name} <ArrowRight size={15} aria-hidden="true" /></Button>
            <div className={styles.capacity}>
              <span><strong>{plan.agents}</strong> {enterprise ? "agent capacity" : "enabled agents"}</span>
              <span><strong>{plan.requests}</strong> {enterprise ? "request volume" : "requests / month"}</span>
            </div>
            <h3 className={styles.featureLead}>{plan.lead}</h3>
            <ul className={styles.features}>{plan.features.map(feature => <li key={feature}><Check size={15} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
          </div>
        </Card>;
      })}
    </div>



    <section className={styles.current} aria-labelledby="current-plan-title">
      <div className={styles.currentIdentity}>
        <span className={styles.currentIcon}><ShieldCheck size={22} aria-hidden="true" /></span>
        <div><div className={styles.currentLabel}>YOUR CURRENT PLAN <span>Active</span></div><h2 id="current-plan-title">Free event trial <span>₹0 charged</span></h2></div>
      </div>
      <div className={styles.currentUsage}>
        <span><strong>{agentCount}<small> / 10</small></strong>registered agents</span>
        <span><strong>{walletCount}<small> / 20</small></strong>account references</span>
        <span><strong>{intentCount}<small> / 500</small></strong>trial requests · total</span>
      </div>
      <Button variant="ghost" className={styles.textLink} onClick={onConnect}>Connect your plugin <ArrowRight size={15} aria-hidden="true" /></Button>
    </section>

    <section className={styles.faq} aria-labelledby="faq-title">
      <div><span className={styles.eyebrow}>BEFORE YOU CHOOSE</span><h2 id="faq-title">A few good questions.</h2></div>
      <div>{questions.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={17} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>
    </section>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <div className={styles.dialogBody}>
        <span className={styles.eyebrow}>PROPOSED PLAN · COMING SOON</span>
        <DialogTitle>{preview.name}</DialogTitle>
        <DialogDescription>{preview.fit}</DialogDescription>
        <div className={styles.dialogPrice}><strong>{preview.monthly === null ? `From ${rupees(preview.annual)}` : rupees(annual ? preview.annual : preview.monthly)}</strong><span>{preview.monthly === null ? "per year · annual contract" : annual ? "billed annually" : "per month · billed monthly"}</span></div>
        <p className={styles.dialogFine}>Excludes applicable taxes, merchant purchases and external provider costs. {annual && preview.monthly !== null && "Request allowances reset monthly."}</p>
        <ul className={styles.features}>{preview.features.map(feature => <li key={feature}><Check size={15} aria-hidden="true" />{feature}</li>)}</ul>
        <div className={styles.previewNotice}><ShieldCheck size={18} aria-hidden="true" /><p><strong>Your free trial stays active.</strong> Paid billing and listed upgrades are not available yet. No subscription has been started and nothing will be charged.</p></div>
        <Button className={`${styles.planButton} ${styles.primary}`} onClick={() => setOpen(false)}>Back to plans</Button>
      </div>
    </DialogContent></Dialog>
  </div>;
}
