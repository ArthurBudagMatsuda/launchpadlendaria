import { DynamicBondingCurveIdl } from "./sdk";
import { QuoteError } from "./quotes";
import { SimulationError, TransactionValidationError } from "./transactions";
import { PoolValidationError } from "./pools";

const DBC_ERRORS = new Map<number, string>(
  DynamicBondingCurveIdl.errors.map((error) => [error.code, error.name]),
);

/** Plain-language messages for the DBC errors a RETRY user can hit. */
const MESSAGES: Record<string, string> = {
  ExceededSlippage:
    "The price moved beyond your slippage limit, so nothing was traded. Review the new quote.",
  ExceededInputAmount:
    "The price moved beyond your limit, so nothing was traded.",
  PoolIsCompleted:
    "The curve just completed. This token is waiting to graduate.",
  PoolIsIncompleted: "The curve is not complete yet.",
  NotEnoughLiquidity: "Not enough liquidity in the curve for this amount.",
  InsufficientLiquidity: "Not enough liquidity in the curve for this amount.",
  AmountIsZero: "This amount is too small to trade.",
  NotPermitToDoThisAction:
    "This action is not available for the pool right now.",
  InsufficientLiquidityForMigration: "The pool cannot graduate yet.",
};

function programErrorCode(text: string) {
  // {"InstructionError":[n,{"Custom":6002}]} or "custom program error: 0x1772"
  const custom = /"Custom":(\d+)/.exec(text);
  if (custom) return Number(custom[1]);
  const hex = /custom program error: 0x([0-9a-f]+)/i.exec(text);
  return hex ? parseInt(hex[1], 16) : null;
}

function fromLogs(logs: string[]) {
  for (const line of logs) {
    const named = /Error Code: (\w+)/.exec(line);
    if (named) return named[1];
  }
  return null;
}

/**
 * Turn anything an operation throws into one sentence for the user. Raw RPC
 * and program text never reaches the UI; the full error stays in the console
 * of whoever is debugging.
 */
export function userMessage(error: unknown): string {
  if (error instanceof QuoteError || error instanceof PoolValidationError)
    return error.message;
  if (error instanceof TransactionValidationError)
    return `RETRY stopped this transaction before signing: ${error.message}`;
  const text =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (/reject|denied|cancel|declined|user aborted/i.test(text))
    return "You cancelled the request in your wallet. Nothing was sent.";
  const logs = error instanceof SimulationError ? error.logs : [];
  const name =
    fromLogs(logs) ??
    (() => {
      const code = programErrorCode(text);
      return code == null ? null : (DBC_ERRORS.get(code) ?? null);
    })();
  if (name && MESSAGES[name]) return MESSAGES[name];
  if (
    /insufficient (funds|lamports)|"InsufficientFundsForRent"|AccountNotFound|Attempt to debit an account but found no record/i.test(
      text,
    )
  )
    return "Not enough SOL for this transaction and its network fee.";
  if (/blockhash not found|block height exceeded|expired/i.test(text))
    return "The transaction expired before it was confirmed. Nothing was spent; try again.";
  if (/cluster does not match/i.test(text))
    return "Your RPC answers for a different Solana cluster. Nothing was sent.";
  if (/Mainnet execution is locked/i.test(text))
    return "Launching and trading on Mainnet are locked in this version.";
  if (
    /429|Too Many Requests|fetch failed|NetworkError|Failed to fetch|timeout/i.test(
      text,
    )
  )
    return "The Solana RPC did not answer. Nothing was sent; try again in a moment.";
  if (error instanceof SimulationError)
    return "The network simulation rejected this transaction, so it was not sent.";
  return "Something went wrong. Nothing was sent unless your wallet shows a signature.";
}
