import { type RetryWalletEvent, SUPPORTED_CHAIN_IDS, shortenAddress, useRetryDiagnostics, useRetryWalletEvents } from '@retry/web3'
import { useState } from 'react'
import { env } from '../web3'

function describeEvent(event: RetryWalletEvent): string {
  switch (event.type) {
    case 'connected':
      return `connected ${shortenAddress(event.address)} on ${event.chainId} via ${event.connectorName}`
    case 'disconnected':
      return 'disconnected'
    case 'account-changed':
      return `account ${shortenAddress(event.from)} → ${shortenAddress(event.to)}`
    case 'network-changed':
      return `network ${event.from} → ${event.to}`
  }
}

export function DiagnosticsCard() {
  const diagnostics = useRetryDiagnostics()
  const [events, setEvents] = useState<RetryWalletEvent[]>([])
  useRetryWalletEvents((event) => setEvents((current) => [event, ...current].slice(0, 20)))
  const { settings } = diagnostics

  return (
    <section className="pg-card pg-card--wide" aria-labelledby="diagnostics-title" data-testid="diagnostics-card">
      <h2 id="diagnostics-title">Diagnostics</h2>
      <div className="pg-columns">
        <div>
          <h3>Configuration</h3>
          <dl className="pg-list">
            <dt>Environment</dt>
            <dd>{settings.environment}</dd>
            <dt>WalletConnect</dt>
            <dd data-testid="diag-walletconnect">{settings.walletConnectEnabled ? 'configured' : 'not configured'}</dd>
            <dt>Connection</dt>
            <dd>{diagnostics.connectionStatus}</dd>
            <dt>Connector</dt>
            <dd>{diagnostics.connectorId ?? '—'}</dd>
          </dl>
          {env.warnings.length > 0 ? (
            <ul className="pg-warnings">
              {env.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          <h3>RPC</h3>
          <ul className="pg-plain">
            {SUPPORTED_CHAIN_IDS.map((chainId) => {
              const health = diagnostics.rpcHealth[chainId]
              return (
                <li key={chainId} data-testid={`rpc-${chainId}`}>
                  <strong>{chainId}</strong>{' '}
                  {settings.rpc[chainId].map((endpoint) => `${endpoint.kind}: ${endpoint.origin}`).join(' → ')}
                  <div className="pg-row">
                    <button
                      type="button"
                      className="rw3-button rw3-button--secondary rw3-button--small"
                      onClick={() => void diagnostics.checkRpc(chainId)}
                      disabled={health.status === 'checking'}
                    >
                      Check RPC
                    </button>
                    <span className="pg-muted" data-testid={`rpc-${chainId}-status`}>
                      {health.status === 'ok'
                        ? `ok · block ${health.blockNumber} · ${health.latencyMs} ms`
                        : health.status === 'error'
                          ? `${health.error.message} (${health.latencyMs} ms)`
                          : health.status}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <div>
          <h3>Wallets</h3>
          <ul className="pg-plain">
            {diagnostics.connectors.map((connector) => (
              <li key={connector.uid}>
                {connector.name} <span className="pg-muted">({connector.id})</span>
              </li>
            ))}
          </ul>
          <p className="pg-muted">EIP-6963 announcements: {diagnostics.announcedWallets.length}</p>
        </div>

        <div>
          <h3>Events</h3>
          <ol className="pg-plain" data-testid="diag-events">
            {events.length === 0 ? <li className="pg-muted">No wallet events yet.</li> : null}
            {events.map((event) => (
              <li key={`${event.at}-${event.type}-${describeEvent(event)}`}>
                <span className="pg-muted">{new Date(event.at).toLocaleTimeString()}</span> {describeEvent(event)}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
