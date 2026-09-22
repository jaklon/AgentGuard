import type { GuardDecision, Policy } from "./botchain";

export type EvaluationActivity = {
  wallet: string;
  decision: GuardDecision;
  policy: Policy | null;
  recorded_at: string;
};

export type TransactionActivity = {
  wallet: string;
  transaction_hash: string;
  status: "pending" | "confirmed" | "reverted";
  explorer_url: string;
  block_number: number | null;
  recipient: string;
  amount_bot: string;
  purpose: string;
  submitted_at: string;
};

export type ActivityState = {
  evaluation: EvaluationActivity | null;
  transaction: TransactionActivity | null;
};

export const EMPTY_ACTIVITY: ActivityState = { evaluation: null, transaction: null };
const STORAGE_KEY = "agentguard:latest-activity";

export function loadActivity(): ActivityState {
  if (typeof window === "undefined") return EMPTY_ACTIVITY;
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null") as Partial<ActivityState> | null;
    return {
      evaluation: validEvaluation(value?.evaluation) ? value.evaluation : null,
      transaction: validTransaction(value?.transaction) ? value.transaction : null,
    };
  } catch {
    return EMPTY_ACTIVITY;
  }
}

export function saveActivity(value: ActivityState): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* Storage can be unavailable in privacy mode. */ }
}

export function clearActivity(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}

function validEvaluation(value: unknown): value is EvaluationActivity {
  if (!value || typeof value !== "object") return false;
  const item = value as EvaluationActivity;
  return /^0x[a-fA-F0-9]{40}$/.test(item.wallet) && Boolean(item.decision) && ["ALLOW", "WARN", "BLOCK"].includes(item.decision?.decision);
}

function validTransaction(value: unknown): value is TransactionActivity {
  if (!value || typeof value !== "object") return false;
  const item = value as TransactionActivity;
  return /^0x[a-fA-F0-9]{40}$/.test(item.wallet) && /^0x[a-fA-F0-9]{64}$/.test(item.transaction_hash) && ["pending", "confirmed", "reverted"].includes(item.status);
}
