import { BASE_MAINNET_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID, useRetryNetwork } from '@retry/web3'

export function NetworkCard() {
  const network = useRetryNetwork()
  const connected = network.scenario !== 'disconnected'
  return (
    <section className="pg-card" aria-labelledby="network-title" data-testid="network-card">
      <h2 id="network-title">Network</h2>
      <dl className="pg-list">
        <dt>Scenario</dt>
        <dd data-testid="network-scenario">{network.scenario}</dd>
        <dt>Wallet chain</dt>
        <dd data-testid="network-wallet-chain">
          {network.walletChainId === undefined ? '—' : `${network.walletNetworkName} (${network.walletChainId})`}
        </dd>
        <dt>App target</dt>
        <dd>
          {network.targetNetwork.name} ({network.targetNetwork.id})
        </dd>
        <dt>Financial ops</dt>
        <dd>{network.financialOperationsEnabled ? 'enabled' : 'disabled (Stage 2)'}</dd>
      </dl>
      {network.notice ? (
        <p className={`rw3-message rw3-message--${network.notice.tone}`} data-testid="network-notice">
          <strong>{network.notice.title}:</strong> {network.notice.message}
        </p>
      ) : null}
      <div className="pg-row">
        <button
          type="button"
          className="rw3-button rw3-button--secondary"
          disabled={!connected || network.isSwitching || network.walletChainId === BASE_SEPOLIA_CHAIN_ID}
          onClick={() => network.switchTo(BASE_SEPOLIA_CHAIN_ID)}
        >
          Switch to Base Sepolia
        </button>
        <button
          type="button"
          className="rw3-button rw3-button--secondary"
          disabled={!connected || network.isSwitching || network.walletChainId === BASE_MAINNET_CHAIN_ID}
          onClick={() => network.switchTo(BASE_MAINNET_CHAIN_ID)}
        >
          Switch to Base
        </button>
      </div>
      {network.isSwitching ? <p className="pg-muted">Confirm the network switch in your wallet…</p> : null}
      {network.switchError ? (
        <p className="rw3-message rw3-message--error" role="alert" data-testid="network-switch-error">
          {network.switchError.message}
        </p>
      ) : null}
    </section>
  )
}
