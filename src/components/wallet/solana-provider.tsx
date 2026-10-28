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
import {
  StandardConnect,
  StandardDisconnect,
  StandardEvents,
  type StandardConnectFeature,
  type StandardDisconnectFeature,
  type StandardEventsFeature,
} from "@wallet-standard/features";
import { useQuery } from "@tanstack/react-query";
import {
  appSolanaConfig,
  CLUSTERS,
  isCluster,
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
type ConnectFeature = StandardConnectFeature[typeof StandardConnect];
type DisconnectFeature = StandardDisconnectFeature[typeof StandardDisconnect];
type EventsFeature = StandardEventsFeature[typeof StandardEvents];
class WalletTimeoutError extends Error {}
async function walletResponse<T>(operation: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new WalletTimeoutError(
                "Wallet did not answer. Unlock it and try again.",
              ),
            ),
          20_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export function compatibleWallet(wallet: Wallet) {
  if (!wallet || typeof wallet !== "object") return false;
  const feature = wallet.features?.[StandardConnect] as
    ConnectFeature | undefined;
  const events = wallet.features?.[StandardEvents] as EventsFeature | undefined;
  const disconnect = wallet.features?.[StandardDisconnect] as
    DisconnectFeature | undefined;
  return (
    wallet.version === "1.0.0" &&
    typeof wallet.name === "string" &&
    wallet.name.trim().length > 0 &&
    wallet.name.length <= 128 &&
    Array.isArray(wallet.chains) &&
    wallet.chains.some(
      (chain) => typeof chain === "string" && chain.startsWith("solana:"),
    ) &&
    feature?.version === "1.0.0" &&
    typeof feature.connect === "function" &&
    events?.version === "1.0.0" &&
    typeof events.on === "function" &&
    disconnect?.version === "1.0.0" &&
    typeof disconnect.disconnect === "function"
  );
}
export function selectAccount(
  accounts: readonly WalletAccount[],
  chain: string,
) {
  const valid: WalletAccount[] = (
    Array.isArray(accounts) ? accounts : []
  ).filter(
    (account) =>
      account &&
      Array.isArray(account.chains) &&
      account.chains.some(
        (value: unknown) =>
          typeof value === "string" && value.startsWith("solana:"),
      ) &&
      ArrayBuffer.isView(account.publicKey) &&
      account.publicKey.byteLength === 32 &&
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
interface Settings {
  config: SolanaConfig | null;
  error: string | null;
  configured: Partial<Record<SolanaCluster, SolanaConfig>>;
}
export function RetrySolanaProvider({
  children,
  initialConfig,
}: {
  children: ReactNode;
  initialConfig?: SolanaConfig;
}) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const config = initialConfig ?? appSolanaConfig();
      return { config, error: null, configured: { [config.cluster]: config } };
    } catch {
      return {
        config: null,
        configured: {},
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
  const wallets = useMemo(() => {
    const names = new Set<string>();
    return registered.filter((candidate) => {
      if (!compatibleWallet(candidate)) return false;
      const name = candidate.name.trim().toLowerCase();
      if (names.has(name)) return false;
      names.add(name);
      return true;
    });
  }, [registered]);
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
      try {
        if (!compatibleWallet(selected))
          throw new Error("This wallet has no Solana connection support.");
        const feature = selected.features["standard:connect"] as ConnectFeature;
        const response = await walletResponse(() =>
          feature.connect({ silent }),
        );
        if (generation.current !== attempt) return;
        if (!getWallets().get().includes(selected))
          throw new Error("Wallet no longer available.");
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
            cause instanceof WalletTimeoutError
              ? cause.message
              : "Connection rejected or unavailable. Unlock your wallet and try again.",
          );
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
    let active = true;
    let off: unknown;
    const events = wallet.features["standard:events"] as
      EventsFeature | undefined;
    const unavailable = () =>
      queueMicrotask(() => {
        if (!active || generation.current !== subscribedGeneration) return;
        generation.current++;
        setWallet(null);
        setAccount(null);
        setStatus("disconnected");
        setError(
          "Wallet account updates unavailable. Reconnect a compatible wallet.",
        );
      });
    try {
      if (!events || typeof events.on !== "function") unavailable();
      else {
        off = events.on("change", (event) => {
          if (
            !active ||
            generation.current !== subscribedGeneration ||
            !event ||
            event.accounts === undefined
          )
            return;
          const next = selectAccount(event.accounts, currentChain);
          setAccount(next ?? null);
          if (!next) {
            setWallet(null);
            setStatus("disconnected");
          }
        });
        if (typeof off !== "function") unavailable();
      }
    } catch {
      unavailable();
    }
    return () => {
      active = false;
      if (typeof off === "function") {
        try {
          off();
        } catch {
          /* A faulty extension must not break React cleanup. */
        }
      }
    };
  }, [wallet, currentChain, status]);
  const disconnect = useCallback(async () => {
    const attempt = ++generation.current;
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
      const feature = wallet?.features[StandardDisconnect] as
        DisconnectFeature | undefined;
      if (feature) await walletResponse(() => feature.disconnect());
    } catch {
      if (generation.current === attempt)
        setError(
          "Disconnected from RETRY. The wallet could not revoke its session.",
        );
    }
  }, [wallet]);
  const selectCluster = useCallback((cluster: SolanaCluster) => {
    if (!isCluster(cluster)) return;
    setSettings((previous) => ({
      ...previous,
      config: previous.configured[cluster] ?? {
        cluster,
        rpcUrl: CLUSTERS[cluster].rpc,
      },
      error: null,
    }));
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
