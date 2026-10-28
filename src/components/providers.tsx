"use client";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RetrySolanaProvider } from "@/components/wallet/solana-provider";
import type { SolanaConfig } from "@/config/solana";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
type Notice = { id: number; message: string; error: boolean };
const AppContext = createContext<{
  notify: (message: string, error?: boolean) => void;
} | null>(null);
export function useApp() {
  const app = useContext(AppContext);
  if (!app) throw new Error("AppProvider missing");
  return app;
}
export function Providers({
  children,
  config: providedConfig,
}: {
  children: ReactNode;
  /** Defaults to the app config; tests pass one wired to a mock wallet and RPC. */
  config?: SolanaConfig;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false } },
      }),
  );
  const [notices, setNotices] = useState<Notice[]>([]);
  const notify = useCallback((message: string, error = false) => {
    const id = Date.now() + Math.random();
    setNotices((n) => [...n.slice(-2), { id, message, error }]);
    setTimeout(() => setNotices((n) => n.filter((t) => t.id !== id)), 5500);
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <RetrySolanaProvider initialConfig={providedConfig}>
        <AppContext.Provider value={{ notify }}>
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
      </RetrySolanaProvider>
    </QueryClientProvider>
  );
}
