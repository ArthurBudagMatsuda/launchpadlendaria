"use client";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  RetryWeb3Provider,
  type RetryWeb3Config,
  type RetryWeb3ProviderProps,
} from "@retry/web3";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { makeRetryWeb3Config } from "@/config/web3";
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
  initialState,
  config: providedConfig,
}: {
  children: ReactNode;
  initialState?: RetryWeb3ProviderProps["initialState"];
  /** Defaults to the app config; tests pass one wired to a mock wallet and RPC. */
  config?: RetryWeb3Config;
}) {
  const [config] = useState(() => providedConfig ?? makeRetryWeb3Config());
  const [notices, setNotices] = useState<Notice[]>([]);
  const notify = useCallback((message: string, error = false) => {
    const id = Date.now() + Math.random();
    setNotices((n) => [...n.slice(-2), { id, message, error }]);
    setTimeout(() => setNotices((n) => n.filter((t) => t.id !== id)), 5500);
  }, []);
  return (
    <RetryWeb3Provider config={config} initialState={initialState}>
      <AppContext.Provider value={{ notify }}>
        {children}
        <div className="toasts" aria-live="polite" aria-atomic="false">
          {notices.map((n) => (
            <div className={`toast ${n.error ? "toast-error" : ""}`} key={n.id}>
              {n.error ? <CircleAlert size={19} /> : <CheckCircle2 size={19} />}
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
    </RetryWeb3Provider>
  );
}
