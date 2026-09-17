"use client";
import { ArrowUpRight, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SidebarMenuButton } from "@/components/ui/sidebar";
export function ConnectPhone() {
  return <Dialog>
    <DialogTrigger render={<SidebarMenuButton tooltip="Connect phone" />}><Smartphone /><span>Connect phone</span></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader><div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-muted"><Smartphone className="size-5" /></div><DialogTitle>Get AgentPass on your phone</DialogTitle><DialogDescription>Scan to sign in and receive payment requests.</DialogDescription></DialogHeader>
      <div className="mx-auto rounded-xl bg-white p-4"><img src="/connect-phone-qr.svg" width={224} height={224} alt="QR code for AgentPass mobile sign-in" /></div>
      <p className="text-center text-sm text-muted-foreground">Sign into the <strong className="font-medium text-foreground">same account</strong>, then enable notifications on your phone.</p>
      <Button render={<a href="https://agentpass-buildx.vercel.app/phone" />}>Open mobile sign-in <ArrowUpRight /></Button>
      <p className="text-center text-xs text-muted-foreground">agentpass-buildx.vercel.app/phone</p>
    </DialogContent>
  </Dialog>;
}
