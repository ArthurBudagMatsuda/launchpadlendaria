"use client";
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { formatEther } from "viem";
import { ArrowUpRight, Check, Copy, LogOut, Wallet } from "lucide-react";
import { useApp } from "@/components/providers";
import { useMounted } from "@/hooks/use-mounted";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { isSupportedChain, supportedChains } from "@/config/networks";
import { shorten } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
export function WalletButton() {
  const { setWalletOpen } = useApp();
  const { address, isConnected } = useConnection();
  const mounted = useMounted();
  return (
    <Button className="wallet-button" onClick={() => setWalletOpen(true)}>
      <Wallet size={16} />
      <span>
        {mounted && isConnected && address
          ? shorten(address)
          : "Connect Wallet"}
      </span>
    </Button>
  );
}
export function WalletMenu() {
  const {
    walletOpen,
    setWalletOpen,
    selectedChainId,
    setSelectedChainId,
    notify,
  } = useApp();
  const { address, isConnected, chain, chainId } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const balance = useWalletBalance();
  async function chooseNetwork(id: number) {
    if (isConnected) {
      try {
        await switchChain.mutateAsync({ chainId: id });
        setSelectedChainId(id);
        notify("Network updated.");
      } catch {
        notify(
          "Network switch was declined or unavailable. Try switching in your wallet.",
          true,
        );
      }
    } else setSelectedChainId(id);
  }
  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      notify("Wallet address copied.");
    } catch {
      notify(
        "Clipboard unavailable. Select and copy your address manually.",
        true,
      );
    }
  }
  return (
    <Modal
      open={walletOpen}
      onOpenChange={setWalletOpen}
      title={isConnected ? "Your wallet" : "Connect your wallet"}
      description="Your wallet, your keys. RETRY only requests a connection in this preview."
    >
      <div className="label-row">
        <span className="eyebrow">NETWORK</span>
        <span className="tiny muted">ETH · Base only</span>
      </div>
      <div className="segmented">
        {supportedChains.map((c) => (
          <button
            key={c.id}
            disabled={switchChain.isPending}
            aria-pressed={(isConnected ? chainId : selectedChainId) === c.id}
            className={
              (isConnected ? chainId : selectedChainId) === c.id ? "active" : ""
            }
            onClick={() => chooseNetwork(c.id)}
          >
            {c.name}
            {c.testnet ? " · Testnet" : ""}
          </button>
        ))}
      </div>
      {isConnected && address ? (
        <>
          <div className="wallet-details">
            <div className="wallet-orb">
              <Wallet size={30} />
            </div>
            <h3>{shorten(address)}</h3>
            <p className="address-full">{address}</p>
            <p className="muted">
              {chain?.name ?? `Unsupported network (${chainId})`}
            </p>
            <strong>
              {!isSupportedChain(chainId)
                ? "Switch to a Base network"
                : balance.isPending
                  ? "Reading balance…"
                  : balance.isError
                    ? "Balance unavailable — RPC error"
                    : balance.data
                      ? `${Number(formatEther(balance.data.value)).toFixed(5)} ETH`
                      : "Balance unavailable"}
            </strong>
          </div>
          {!isSupportedChain(chainId) ? (
            <p className="form-error" role="alert">
              This network is unsupported. Select Base Sepolia or Base above.
            </p>
          ) : null}
          <div className="two-buttons">
            <Button variant="secondary" onClick={copy}>
              <Copy size={15} />
              Copy address
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                disconnect.mutate({});
                setWalletOpen(false);
                notify("Wallet disconnected.");
              }}
            >
              <LogOut size={15} />
              Disconnect
            </Button>
          </div>
        </>
      ) : (
        <div className="connector-list">
          {connectors.map((c) => (
            <button
              key={c.uid}
              disabled={connect.isPending}
              onClick={async () => {
                try {
                  const provider = await c.getProvider();
                  if (c.type === "injected" && !provider) {
                    notify(
                      "No browser wallet found. Install an EVM wallet such as MetaMask, then refresh.",
                      true,
                    );
                    return;
                  }
                  await connect.mutateAsync({
                    connector: c,
                    chainId: selectedChainId,
                  });
                  notify("Wallet connected.");
                } catch {
                  notify(
                    "Connection declined or unavailable. Unlock your wallet and try again.",
                    true,
                  );
                }
              }}
            >
              <span
                className={`connector-icon ${c.id === "coinbaseWalletSDK" ? "coinbase" : ""}`}
              >
                <Wallet size={21} />
              </span>
              <span>
                <strong>
                  {c.type === "injected" ? "Browser wallet" : c.name}
                </strong>
                <small>
                  {c.type === "injected"
                    ? "MetaMask, Rabby & other EVM wallets"
                    : c.name === "WalletConnect"
                      ? "Connect with a QR code"
                      : "Connect your Coinbase Wallet"}
                </small>
              </span>
              {connect.isPending ? (
                <span className="tiny">Waiting…</span>
              ) : (
                <ArrowUpRight size={18} />
              )}
            </button>
          ))}
          {!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ? (
            <p className="tiny muted">
              WalletConnect is available after a project ID is configured.
            </p>
          ) : null}
        </div>
      )}
      <p className="wallet-note">
        <Check size={14} />
        No transaction or signature requested.
      </p>
    </Modal>
  );
}
