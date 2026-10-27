"use client";
import {
  ConnectWalletButton,
  SwitchNetworkButton,
  useRetryWallet,
} from "@retry/web3";
// Wallet and network context for sections that will later need a transaction
// (trade, launch). It only offers what the wallet can do today: connect and
// switch network, both started by a click. No signature or transaction.
export function WalletStatus({
  disconnectedText,
}: {
  disconnectedText: string;
}) {
  const wallet = useRetryWallet();
  const { network } = wallet;
  if (!wallet.isConnected || !wallet.address) {
    return (
      <div className="wallet-status" data-state="disconnected">
        <p>{disconnectedText}</p>
        <ConnectWalletButton align="start" />
      </div>
    );
  }
  if (network.isWrongNetwork) {
    return (
      <div
        className="wallet-status wallet-status-error"
        role="alert"
        data-state="wrong-network"
      >
        <strong>Wrong Network</strong>
        <p>{network.notice?.message}</p>
        <SwitchNetworkButton network={network} />
        {network.switchError ? (
          <p className="form-error">{network.switchError.message}</p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="wallet-status" data-state={network.scenario}>
      <dl className="detail-list">
        <div>
          <dt>Wallet</dt>
          <dd title={wallet.address}>{wallet.shortAddress}</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>
            {wallet.networkName}
            {network.walletNetwork?.isTestnet ? " · Testnet" : ""}
          </dd>
        </div>
      </dl>
      {network.scenario === "supported" && network.notice ? (
        <p>{network.notice.message}</p>
      ) : null}
    </div>
  );
}
