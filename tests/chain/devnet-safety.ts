import { getBase58Encoder } from "@solana/kit";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

export const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const INVALID_KEY =
  "Invalid RETRY_DEVNET_FUNDER: use a disposable 64-byte JSON array or base58 key.";

/** Never include a parser exception: JSON errors can echo secret input. */
export function parseDevnetFunder(
  mode: string,
  genesis: string,
  value: string | null,
) {
  if (mode !== "local" && mode !== "devnet")
    throw new Error("Only local and devnet chain modes are allowed.");
  if (mode === "local") return null;
  if (genesis !== DEVNET_GENESIS)
    throw new Error("The funder key is only ever used on Devnet.");
  if (!value?.trim())
    throw new Error(
      "RETRY_DEVNET_FUNDER is required for public Devnet tests; no faucet fallback.",
    );
  try {
    const text = value.trim();
    let secret: Uint8Array;
    if (text.startsWith("[")) {
      const bytes: unknown = JSON.parse(text);
      if (
        !Array.isArray(bytes) ||
        bytes.length !== 64 ||
        bytes.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
      )
        throw new Error(INVALID_KEY);
      secret = Uint8Array.from(bytes);
    } else {
      secret = Uint8Array.from(getBase58Encoder().encode(text));
    }
    if (secret.length !== 64) throw new Error(INVALID_KEY);
    return Keypair.fromSecretKey(secret);
  } catch {
    throw new Error(INVALID_KEY);
  }
}

/** A limit on gross transfers from the funder, not a promise of net cost. */
export function devnetBudget(value = "2") {
  if (!/^\d+(?:\.\d{1,9})?$/.test(value))
    throw new Error("Invalid Devnet funding budget.");
  const lamports = Math.round(Number(value) * LAMPORTS_PER_SOL);
  if (
    !Number.isSafeInteger(lamports) ||
    lamports < 1_400_020_000 ||
    lamports > 12 * LAMPORTS_PER_SOL
  )
    throw new Error(
      "Devnet funding budget must be between 1.40002 and 12 test SOL.",
    );
  return lamports;
}

export function reserveDevnetFunding(
  alreadySent: number,
  lamports: number,
  budget: number,
) {
  if (
    !Number.isSafeInteger(lamports) ||
    lamports <= 0 ||
    alreadySent + lamports > budget
  )
    throw new Error("Devnet funding budget exceeded; no transfer sent.");
  return alreadySent + lamports;
}
