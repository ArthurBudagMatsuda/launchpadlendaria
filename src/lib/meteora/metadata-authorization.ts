import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { metadataOrigin } from "./metadata-endpoint";
import { MetadataUploadError, readMetadataBytes } from "./metadata-upload";
import {
  UPLOAD_CHALLENGE_TTL,
  uploadBodyHash,
  uploadChallengeMessage,
  type UploadChallenge,
} from "./upload-challenge";
import { matchingPublicKey } from "../solana/address";

interface SignMessageFeature {
  signMessage(
    ...inputs: { account: WalletAccount; message: Uint8Array }[]
  ): Promise<readonly { signedMessage: Uint8Array; signature: Uint8Array }[]>;
}
export function supportsUploadSigning(wallet: Wallet | null) {
  return (
    typeof (
      wallet?.features["solana:signMessage"] as SignMessageFeature | undefined
    )?.signMessage === "function"
  );
}
/** One message for exactly one body. No persistent session token or private key. */
export async function authorizeMetadataUpload(
  wallet: Wallet,
  account: WalletAccount,
  body: string,
  endpoint: string | null,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const metadata = metadataOrigin(endpoint);
  const feature = wallet.features["solana:signMessage"] as
    SignMessageFeature | undefined;
  if (
    !origin.startsWith("https://") ||
    !metadata ||
    !supportsUploadSigning(wallet) ||
    !account.chains.includes("solana:devnet") ||
    !matchingPublicKey(account.address, new Uint8Array(account.publicKey))
  )
    throw new MetadataUploadError(
      "Connect a test wallet that supports Devnet message signing.",
    );
  const bodySha256 = await uploadBodyHash(body);
  const response = await readMetadataBytes(
    fetcher,
    `${metadata}/v1/auth/challenge`,
    {
      method: "POST",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: account.address, bodySha256 }),
    },
    4096,
    signal,
  );
  if (response.status === 429)
    throw new MetadataUploadError(
      "Upload authorization limit reached. Wait before reviewing again.",
    );
  if (response.status !== 200)
    throw new MetadataUploadError(
      "This wallet is not approved for uploads, or authorization is unavailable.",
    );
  let c: UploadChallenge & { message: string };
  try {
    c = JSON.parse(new TextDecoder().decode(response.bytes));
  } catch {
    throw new MetadataUploadError(
      "The upload service returned an invalid challenge.",
    );
  }
  const now = Date.now();
  if (
    !c ||
    c.wallet !== account.address ||
    c.origin !== origin ||
    c.uploadUri !== `${metadata}/v1/metadata` ||
    c.bodySha256 !== bodySha256 ||
    typeof c.nonce !== "string" ||
    !/^[a-f0-9]{64}$/.test(c.nonce) ||
    !Number.isSafeInteger(c.issuedAt) ||
    !Number.isSafeInteger(c.expiresAt) ||
    c.issuedAt > now + 5000 ||
    c.expiresAt <= now ||
    c.expiresAt - c.issuedAt !== UPLOAD_CHALLENGE_TTL ||
    c.message !== uploadChallengeMessage(c)
  )
    throw new MetadataUploadError(
      "The upload challenge does not match this wallet, site or token.",
    );
  if (signal?.aborted)
    throw new MetadataUploadError("Upload authorization canceled.");
  const message = new TextEncoder().encode(c.message);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let output;
  try {
    [output] = await Promise.race([
      feature!.signMessage({ account, message }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), 60_000);
      }),
    ]);
  } catch {
    throw new MetadataUploadError(
      "Message signing was rejected or timed out. No launch was sent.",
    );
  } finally {
    clearTimeout(timer);
  }
  if (signal?.aborted || Date.now() >= c.expiresAt)
    throw new MetadataUploadError(
      "Upload authorization canceled or expired. Review again.",
    );
  if (
    !output ||
    output.signature?.length !== 64 ||
    output.signedMessage?.length !== message.length ||
    !message.every((b, i) => output.signedMessage[i] === b)
  )
    throw new MetadataUploadError(
      "The wallet did not sign the requested upload message.",
    );
  const key = await crypto.subtle.importKey(
    "raw",
    account.publicKey as BufferSource,
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "Ed25519",
      key,
      output.signature as BufferSource,
      message,
    ))
  )
    throw new MetadataUploadError(
      "The upload signature does not match the connected account.",
    );
  return {
    "x-retry-wallet": account.address,
    "x-retry-nonce": c.nonce,
    "x-retry-signature": [...output.signature]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  };
}
