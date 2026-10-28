import { Buffer } from "buffer";
import { PublicKey, type AccountInfo } from "@solana/web3.js";
import type { MeteoraContext } from "./client";
import { METAPLEX_PROGRAM } from "./programs";

/** Metaplex Token Metadata limits, enforced by the program. */
export const MAX_NAME = 32,
  MAX_SYMBOL = 10,
  MAX_URI = 200;

export interface OnchainMetadata {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  /** Holder of the Metaplex update authority; edits need isMutable too. */
  updateAuthority: string;
  isMutable: boolean;
}

export function metadataAddress(mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METAPLEX_PROGRAM.toBuffer(), mint.toBuffer()],
    METAPLEX_PROGRAM,
  )[0];
}

/**
 * Decode the head of a Metaplex Metadata account: key, update authority,
 * mint, name, symbol, uri, seller fee, creators, primary sale, is_mutable.
 * Returns null for anything that is not a v1 Metadata account for `mint`.
 */
export function decodeMetadata(
  mint: PublicKey,
  info: AccountInfo<Buffer> | null,
): OnchainMetadata | null {
  if (!info || !info.owner.equals(METAPLEX_PROGRAM)) return null;
  const data = info.data;
  try {
    if (data[0] !== 4) return null; // Key::MetadataV1
    let offset = 1;
    const updateAuthority = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const owner = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    if (!owner.equals(mint)) return null;
    const text = (max: number) => {
      const length = data.readUInt32LE(offset);
      if (length > max + 4) throw new Error("Invalid string length.");
      offset += 4;
      const value = data
        .subarray(offset, offset + length)
        .toString("utf8")
        .replace(/\0+$/, "");
      offset += length;
      return value;
    };
    const name = text(MAX_NAME);
    const symbol = text(MAX_SYMBOL);
    const uri = text(MAX_URI);
    offset += 2; // seller_fee_basis_points
    if (data[offset++] === 1) {
      const creators = data.readUInt32LE(offset);
      offset += 4 + creators * 34;
    }
    offset += 1; // primary_sale_happened
    const isMutable = data[offset] === 1;
    return {
      mint: mint.toBase58(),
      name,
      symbol,
      uri,
      updateAuthority: updateAuthority.toBase58(),
      isMutable,
    };
  } catch {
    return null;
  }
}

export async function readMetadata(
  context: MeteoraContext,
  mints: PublicKey[],
): Promise<Map<string, OnchainMetadata>> {
  const result = new Map<string, OnchainMetadata>();
  for (let i = 0; i < mints.length; i += 100) {
    const chunk = mints.slice(i, i + 100);
    const infos = await context.connection.getMultipleAccountsInfo(
      chunk.map(metadataAddress),
      "confirmed",
    );
    chunk.forEach((mint, j) => {
      const metadata = decodeMetadata(mint, infos[j]);
      if (metadata) result.set(mint.toBase58(), metadata);
    });
  }
  return result;
}

/** Off-chain fields RETRY shows. Everything is validated before display. */
export interface OffchainMetadata {
  description: string | null;
  image: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
}

/** Hosts RETRY will fetch metadata and images from. Anything else is not loaded. */
export function trustedMetadataHosts(
  env: Record<string, string | undefined> = {
    metadata: process.env.NEXT_PUBLIC_RETRY_METADATA_URL,
  },
) {
  const hosts = ["raw.githubusercontent.com"];
  if (env.metadata) {
    try {
      const url = new URL(env.metadata);
      if (url.protocol === "https:" && !url.username && !url.password)
        hosts.push(url.host);
    } catch {
      /* Invalid endpoint: nothing extra is trusted. */
    }
  }
  return hosts;
}

const GITHUB_PREFIX = "/ArthurBudagMatsuda/launchpadlendaria/";

export function isTrustedUrl(value: unknown, hosts = trustedMetadataHosts()) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (!hosts.includes(url.host)) return false;
    // GitHub hosts the repository's own Devnet test metadata only.
    return (
      url.host !== "raw.githubusercontent.com" ||
      url.pathname.startsWith(GITHUB_PREFIX)
    );
  } catch {
    return false;
  }
}

function link(value: unknown, hostnames: string[] | null) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (hostnames && !hostnames.includes(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Validate a fetched metadata JSON against the on-chain name and symbol. */
export function parseOffchainMetadata(
  json: unknown,
  onchain: Pick<OnchainMetadata, "name" | "symbol">,
  hosts = trustedMetadataHosts(),
): OffchainMetadata | null {
  if (!json || typeof json !== "object") return null;
  const data = json as Record<string, unknown>;
  if (data.name !== onchain.name || data.symbol !== onchain.symbol) return null;
  const extensions =
    data.extensions && typeof data.extensions === "object"
      ? (data.extensions as Record<string, unknown>)
      : {};
  return {
    description:
      typeof data.description === "string"
        ? data.description.slice(0, 300)
        : null,
    image: isTrustedUrl(data.image, hosts) ? (data.image as string) : null,
    website: link(extensions.website, null),
    twitter: link(extensions.twitter, ["x.com", "twitter.com"]),
    telegram: link(extensions.telegram, ["t.me"]),
  };
}

export async function fetchOffchainMetadata(
  onchain: OnchainMetadata,
  signal?: AbortSignal,
): Promise<OffchainMetadata | null> {
  if (!isTrustedUrl(onchain.uri)) return null;
  const response = await fetch(onchain.uri, {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) return null;
  const text = await response.text();
  if (text.length > 16_384) return null;
  try {
    return parseOffchainMetadata(JSON.parse(text), onchain);
  } catch {
    return null;
  }
}
