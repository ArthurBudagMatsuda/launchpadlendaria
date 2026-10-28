// @vitest-environment jsdom
import { act } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRetryWeb3Config } from '../src/config/wagmi.js'
import { ConnectWalletButton } from '../src/react/components/ConnectWalletButton.js'
import { NetworkIndicator } from '../src/react/components/NetworkIndicator.js'
import { RetryWeb3Provider } from '../src/react/provider.js'

function App({ config }: { config: ReturnType<typeof createRetryWeb3Config> }) {
  return (
    <RetryWeb3Provider config={config} debug={false}>
      <NetworkIndicator />
      <ConnectWalletButton />
    </RetryWeb3Provider>
  )
}

describe('server rendering', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders on the server and hydrates without mismatches', async () => {
    const config = createRetryWeb3Config({ ssr: true })
    const html = renderToString(<App config={config} />)
    expect(html).toContain('Connect Wallet')
    expect(html).toContain('Base Sepolia')

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const consoleError = vi.spyOn(console, 'error')
    const recoverable = vi.fn()
    await act(async () => {
      hydrateRoot(container, <App config={createRetryWeb3Config({ ssr: true })} />, {
        onRecoverableError: recoverable,
      })
    })
    expect(recoverable).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Connect Wallet')
  })
})
