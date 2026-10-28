import {
  ConnectWalletButton,
  EthBalance,
  NetworkGuard,
  NetworkIndicator,
  RetryWeb3Provider,
} from '@retry/web3'
import { retryWeb3Config } from './web3'
import { BalanceCard } from './cards/BalanceCard'
import { ContractsCard } from './cards/ContractsCard'
import { DiagnosticsCard } from './cards/DiagnosticsCard'
import { NetworkCard } from './cards/NetworkCard'
import { WalletCard } from './cards/WalletCard'

// On GitHub Pages the playground lives under the RETRY app (`/launchpadlendaria/web3/`),
// so the logo goes back to the folder above. Locally (base `/`) it stays on the playground.
const APP_HOME = import.meta.env.BASE_URL.replace(/[^/]+\/$/, '')

export function App() {
  return (
    <RetryWeb3Provider config={retryWeb3Config} debug={import.meta.env.DEV}>
      <header className="pg-header">
        <a className="pg-brand" href={APP_HOME} title="Back to RETRY" data-testid="pg-home-link">
          <span className="pg-logo">RETRY</span>
          <span className="pg-subtitle">Web3 Playground</span>
        </a>
        <div className="pg-header-actions">
          <NetworkIndicator />
          <ConnectWalletButton />
        </div>
      </header>

      <main className="pg-main">
        <p className="pg-intro">
          Test bench for Stage 2: real wallet connection, Base network detection and read-only ETH balance.
          Nothing here can send transactions or request signatures.
        </p>
        <div className="pg-grid">
          <WalletCard />
          <NetworkCard />
          <BalanceCard />
          <section className="pg-card" aria-labelledby="trade-title">
            <h2 id="trade-title">Trade panel preview</h2>
            <NetworkGuard>
              <EthBalance label="Available:" showRefresh={false} />
              <div className="pg-row">
                <button type="button" className="rw3-button rw3-button--primary" disabled>
                  Buy
                </button>
                <button type="button" className="rw3-button rw3-button--secondary" disabled>
                  Sell
                </button>
              </div>
              <p className="pg-muted">Trading is not enabled in Stage 2. Buttons stay disabled on purpose.</p>
            </NetworkGuard>
          </section>
          <ContractsCard />
          <DiagnosticsCard />
        </div>
      </main>
    </RetryWeb3Provider>
  )
}
