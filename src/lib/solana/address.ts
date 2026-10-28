import { address, getAddressEncoder, type Address } from "@solana/kit";
export type SolanaAddress = Address;
export function parseAddress(value: unknown): Address | null {
  if (typeof value !== "string") return null;
  try {
    return address(value);
  } catch {
    return null;
  }
}
export function matchingPublicKey(
  value: unknown,
  key: Uint8Array,
): value is Address {
  const parsed = parseAddress(value);
  if (!parsed || key.length !== 32) return false;
  const bytes = getAddressEncoder().encode(parsed);
  return bytes.every((byte, i) => byte === key[i]);
}
export const LAMPORTS_PER_SOL = 1_000_000_000n;
export function formatSol(lamports: bigint, places = 9) {
  if (lamports < 0n || !Number.isInteger(places) || places < 0 || places > 9)
    throw new Error("Invalid balance.");
  const fraction = (lamports % LAMPORTS_PER_SOL)
    .toString()
    .padStart(9, "0")
    .slice(0, places)
    .replace(/0+$/, "");
  return `${lamports / LAMPORTS_PER_SOL}${fraction ? `.${fraction}` : ""}`;
}
