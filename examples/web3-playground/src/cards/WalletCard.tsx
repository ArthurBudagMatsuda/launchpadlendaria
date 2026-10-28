import { useRetryWallet } from '@retry/web3'

export function WalletCard() {
  const wallet = useRetryWallet()
  return (
    <section className="pg-card" aria-labelledby="wallet-title" data-testid="wallet-card">
      <h2 id="wallet-title">Wallet</h2>
      <dl className="pg-list">
        <dt>Status</dt>
        <dd data-testid="wallet-status">{wallet.status}</dd>
        <dt>Address</dt>
        <dd className="pg-mono" data-testid="wallet-address">
          {wallet.address ?? '—'}
        </dd>
        <dt>Connector</dt>
        <dd data-testid="wallet-connector">{wallet.connector ? `${wallet.connector.name} (${wallet.connector.type})` : '—'}</dd>
        <dt>Explorer</dt>
        <dd>
          {wallet.explorerAddressUrl ? (
            <a href={wallet.explorerAddressUrl} target="_blank" rel="noopener noreferrer">
              Open address ↗
            </a>
          ) : (
            '—'
          )}
        </dd>
      </dl>
    </section>
  )
}
