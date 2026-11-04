/** Public, fixed-purpose message. Never a Solana transaction or a login elsewhere. */
export interface UploadChallenge {
  wallet: string;
  origin: string;
  uploadUri: string;
  bodySha256: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}
export const UPLOAD_CHALLENGE_TTL = 120_000;
export const UPLOAD_SCOPE = "retry:metadata:upload:devnet:v1";
export function uploadChallengeMessage(c: UploadChallenge) {
  return [
    "RETRY — authorize one Devnet metadata upload",
    "This message does not transfer SOL or authorize a transaction.",
    `Domain: ${new URL(c.origin).host}`,
    `Origin: ${c.origin}`,
    `URI: ${c.uploadUri}`,
    "Method: POST",
    `Scope: ${UPLOAD_SCOPE}`,
    "Cluster: solana:devnet",
    "Genesis: EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
    `Wallet: ${c.wallet}`,
    `Body SHA-256: ${c.bodySha256}`,
    `Nonce: ${c.nonce}`,
    `Issued At: ${new Date(c.issuedAt).toISOString()}`,
    `Expiration Time: ${new Date(c.expiresAt).toISOString()}`,
  ].join("\n");
}
export async function uploadBodyHash(body: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(body),
  );
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
