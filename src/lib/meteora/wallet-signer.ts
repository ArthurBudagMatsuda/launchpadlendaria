import { PublicKey, Transaction } from "@solana/web3.js";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { CLUSTERS, type SolanaCluster } from "@/config/solana";
import type { TransactionSigner } from "./transactions";

/** Wallet Standard `solana:signTransaction` (sign only; RETRY sends). */
interface SignTransactionFeature {
  signTransaction(
    ...inputs: {
      account: WalletAccount;
      transaction: Uint8Array;
      chain?: string;
    }[]
  ): Promise<readonly { signedTransaction: Uint8Array }[]>;
}

export class WalletSignerError extends Error {}

export function supportsSigning(wallet: Wallet | null) {
  const feature = wallet?.features["solana:signTransaction"] as
    SignTransactionFeature | undefined;
  return typeof feature?.signTransaction === "function";
}

/**
 * Adapt the connected Wallet Standard account (the same wallet and account
 * the provider shows) to the web3.js v1 transactions the Meteora SDK builds.
 * The wallet only signs. RETRY sends, so it can store the signature first.
 */
export function walletSigner(
  wallet: Wallet,
  account: WalletAccount,
  cluster: SolanaCluster,
): TransactionSigner {
  const feature = wallet.features["solana:signTransaction"] as
    SignTransactionFeature | undefined;
  if (typeof feature?.signTransaction !== "function")
    throw new WalletSignerError(
      "This wallet cannot sign Solana transactions here.",
    );
  const publicKey = new PublicKey(account.publicKey);
  if (publicKey.toBase58() !== account.address)
    throw new WalletSignerError(
      "The wallet account address does not match its key.",
    );
  const chain = CLUSTERS[cluster].chain;
  return {
    publicKey,
    async signTransaction(transaction) {
      const bytes = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      const [output] = await feature.signTransaction({
        account,
        transaction: bytes,
        chain,
      });
      if (!output?.signedTransaction)
        throw new WalletSignerError(
          "The wallet returned no signed transaction.",
        );
      try {
        return Transaction.from(output.signedTransaction);
      } catch {
        throw new WalletSignerError(
          "The wallet returned a transaction RETRY cannot read.",
        );
      }
    },
  };
}
