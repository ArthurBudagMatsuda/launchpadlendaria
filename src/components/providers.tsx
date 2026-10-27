"use client";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { makeWagmiConfig } from "@/config/wagmi";
import { defaultChain } from "@/config/networks";
type Notice = { id: number; message: string; error: boolean };
const AppContext = createContext<{
  notify: (message: string, error?: boolean) => void;
  walletOpen: boolean;
  setWalletOpen: (open: boolean) => void;
  selectedChainId: number;
  setSelectedChainId: (id: number) => void;
} | null>(null);
export function useApp() {
  const app = useContext(AppContext);
  if (!app) throw new Error("AppProvider missing");
  return app;
}
export function Providers({ children }: { children: ReactNode }) {
  const [config] = useState(makeWagmiConfig);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  const [notices, setNotices] = useState<Notice[]>([]);
  const [walletOpen, setWalletOpen] = useState(false);
  const [selectedChainId, setSelectedChainId] = useState<number>(
    defaultChain.id,
  );
  const notify = useCallback((message: string, error = false) => {
    const id = Date.now() + Math.random();
    setNotices((n) => [...n.slice(-2), { id, message, error }]);
    setTimeout(() => setNotices((n) => n.filter((t) => t.id !== id)), 5500);
  }, []);
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AppContext.Provider
          value={{
            notify,
            walletOpen,
            setWalletOpen,
            selectedChainId,
            setSelectedChainId,
          }}
        >
          {children}
          <div className="toasts" aria-live="polite" aria-atomic="false">
            {notices.map((n) => (
              <div
                className={`toast ${n.error ? "toast-error" : ""}`}
                key={n.id}
              >
                {n.error ? (
                  <CircleAlert size={19} />
                ) : (
                  <CheckCircle2 size={19} />
                )}
                <span>{n.message}</span>
                <button
                  className="icon-button"
                  onClick={() =>
                    setNotices((t) => t.filter((i) => i.id !== n.id))
                  }
                  aria-label="Dismiss notification"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </AppContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
