"use client";

import { useRef } from "react";
import { ArrowUpRight, Smartphone, X } from "lucide-react";
import styles from "./connect-phone.module.css";

const phoneUrl = "https://agentpass-buildx.vercel.app/phone";

export function ConnectPhone() {
  const dialog = useRef<HTMLDialogElement>(null);

  return <>
    <button className="nav-item" title="Connect phone" aria-label="Connect phone" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
      <Smartphone size={18} /><span>Connect phone</span>
    </button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="connect-phone-title" aria-describedby="connect-phone-description" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className={styles.content}>
        <button className={`icon-button ${styles.close}`} aria-label="Close phone setup" onClick={() => dialog.current?.close()}><X size={20} /></button>
        <span className={styles.icon}><Smartphone size={24} /></span>
        <h2 id="connect-phone-title">Get AgentPass<br />on your phone.</h2>
        <p id="connect-phone-description">Scan with your phone’s camera to sign in and receive payment requests.</p>
        <div className={styles.qr}><img src="/connect-phone-qr.svg" width={224} height={224} alt="QR code linking to the AgentPass mobile sign-in page" /></div>
        <p className={styles.steps}>Sign into the <strong>same account</strong>, then enable notifications on your phone.</p>
        <a className="button primary" href={phoneUrl}>Open mobile sign-in <ArrowUpRight size={16} /></a>
        <span className={styles.address}>agentpass-buildx.vercel.app/phone</span>
      </div>
    </dialog>
  </>;
}
