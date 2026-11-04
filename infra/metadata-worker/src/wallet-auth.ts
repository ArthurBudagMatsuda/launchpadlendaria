import { getAddressEncoder, address } from "@solana/kit";
import {
  UPLOAD_CHALLENGE_TTL,
  uploadChallengeMessage,
  type UploadChallenge,
} from "../../../src/lib/meteora/upload-challenge";

export interface NonceStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  transaction<T>(operation: (txn: NonceStorage) => Promise<T>): Promise<T>;
}
export interface WalletAuthConfig {
  UPLOAD_AUTH_MODE?: string;
  WALLET_AUTH_TESTERS?: string;
  UPLOAD_NONCES?: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Promise<Response> };
  };
}
export function walletBytes(value: string): Uint8Array | null {
  try {
    return new Uint8Array(getAddressEncoder().encode(address(value)));
  } catch {
    return null;
  }
}
export function approvedWallets(env: WalletAuthConfig) {
  const entries = (env.WALLET_AUTH_TESTERS ?? "")
    .split(",")
    .map((v) => v.trim());
  if (
    !entries.length ||
    entries.length > 8 ||
    entries.some((v) => !walletBytes(v))
  )
    return [];
  return [...new Set(entries)];
}
export function walletAuthConfigured(env: WalletAuthConfig) {
  return (
    env.UPLOAD_AUTH_MODE === "wallet-devnet" &&
    !!env.UPLOAD_NONCES &&
    approvedWallets(env).length > 0
  );
}
export function nonceRequest(
  env: WalletAuthConfig,
  wallet: string,
  action: string,
  body: unknown,
) {
  const id = env.UPLOAD_NONCES!.idFromName(`devnet:${wallet}`);
  return env.UPLOAD_NONCES!.get(id).fetch(
    new Request(`https://nonce.internal/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}
const result = (status: number, value: unknown) =>
  Response.json(value, { status, headers: { "cache-control": "no-store" } });
interface StoredChallenge {
  challenge: UploadChallenge;
  used: boolean;
}
interface NonceState {
  pending: StoredChallenge[];
  day: number;
  uploads: number;
}

/** SQLite-backed Durable Object. The binding is private, never a public route.
 * All origins for a wallet share this object. KV is not used for nonce state.
 */
export class UploadNonceCoordinator {
  constructor(private readonly ctx: { storage: NonceStorage }) {}
  async fetch(request: Request) {
    if (request.method !== "POST")
      return result(405, { error: "POST required" });
    const path = new URL(request.url).pathname;
    if (!["/issue", "/consume"].includes(path))
      return result(404, { error: "not found" });
    const body = (await request.json()) as Record<string, unknown>;
    const now = Date.now();
    if (path === "/issue") {
      const { wallet, origin, uploadUri, bodySha256 } = body;
      if (
        typeof wallet !== "string" ||
        !walletBytes(wallet) ||
        typeof origin !== "string" ||
        typeof uploadUri !== "string" ||
        typeof bodySha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(bodySha256)
      )
        return result(400, { error: "invalid challenge" });
      return this.ctx.storage.transaction(async (txn) => {
        const state = await this.state(txn, now);
        if (state.uploads >= 10)
          return result(429, { error: "tester daily upload limit reached" });
        const existing = state.pending.find(
          (p) =>
            !p.used &&
            p.challenge.origin === origin &&
            p.challenge.uploadUri === uploadUri &&
            p.challenge.bodySha256 === bodySha256,
        );
        if (existing)
          return result(200, {
            ...existing.challenge,
            message: uploadChallengeMessage(existing.challenge),
          });
        if (state.pending.length >= 8)
          return result(429, {
            error: "too many pending challenges; wait two minutes",
          });
        const nonce = [...crypto.getRandomValues(new Uint8Array(32))]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const challenge: UploadChallenge = {
          wallet,
          origin,
          uploadUri,
          bodySha256,
          nonce,
          issuedAt: now,
          expiresAt: now + UPLOAD_CHALLENGE_TTL,
        };
        state.pending.push({ challenge, used: false });
        await txn.put("state", state);
        return result(200, {
          ...challenge,
          message: uploadChallengeMessage(challenge),
        });
      });
    }
    const { wallet, origin, uploadUri, nonce, bodySha256, signature } = body;
    if (
      typeof wallet !== "string" ||
      typeof signature !== "string" ||
      !/^[a-f0-9]{128}$/.test(signature)
    )
      return result(401, { error: "invalid wallet signature" });
    const bytes = walletBytes(wallet);
    const before = await this.ctx.storage.get<NonceState>("state");
    const record = before?.pending.find((p) => p.challenge.nonce === nonce);
    if (!bytes || !record || record.challenge.expiresAt <= now)
      return result(401, { error: "challenge missing or expired" });
    const c = record.challenge;
    if (
      c.wallet !== wallet ||
      c.origin !== origin ||
      c.uploadUri !== uploadUri ||
      c.bodySha256 !== bodySha256
    )
      return result(401, { error: "challenge scope mismatch" });
    const key = await crypto.subtle.importKey(
      "raw",
      bytes as BufferSource,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const sig = Uint8Array.from(signature.match(/../g)!, (pair) =>
      parseInt(pair, 16),
    );
    if (
      !(await crypto.subtle.verify(
        "Ed25519",
        key,
        sig,
        new TextEncoder().encode(uploadChallengeMessage(c)),
      ))
    )
      return result(401, { error: "invalid wallet signature" });
    // Verification awaits crypto. Re-read and consume inside one storage transaction.
    return this.ctx.storage.transaction(async (txn) => {
      const time = Date.now();
      const state = await this.state(txn, time);
      const current = state.pending.find((p) => p.challenge.nonce === nonce);
      if (!current)
        return result(401, { error: "challenge missing or expired" });
      if (current.used) return result(409, { error: "challenge already used" });
      if (state.uploads >= 10)
        return result(429, { error: "tester daily upload limit reached" });
      current.used = true;
      state.uploads++;
      await txn.put("state", state);
      return result(200, { authorized: true });
    });
  }
  private async state(txn: NonceStorage, now: number): Promise<NonceState> {
    const day = Math.floor(now / 86_400_000);
    const previous = await txn.get<NonceState>("state");
    return {
      pending: (previous?.pending ?? []).filter(
        (p) => p.challenge.expiresAt > now,
      ),
      day,
      uploads: previous?.day === day ? previous.uploads : 0,
    };
  }
}
