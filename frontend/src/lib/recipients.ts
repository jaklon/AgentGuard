import { getAddress, isAddress } from "ethers";

export type SavedRecipient = { name: string; address: string };

const keyFor = (wallet: string) => `agentguard:recipients:${wallet.toLowerCase()}`;

function validRecipient(value: unknown): value is SavedRecipient {
  if (!value || typeof value !== "object") return false;
  const recipient = value as SavedRecipient;
  return typeof recipient.name === "string" && recipient.name.trim().length > 0 && recipient.name.trim().length <= 64 && typeof recipient.address === "string" && isAddress(recipient.address);
}

export function loadRecipients(wallet: string, allowedAddresses: string[]): SavedRecipient[] {
  if (!wallet || typeof window === "undefined") return [];
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(keyFor(wallet)) || "[]");
    if (!Array.isArray(stored)) return [];
    const allowed = new Set(allowedAddresses.map((address) => getAddress(address).toLowerCase()));
    const seen = new Set<string>();
    return stored.filter(validRecipient).map((recipient) => ({ name: recipient.name.trim(), address: getAddress(recipient.address) })).filter((recipient) => {
      const name = recipient.name.toLocaleLowerCase();
      if (!allowed.has(recipient.address.toLowerCase()) || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  } catch {
    return [];
  }
}

export function saveRecipient(wallet: string, recipient: SavedRecipient): void {
  if (!wallet || typeof window === "undefined" || !validRecipient(recipient)) return;
  const current = loadStored(wallet).filter((item) => item.address.toLowerCase() !== recipient.address.toLowerCase());
  const name = recipient.name.trim();
  const withoutSameName = current.filter((item) => item.name.toLocaleLowerCase() !== name.toLocaleLowerCase());
  window.localStorage.setItem(keyFor(wallet), JSON.stringify([...withoutSameName, { name, address: getAddress(recipient.address) }]));
}

export function removeRecipient(wallet: string, address: string): void {
  if (!wallet || typeof window === "undefined" || !isAddress(address)) return;
  window.localStorage.setItem(keyFor(wallet), JSON.stringify(loadStored(wallet).filter((item) => item.address.toLowerCase() !== address.toLowerCase())));
}

function loadStored(wallet: string): SavedRecipient[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(keyFor(wallet)) || "[]");
    return Array.isArray(stored) ? stored.filter(validRecipient).map((item) => ({ name: item.name.trim(), address: getAddress(item.address) })) : [];
  } catch {
    return [];
  }
}
