import { Buffer } from "buffer";
import BN from "bn.js";
import { Keypair, PublicKey, type Transaction } from "@solana/web3.js";
import { deriveDbcPoolAddress, SwapMode } from "./sdk";
import { assertCluster, assertWritable, type MeteoraContext } from "./client";
import { configMismatches, retryCurve } from "./curve";
import { isTrustedUrl, MAX_NAME, MAX_SYMBOL, MAX_URI } from "./metadata";
import { decodeConfig } from "./pools";
import { WSOL_MINT } from "./programs";
import { validateSlippage } from "./quotes";
import type { TxExpectation } from "./transactions";

/** Largest optional first buy RETRY offers (10% of the 10 SOL threshold). */
export const MAX_INITIAL_BUY_LAMPORTS = 1_000_000_000n;

export interface CreateTokenInput {
  name: string;
  symbol: string;
  /** Persistent https metadata URI (see metadata-upload.ts). */
  uri: string;
  creator: PublicKey;
  /** Optional creator buy in the same transaction; 0 for none. */
  initialBuyLamports: bigint;
  slippageBps: number;
}

export class CreateTokenError extends Error {}

export function validateCreateInput(input: CreateTokenInput) {
  const name = input.name.trim();
  if (name.length < 2 || new TextEncoder().encode(name).length > MAX_NAME)
    throw new CreateTokenError("Use a name of 2 to 32 bytes.");
  if (
    !/^[A-Z0-9]{2,10}$/.test(input.symbol) ||
    input.symbol.length > MAX_SYMBOL
  )
    throw new CreateTokenError(
      "Use a ticker of 2 to 10 uppercase letters or numbers.",
    );
  if (input.uri.length > MAX_URI || !isTrustedUrl(input.uri))
    throw new CreateTokenError(
      "Metadata must be stored on RETRY's metadata host first.",
    );
  if (
    input.initialBuyLamports < 0n ||
    input.initialBuyLamports > MAX_INITIAL_BUY_LAMPORTS
  )
    throw new CreateTokenError("The optional first buy is limited to 0–1 SOL.");
  validateSlippage(input.slippageBps);
  return { ...input, name };
}

export interface PreparedCreate {
  tx: Transaction;
  /** Fresh mint keypair. It signs once; the program revokes mint authority. */
  mint: Keypair;
  pool: PublicKey;
  expect: TxExpectation;
  /** Tokens the first buy is expected to return (raw units), if any. */
  initialBuyOut: bigint | null;
  initialBuyMinimumOut: bigint | null;
}

/**
 * Build the launch transaction: initialize the DBC pool from the RETRY config
 * (mint, metadata, vaults) and, optionally, the creator's first buy, in one
 * atomic transaction. Nothing is signed or sent here.
 */
export async function prepareCreateToken(
  context: MeteoraContext,
  raw: CreateTokenInput,
): Promise<PreparedCreate> {
  const input = validateCreateInput(raw);
  const configKey = assertWritable(context, "create");
  await assertCluster(context);
  const config = decodeConfig(
    context,
    await context.connection.getAccountInfo(configKey, "confirmed"),
  );
  const mismatches = configMismatches(config);
  if (mismatches.length || !config.quoteMint.equals(WSOL_MINT))
    throw new CreateTokenError(
      "The on-chain RETRY config does not match this app.",
    );
  const mint = Keypair.generate();
  const pool = deriveDbcPoolAddress(WSOL_MINT, mint.publicKey, configKey);
  let firstBuy = null;
  if (input.initialBuyLamports > 0n) {
    // A fresh pool sits at the config's start price, so the quote comes from
    // the config itself (the SDK's pre-pool quote).
    const quote = context.client.pool.getQuoteFromInputAmount({
      config: retryCurve(),
      swapBaseForQuote: false,
      amountIn: new BN(input.initialBuyLamports.toString()),
      swapMode: SwapMode.ExactIn,
      slippageBps: input.slippageBps,
    });
    firstBuy = {
      out: BigInt(quote.outputAmount.toString()),
      minimum: BigInt(quote.minimumAmountOut!.toString()),
    };
  }
  const tx = await context.client.creator.createPoolWithFirstBuy({
    createPoolParam: {
      baseMint: mint.publicKey,
      config: configKey,
      name: input.name,
      symbol: input.symbol,
      uri: input.uri,
      payer: input.creator,
      poolCreator: input.creator,
    },
    firstBuyParam: firstBuy
      ? {
          buyer: input.creator,
          buyAmount: new BN(input.initialBuyLamports.toString()),
          minimumAmountOut: new BN(firstBuy.minimum.toString()),
          referralTokenAccount: null,
        }
      : undefined,
  });
  tx.feePayer = input.creator;
  return {
    tx,
    mint,
    pool,
    initialBuyOut: firstBuy?.out ?? null,
    initialBuyMinimumOut: firstBuy?.minimum ?? null,
    expect: {
      owner: input.creator,
      dbc: ["initialize_virtual_pool_with_spl_token", "swap", "swap2"],
      accounts: {
        config: configKey,
        pool,
        base_mint: mint.publicKey,
        quote_mint: WSOL_MINT,
        creator: input.creator,
        payer: input.creator,
      },
      ataMints: [mint.publicKey, WSOL_MINT],
      extraSigners: [mint.publicKey],
    },
  };
}

/** Stable fingerprint of a launch request, to refuse a duplicate submit. */
export async function launchRequestId(input: {
  owner: string;
  name: string;
  symbol: string;
  uri: string;
}) {
  const bytes = new TextEncoder().encode(
    [input.owner, input.name.trim(), input.symbol, input.uri].join("\n"),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(digest).toString("hex");
}
