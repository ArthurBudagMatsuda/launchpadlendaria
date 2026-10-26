import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConnectWalletButton } from '../src/react/components/ConnectWalletButton.js'
import { NetworkGuard } from '../src/react/components/NetworkGuard.js'
import { NetworkIndicator } from '../src/react/components/NetworkIndicator.js'
import { MOCK_WALLET_ACCOUNTS } from '../src/testing/index.js'
import { createTestSetup, ETH } from './utils.js'

const [ALICE] = MOCK_WALLET_ACCOUNTS

function renderApp(options: Parameters<typeof createTestSetup>[0] = {}) {
  const env = createTestSetup({
    balances: {
      84532: { [ALICE.toLowerCase()]: 23_400_000_000_000_000n },
      8453: { [ALICE.toLowerCase()]: ETH },
    },
    ...options,
  })
  const view = render(
    <env.Wrapper>
      <header>
        <NetworkIndicator />
        <ConnectWalletButton />
      </header>
      <NetworkGuard>
        <p>Trade panel</p>
      </NetworkGuard>
    </env.Wrapper>,
  )
  return { ...env, view }
}

const header = () => within(screen.getByRole('banner'))

async function connectThroughModal() {
  fireEvent.click(header().getByRole('button', { name: 'Connect Wallet' }))
  const dialog = await screen.findByRole('dialog', { name: 'Connect Wallet' })
  fireEvent.click(within(dialog).getByRole('button', { name: /Mock Wallet/ }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Connect Wallet' })).toBeNull())
}

describe('ConnectWalletButton', () => {
  it('shows Connect Wallet and a wallet picker with availability states', async () => {
    renderApp()
    fireEvent.click(header().getByRole('button', { name: 'Connect Wallet' }))
    const dialog = await screen.findByRole('dialog', { name: 'Connect Wallet' })
    const mock = within(dialog).getByRole('button', { name: /Mock Wallet/ })
    expect(mock.textContent).toContain('Detected')
    const walletConnect = within(dialog).getByRole('button', { name: /WalletConnect/ }) as HTMLButtonElement
    expect(walletConnect.disabled).toBe(true)
    expect(walletConnect.textContent).toContain('WalletConnect is not configured yet.')
    expect(dialog.textContent).toContain('never asks for your seed phrase or private key')
  })

  it('closes the picker with Escape', async () => {
    renderApp()
    fireEvent.click(header().getByRole('button', { name: 'Connect Wallet' }))
    await screen.findByRole('dialog', { name: 'Connect Wallet' })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Connect Wallet' })).toBeNull()
  })

  it('closing the picker stops waiting for a wallet that never answers', async () => {
    renderApp({ wallet: { ignoreConnect: true } })
    fireEvent.click(header().getByRole('button', { name: 'Connect Wallet' }))
    const dialog = await screen.findByRole('dialog', { name: 'Connect Wallet' })
    fireEvent.click(within(dialog).getByRole('button', { name: /Mock Wallet/ }))
    await within(dialog).findByText('Confirm the connection in your wallet.')
    expect(header().getByRole('button', { name: /Connecting/ })).toBeTruthy()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Connect Wallet' })).toBeNull()
    await header().findByRole('button', { name: 'Connect Wallet' })

    // Opening it again starts from a clean state, not "Waiting for wallet…".
    fireEvent.click(header().getByRole('button', { name: 'Connect Wallet' }))
    const reopened = await screen.findByRole('dialog', { name: 'Connect Wallet' })
    const mock = within(reopened).getByRole('button', { name: /Mock Wallet/ }) as HTMLButtonElement
    expect(mock.disabled).toBe(false)
    expect(mock.textContent).toContain('Detected')
  })

  it('Cancel in the picker stops waiting for the wallet', async () => {
    renderApp({ wallet: { ignoreConnect: true } })
    fireEvent.click(header().getByRole('button', { name: 'Connect Wallet' }))
    const dialog = await screen.findByRole('dialog', { name: 'Connect Wallet' })
    fireEvent.click(within(dialog).getByRole('button', { name: /Mock Wallet/ }))
    await within(dialog).findByText('Confirm the connection in your wallet.')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() =>
      expect(within(dialog).queryByText('Confirm the connection in your wallet.')).toBeNull(),
    )
    const mock = within(dialog).getByRole('button', { name: /Mock Wallet/ }) as HTMLButtonElement
    expect(mock.disabled).toBe(false)
    expect(header().getByRole('button', { name: 'Connect Wallet' })).toBeTruthy()
  })

  it('shows the abbreviated address once the connector confirms, and a full account menu', async () => {
    const { provider } = renderApp()
    await connectThroughModal()
    const short = `${ALICE.slice(0, 6)}...${ALICE.slice(-4)}`
    const button = await header().findByRole('button', { name: short })
    expect(screen.getByText('Trade panel')).toBeTruthy()

    fireEvent.click(button)
    const menu = await screen.findByTestId('rw3-wallet-menu')
    expect(within(menu).getByTestId('rw3-full-address').textContent).toBe(ALICE)
    expect(within(menu).getByText('Connected with Mock Wallet')).toBeTruthy()
    expect(within(menu).getByTestId('rw3-menu-network').textContent).toContain('Base Sepolia')
    await waitFor(() =>
      expect(within(menu).getByTestId('rw3-balance').textContent).toContain('Balance: 0.0234 ETH'),
    )
    const explorer = within(menu).getByRole('link', { name: /View on Basescan/ }) as HTMLAnchorElement
    expect(explorer.href).toBe(`https://sepolia.basescan.org/address/${ALICE}`)
    expect(explorer.rel).toBe('noopener noreferrer')

    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    fireEvent.click(within(menu).getByRole('button', { name: 'Copy Address' }))
    await waitFor(() => expect(within(menu).getByRole('button', { name: 'Copied!' })).toBeTruthy())
    expect(writeText).toHaveBeenCalledWith(ALICE)

    fireEvent.click(within(menu).getByRole('button', { name: 'Disconnect' }))
    await header().findByRole('button', { name: 'Connect Wallet' })
    expect(screen.queryByTestId('rw3-wallet-menu')).toBeNull()
    // Nothing in this flow asked the wallet to sign or send anything.
    expect(provider.calls.map((call) => call.method)).not.toEqual(
      expect.arrayContaining(['personal_sign', 'eth_sendTransaction', 'eth_signTypedData_v4']),
    )
  })

  it('shows the rejection message inside the picker', async () => {
    renderApp({ wallet: { rejectConnect: true } })
    fireEvent.click(header().getByRole('button', { name: 'Connect Wallet' }))
    const dialog = await screen.findByRole('dialog', { name: 'Connect Wallet' })
    fireEvent.click(within(dialog).getByRole('button', { name: /Mock Wallet/ }))
    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'Connection rejected. Please try again.',
    )
  })

  it('shows Wrong Network and switches to Base Sepolia from the menu', async () => {
    const { provider } = renderApp({ wallet: { chainId: 1 } })
    await connectThroughModal()
    const button = await header().findByRole('button', { name: 'Wrong Network' })
    expect(screen.getByTestId('rw3-network-indicator').textContent).toContain('Wrong Network')
    expect(screen.queryByText('Trade panel')).toBeNull()

    fireEvent.click(button)
    const menu = await screen.findByTestId('rw3-wallet-menu')
    expect(within(menu).getByText('Your wallet is on Ethereum. Please switch to Base Sepolia.')).toBeTruthy()
    // No balance row on an unsupported chain: the notice already explains it.
    expect(within(menu).queryByTestId('rw3-balance')).toBeNull()
    fireEvent.click(within(menu).getByRole('button', { name: 'Switch to Base Sepolia' }))
    await waitFor(() =>
      expect(screen.getByTestId('rw3-network-indicator').textContent).toContain('Base Sepolia'),
    )
    await waitFor(() => expect(within(menu).getByTestId('rw3-balance').textContent).toContain('ETH'))
    expect(provider.state.chainId).toBe(84532)
    expect(screen.getByText('Trade panel')).toBeTruthy()
  })

  it('reacts to wallet-side changes without a reload', async () => {
    const { provider } = renderApp()
    await connectThroughModal()
    await screen.findByTestId('rw3-network-indicator')
    act(() => provider.changeChain(42161))
    await header().findByRole('button', { name: 'Wrong Network' })
    act(() => provider.changeChain(8453))
    await waitFor(() => expect(screen.getByTestId('rw3-network-indicator').textContent).toBe('Base'))
  })
})

describe('NetworkGuard', () => {
  it('asks to connect while disconnected', () => {
    renderApp()
    expect(screen.getByText('Connect your wallet')).toBeTruthy()
    expect(screen.queryByText('Trade panel')).toBeNull()
  })

  it('offers the switch when the wallet is on another chain', async () => {
    renderApp({ wallet: { chainId: 10 } })
    await connectThroughModal()
    const guard = await screen.findByRole('alert')
    expect(guard.textContent).toContain('Wrong Network')
    expect(guard.textContent).toContain('OP Mainnet')
    expect(within(guard).getByRole('button', { name: 'Switch to Base Sepolia' })).toBeTruthy()
  })
})
