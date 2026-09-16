import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
