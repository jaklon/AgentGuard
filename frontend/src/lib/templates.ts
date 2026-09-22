import { getAddress, isAddress } from "ethers";
import { isValidBotAmount } from "./amount";

export type PaymentTemplate = {
  id: string;
  name: string;
  recipient: string;
  recipient_name: string;
  amount_bot: string;
  purpose: string;
};

const keyFor = (wallet: string) => `agentguard:templates:${wallet.toLowerCase()}`;

export function loadTemplates(wallet: string): PaymentTemplate[] {
  if (!wallet || typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(keyFor(wallet)) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(validTemplate).slice(0, 20).map((template) => ({
      ...template,
      recipient: getAddress(template.recipient),
    }));
  } catch {
    return [];
  }
}

export function saveTemplate(wallet: string, template: Omit<PaymentTemplate, "id">): PaymentTemplate[] {
  if (!wallet || !validTemplate({ ...template, id: "pending" })) return loadTemplates(wallet);
  const next: PaymentTemplate = {
    ...template,
    id: crypto.randomUUID(),
    name: template.name.trim().slice(0, 64),
    recipient: getAddress(template.recipient),
    recipient_name: template.recipient_name.trim().slice(0, 64),
    purpose: template.purpose.trim().slice(0, 160),
  };
  const current = loadTemplates(wallet).filter((item) => !(
    item.recipient.toLowerCase() === next.recipient.toLowerCase() &&
    item.amount_bot === next.amount_bot &&
    item.purpose.toLocaleLowerCase() === next.purpose.toLocaleLowerCase()
  ));
  const result = [next, ...current].slice(0, 20);
  window.localStorage.setItem(keyFor(wallet), JSON.stringify(result));
  return result;
}

export function removeTemplate(wallet: string, id: string): PaymentTemplate[] {
  const result = loadTemplates(wallet).filter((item) => item.id !== id);
  if (typeof window !== "undefined") window.localStorage.setItem(keyFor(wallet), JSON.stringify(result));
  return result;
}

function validTemplate(value: unknown): value is PaymentTemplate {
  if (!value || typeof value !== "object") return false;
  const item = value as PaymentTemplate;
  return typeof item.id === "string" && typeof item.name === "string" && item.name.trim().length > 0 &&
    isAddress(item.recipient) && typeof item.recipient_name === "string" &&
    typeof item.amount_bot === "string" && isValidBotAmount(item.amount_bot) &&
    typeof item.purpose === "string";
}
