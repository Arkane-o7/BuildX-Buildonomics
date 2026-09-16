export interface OwnerAccount {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  subscription: { plan: "event_trial"; status: "trial"; billingConnected: false };
  agents: ManagedAgent[];
  wallets: WalletBinding[];
  intents: PurchaseIntent[];
  events: ControlEvent[];
}
export interface ManagedAgent {
  id: string;
  name: string;
  runtime: string;
  status: "active" | "revoked";
  walletId: string | null;
  bindingVersion: number;
  policyVersion: number;
  budget: number;
  perPurchase: number;
  allowedMerchants: string[];
  spent: number;
  reserved: number;
  tokenHash: string;
  createdAt: string;
  lastSeen: string | null;
}
export interface WalletBinding {
  id: string;
  label: string;
  kind: "upi" | "card";
  maskedReference: string;
  connection: "reference_only";
  createdAt: string;
}
export interface PurchaseIntent {
  id: string;
  requestId: string;
  agentId: string;
  walletId: string | null;
  bindingVersion: number;
  policyVersion: number;
  item: string;
  url: string;
  merchant: string;
  amount: number;
  currency: "INR";
  status: "authorized" | "blocked" | "reported" | "cancelled";
  reason: string;
  createdAt: string;
  expiresAt: string;
  orderReference?: string;
  evidenceSource?: "agent_report" | "owner_report";
  proof?: SignedRecord;
}
export interface SignedRecord { payload: Record<string, unknown>; signature: string; publicKey: string; algorithm: "Ed25519" }
export interface ControlEvent { id: string; time: string; type: string; detail: string; agentId?: string }
export type PublicAccount = Omit<OwnerAccount, "agents"> & { agents: Omit<ManagedAgent, "tokenHash">[] };
