export type Decision = "ALLOW" | "WARN" | "BLOCK";

export interface PaymentIntent {
  action: "payment";
  recipient: string;
  amount_bot: string;
  chain_id: number;
  purpose: string;
}

export interface PolicySnapshot {
  wallet: string;
  chain_id: number;
  per_transaction_limit_bot: string;
  daily_limit_bot: string;
  spent_today_bot: string;
  expires_at: string | null;
  allowlist_enforced: boolean;
  allowed_recipients: string[];
  paused: boolean;
}

export interface GuardDecision {
  decision: Decision;
  risk_score: number;
  reason: string;
  intent: PaymentIntent | null;
  warnings: string[];
  source: "openai" | "deterministic" | "manual";
  transaction_hash: null;
  evaluated_at: string;
}

export interface Simulation {
  allowed: boolean;
  reason: string;
  estimated_gas: number | null;
}
