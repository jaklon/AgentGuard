import { formatUnits, parseUnits } from "ethers";

const BOT_AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,17})(?:\.\d{1,18})?$/;

export function botAmountWei(value: string): bigint | null {
  if (!BOT_AMOUNT_PATTERN.test(value)) return null;
  try {
    const wei = parseUnits(value, 18);
    return wei > BigInt(0) ? wei : null;
  } catch {
    return null;
  }
}

export function isValidBotAmount(value: string): boolean {
  return botAmountWei(value) !== null;
}

export function sameBotAmount(left: string, right: string): boolean {
  const leftWei = botAmountWei(left);
  const rightWei = botAmountWei(right);
  return leftWei !== null && rightWei !== null && leftWei === rightWei;
}

export function formatBotWei(value: bigint): string {
  const formatted = formatUnits(value, 18);
  return formatted.includes(".") ? formatted.replace(/0+$/, "").replace(/\.$/, "") : formatted;
}
