const NOTIFICATIONS_KEY = "agentguard:notifications-enabled";

export function notificationsEnabled(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  try {
    return window.localStorage.getItem(NOTIFICATIONS_KEY) === "1" && Notification.permission === "granted";
  } catch {
    return false;
  }
}

export async function enableNotifications(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  try {
    const permission = await Notification.requestPermission();
    const enabled = permission === "granted";
    window.localStorage.setItem(NOTIFICATIONS_KEY, enabled ? "1" : "0");
    return enabled;
  } catch {
    return false;
  }
}

export function notifyTransaction(status: "confirmed" | "reverted", hash: string): void {
  if (!notificationsEnabled()) return;
  const notifiedKey = `agentguard:notified:${hash.toLowerCase()}:${status}`;
  try {
    if (window.localStorage.getItem(notifiedKey) === "1") return;
    new Notification(status === "confirmed" ? "AgentGuard payment confirmed" : "AgentGuard transaction reverted", {
      body: `${hash.slice(0, 10)}…${hash.slice(-6)} is ${status} on BOT Testnet.`,
      icon: "/icon.png",
      tag: `agentguard:${hash}:${status}`,
    });
    window.localStorage.setItem(notifiedKey, "1");
  } catch {
    // Notifications are optional and must never interrupt the payment flow.
  }
}
