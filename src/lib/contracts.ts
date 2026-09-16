export type Rail = "upi" | "card";
export type Mode = "rehearsal" | "razorpay_test" | "razorpay_live";
export type PaymentStatus =
  | "blocked"
  | "creating_order"
  | "awaiting_checkout"
  | "paid"
  | "failed"
  | "unknown";
export interface Agent {
  id: string;
  name: string;
  description: string;
  runtime: string;
  owner: string;
  status: "active" | "revoked";
  budget: number;
  perTransaction: number;
  spent: number;
  reserved: number;
  policyVersion: number;
  bindingVersion: number;
  fundingLabel: string;
  allowedServices: string[];
  createdAt: string;
  lastSeen: string | null;
}
export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  amount: number;
  approved: boolean;
}
export interface Payment {
  id: string;
  requestId: string;
  serviceId: string;
  serviceName: string;
  amount: number;
  currency: "INR";
  rail: Rail;
  source: "Hermes" | "Dashboard";
  status: PaymentStatus;
  reason: string;
  policyVersion: number;
  bindingVersion: number;
  fundingLabel: string;
  mode: Mode;
  createdAt: string;
  updatedAt: string;
  checkoutTokenHash?: string;
  orderId?: string;
  providerPaymentId?: string;
  actualMethod?: string;
  receiptId?: string;
  result?: string;
}
export interface Activity {
  id: string;
  time: string;
  type: string;
  title: string;
  detail: string;
  paymentId?: string;
  source: string;
}
export interface Receipt {
  id: string;
  payload: Record<string, unknown>;
  signature: string;
  publicKey: string;
  algorithm: "Ed25519";
}
export interface Workspace {
  id: string;
  agent: Agent;
  payments: Payment[];
  events: Activity[];
  receipts: Receipt[];
  demo: boolean;
  createdAt: string;
}
export interface Snapshot {
  agent: Agent;
  payments: Payment[];
  events: Activity[];
  services: Service[];
  mode: Mode;
  role: "viewer" | "owner" | "demo";
  providerReady: boolean;
  storage: "postgres" | "local";
}
export const SERVICES: Service[] = [
  {
    id: "research",
    name: "Research brief",
    description: "A concise market brief for your next decision.",
    category: "Research",
    amount: 2000,
    approved: true,
  },
  {
    id: "market",
    name: "Competitor intelligence",
    description: "Compare positioning, pricing and customer segments.",
    category: "Intelligence",
    amount: 4000,
    approved: true,
  },
  {
    id: "premium",
    name: "Full industry report",
    description: "Premium data package to test the spending ceiling.",
    category: "Research",
    amount: 150000,
    approved: true,
  },
  {
    id: "unapproved",
    name: "Unverified data vendor",
    description: "An unapproved merchant to test recipient controls.",
    category: "External",
    amount: 7500,
    approved: false,
  },
];
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
