import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-inter'});

export const metadata: Metadata = {
  title: "AgentPass — Authority to act",
  description:
    "Identity, payment-account bindings and spending authority for your AI agents. Connect your runtime with the AgentPass plugin.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("dark font-sans", inter.variable)}>
      <body><TooltipProvider>{children}</TooltipProvider></body>
    </html>
  );
}
