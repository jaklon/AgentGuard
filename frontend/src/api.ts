import type { GuardDecision, PaymentIntent, PolicySnapshot, Simulation } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE + path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body?.detail?.message ??
      body?.detail?.[0]?.msg ??
      "Request failed with status " + response.status;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function fetchPolicy(wallet: string): Promise<PolicySnapshot> {
  return request<PolicySnapshot>("/botchain/policy/" + wallet);
}

export function evaluateGuard(payload: {
  prompt?: string;
  manual_intent?: PaymentIntent;
  policy: PolicySnapshot;
}): Promise<GuardDecision> {
  return request<GuardDecision>("/guard/evaluate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function simulatePayment(payload: {
  wallet: string;
  recipient: string;
  amount_bot: string;
  intent_hash: string;
}): Promise<Simulation> {
  return request<Simulation>("/botchain/simulate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
