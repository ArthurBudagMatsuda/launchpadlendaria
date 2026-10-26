import { useRetryBalance } from '@retry/web3'

export function BalanceCard() {
  const balance = useRetryBalance()
  return (
    <section className="pg-card" aria-labelledby="balance-title" data-testid="balance-card">
      <h2 id="balance-title">ETH balance</h2>
      <p className="pg-balance" data-testid="balance-value">
        {balance.status === 'success'
          ? `Balance: ${balance.display}`
          : balance.status === 'loading'
            ? 'Loading balance…'
            : balance.status === 'disconnected'
              ? 'Connect a wallet to see its balance.'
              : balance.error?.message}
      </p>
      {balance.error?.hint ? <p className="pg-muted">{balance.error.hint}</p> : null}
      <dl className="pg-list">
        <dt>Exact</dt>
        <dd className="pg-mono">{balance.exact ? `${balance.exact} ${balance.symbol}` : '—'}</dd>
        <dt>Read from</dt>
        <dd>{balance.chainId ?? '—'}</dd>
        <dt>Updated</dt>
        <dd>{balance.updatedAt ? new Date(balance.updatedAt).toLocaleTimeString() : '—'}</dd>
      </dl>
      <button
        type="button"
        className="rw3-button rw3-button--secondary"
        onClick={balance.refetch}
        disabled={balance.isFetching || balance.status === 'disconnected' || balance.status === 'wrong-network'}
      >
        {balance.isFetching ? 'Refreshing…' : 'Refresh balance'}
      </button>
    </section>
  )
}
