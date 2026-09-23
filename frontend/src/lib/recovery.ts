export type RecoveryIssueKind = "wallet_rejected" | "network" | "balance" | "rpc" | "wallet" | "unknown";

export type RecoveryIssue = {
  kind: RecoveryIssueKind;
  message: string;
  occurred_at: string;
};

export function recoveryIssue(reason: unknown, fallback = "The wallet or network request failed."): RecoveryIssue {
  const value = reason as { code?: number | string; message?: string; shortMessage?: string } | null;
  const message = reason instanceof Error
    ? reason.message
    : value?.shortMessage || value?.message || fallback;
  const normalized = String(message);
  const code = value?.code;

  let kind: RecoveryIssueKind = "unknown";
  if (code === 4001 || code === "ACTION_REJECTED" || /reject|denied|cancel/i.test(normalized)) {
    kind = "wallet_rejected";
  } else if (/chain|network|switch/i.test(normalized)) {
    kind = "network";
  } else if (/balance|funds|gas/i.test(normalized)) {
    kind = "balance";
  } else if (/rpc|unavailable|timeout|fetch|network request/i.test(normalized)) {
    kind = "rpc";
  } else if (/wallet|account|provider|signature/i.test(normalized)) {
    kind = "wallet";
  }

  return { kind, message: normalized, occurred_at: new Date().toISOString() };
}
