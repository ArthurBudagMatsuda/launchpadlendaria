"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { useQuery } from "@tanstack/react-query";
import {
  appSolanaConfig,
  CLUSTERS,
  type SolanaCluster,
  type SolanaConfig,
} from "@/config/solana";
import {
  matchingPublicKey,
  formatSol,
  type SolanaAddress,
} from "@/lib/solana/address";
import { readSolBalance } from "@/lib/solana/rpc";
const LAST_WALLET = "retry:solana:last-wallet:v1";
const EMPTY_WALLETS: readonly Wallet[] = [];
const serverWallets = () => EMPTY_WALLETS;
const registeredWallets = () => getWallets().get();
const subscribeWallets = (listener: () => void) => {
  const registry = getWallets();
  const a = registry.on("register", listener);
  const b = registry.on("unregister", listener);
  return () => {
    a();
    b();
  };
};
interface ConnectFeature {
  connect(input?: {
    silent?: boolean;
  }): Promise<{ accounts: readonly WalletAccount[] }>;
}
interface DisconnectFeature {
  disconnect(): Promise<void>;
}
interface EventsFeature {
  on(
    event: "change",
    listener: (event: { accounts?: readonly WalletAccount[] }) => void,
  ): () => void;
}
export function compatibleWallet(wallet: Wallet) {
  const feature = wallet.features["standard:connect"] as
    ConnectFeature | undefined;
  return (
    wallet.chains.some((chain) => chain.startsWith("solana:")) &&
    typeof feature?.connect === "function"
  );
}
export function selectAccount(
  accounts: readonly WalletAccount[],
  chain: string,
) {
  const valid = accounts.filter(
    (account) =>
      account.chains.some((value) => value.startsWith("solana:")) &&
      matchingPublicKey(account.address, new Uint8Array(account.publicKey)),
  );
  return (
    valid.find((account) =>
      account.chains.includes(chain as `${string}:${string}`),
    ) ?? valid[0]
  );
}
interface WalletContext {
  config: SolanaConfig | null;
  configError: string | null;
  wallets: readonly Wallet[];
  wallet: Wallet | null;
  account: WalletAccount | null;
  address: SolanaAddress | undefined;
  status: "disconnected" | "connecting" | "connected";
  error: string | null;
  supportsCluster: boolean;
  connect: (wallet: Wallet) => Promise<void>;
  disconnect: () => Promise<void>;
  cancel: () => void;
  selectCluster: (cluster: SolanaCluster) => void;
}
const Context = createContext<WalletContext | null>(null);
export function RetrySolanaProvider({
  children,
  initialConfig,
}: {
  children: ReactNode;
  initialConfig?: SolanaConfig;
}) {
  const [settings, setSettings] = useState(() => {
    try {
      return { config: initialConfig ?? appSolanaConfig(), error: null };
    } catch {
      return {
        config: null,
        error:
          "Invalid Solana configuration. Check the public cluster and RPC settings.",
      };
    }
  });
  const registered = useSyncExternalStore(
    subscribeWallets,
    registeredWallets,
    serverWallets,
  );
  const wallets = useMemo(
    () => registered.filter(compatibleWallet),
    [registered],
  );
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [status, setStatus] = useState<WalletContext["status"]>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const restored = useRef(false);
  const currentChain = settings.config
    ? CLUSTERS[settings.config.cluster].chain
    : "solana:devnet";
  const cancel = useCallback(() => {
    generation.current++;
    setStatus(wallet ? "connected" : "disconnected");
  }, [wallet]);
  const establish = useCallback(
    async (selected: Wallet, silent = false) => {
      if (!silent) restored.current = true;
      const attempt = ++generation.current;
      setError(null);
      if (!silent) setStatus("connecting");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        if (!compatibleWallet(selected))
          throw new Error("This wallet has no Solana connection support.");
        const feature = selected.features["standard:connect"] as ConnectFeature;
        const response = await Promise.race([
          feature.connect({ silent }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error("Wallet did not answer. Unlock it and try again."),
                ),
              20_000,
            );
          }),
        ]);
        if (generation.current !== attempt) return;
        const next = selectAccount(response.accounts, currentChain);
        if (!next)
          throw new Error("The wallet did not return a valid Solana account.");
        setWallet(selected);
        setAccount(next);
        setStatus("connected");
        try {
          localStorage.setItem(LAST_WALLET, selected.name);
        } catch {
          /* Storage is optional. */
        }
      } catch (cause) {
        if (generation.current !== attempt) return;
        setWallet(null);
        setAccount(null);
        setStatus("disconnected");
        if (!silent)
          setError(
            cause instanceof Error &&
              cause.message.startsWith("Wallet did not answer")
              ? cause.message
              : "Connection rejected or unavailable. Unlock your wallet and try again.",
          );
      } finally {
        clearTimeout(timer);
      }
    },
    [currentChain],
  );
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (wallet && !wallets.includes(wallet)) {
        generation.current++;
        setWallet(null);
        setAccount(null);
        setStatus("disconnected");
      }
      if (!restored.current) {
        let previous: string | null = null;
        try {
          previous = localStorage.getItem(LAST_WALLET);
        } catch {
          /* Optional. */
        }
        const selected = wallets.find((item) => item.name === previous);
        if (selected) {
          restored.current = true;
          void establish(selected, true);
        }
      }
    });
    return () => {
      active = false;
    };
  }, [establish, wallet, wallets]);
  useEffect(
    () => () => {
      generation.current++;
      restored.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!wallet) return;
    const subscribedGeneration = generation.current;
    const events = wallet.features["standard:events"] as
      EventsFeature | undefined;
    return events?.on("change", (event) => {
      if (generation.current !== subscribedGeneration || !event.accounts)
        return;
      const next = selectAccount(event.accounts, currentChain);
      setAccount(next ?? null);
      if (!next) {
        setWallet(null);
        setStatus("disconnected");
      }
    });
  }, [wallet, currentChain, status]);
  const disconnect = useCallback(async () => {
    generation.current++;
    restored.current = true;
    setAccount(null);
    setWallet(null);
    setStatus("disconnected");
    setError(null);
    try {
      localStorage.removeItem(LAST_WALLET);
    } catch {
      /* Optional. */
    }
    try {
      await (
        wallet?.features["standard:disconnect"] as DisconnectFeature | undefined
      )?.disconnect();
    } catch {
      setError(
        "Disconnected from RETRY. The wallet could not revoke its session.",
      );
    }
  }, [wallet]);
  const selectCluster = useCallback((cluster: SolanaCluster) => {
    setSettings({
      config: { cluster, rpcUrl: CLUSTERS[cluster].rpc },
      error: null,
    });
  }, []);
  return (
    <Context.Provider
      value={{
        config: settings.config,
        configError: settings.error,
        wallets,
        wallet,
        account,
        address:
          status === "connected"
            ? (account?.address as SolanaAddress | undefined)
            : undefined,
        status,
        error,
        supportsCluster: Boolean(account?.chains.includes(currentChain)),
        connect: (selected) => establish(selected),
        disconnect,
        cancel,
        selectCluster,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSolanaWallet() {
  const context = useContext(Context);
  if (!context) throw new Error("RetrySolanaProvider missing");
  return context;
}
export function useSolBalance() {
  const { config, address } = useSolanaWallet();
  const query = useQuery({
    queryKey: ["solana", "balance", config?.cluster, config?.rpcUrl, address],
    queryFn: ({ signal }) => readSolBalance(config!, address!, signal),
    enabled: Boolean(config && address),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
  return {
    ...query,
    display: query.data ? formatSol(query.data.lamports) : null,
    available: Boolean(config && address && !query.isError && query.data),
  };
}
