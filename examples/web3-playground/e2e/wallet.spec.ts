import { ALICE, BOB, connectTestWallet, expect, short, test } from './fixtures'

test.describe('RETRY Web3 playground', () => {
  test('lists wallets with availability while disconnected', async ({ page, wallet }) => {
    await wallet()
    await page.goto('/')
    const header = page.getByRole('banner')
    await expect(header.getByRole('button', { name: 'Connect Wallet' })).toBeVisible()
    await expect(page.getByTestId('rw3-network-indicator')).toHaveText('Base Sepolia')

    await header.getByRole('button', { name: 'Connect Wallet' }).click()
    const dialog = page.getByRole('dialog', { name: 'Connect Wallet' })
    await expect(dialog.getByRole('button', { name: /Retry Test Wallet/ })).toContainText('Detected')
    await expect(dialog.getByRole('button', { name: /MetaMask/ })).toBeEnabled()
    await expect(dialog.getByRole('button', { name: /Coinbase Wallet/ })).toBeEnabled()
    const walletConnect = dialog.getByRole('button', { name: /WalletConnect/ })
    await expect(walletConnect).toBeDisabled()
    await expect(walletConnect).toContainText('WalletConnect is not configured yet.')
    // The EIP-6963 wallet is also window.ethereum: it must not be listed twice.
    await expect(dialog.getByRole('button', { name: /Browser Wallet/ })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('connects, shows the address, network and on-chain balance, then disconnects', async ({ page, wallet, rpc }) => {
    await wallet()
    await page.goto('/')
    await connectTestWallet(page)

    const account = page.getByRole('banner').getByRole('button', { name: short(ALICE) })
    await expect(account).toBeVisible()
    await expect(page.getByTestId('wallet-address')).toHaveText(ALICE)
    await expect(page.getByTestId('wallet-connector')).toContainText('Retry Test Wallet')
    await expect(page.getByTestId('network-scenario')).toHaveText('target')
    await expect(page.getByTestId('balance-value')).toHaveText('Balance: 0.0234 ETH')
    expect(rpc.calls.some((call) => call.chainId === 84532)).toBe(true)

    await account.click()
    const menu = page.getByTestId('rw3-wallet-menu')
    await expect(menu.getByTestId('rw3-full-address')).toHaveText(ALICE)
    await expect(menu.getByTestId('rw3-menu-network')).toContainText('Base Sepolia')
    await expect(menu.getByTestId('rw3-balance')).toContainText('Balance: 0.0234 ETH')
    await expect(menu.getByRole('link', { name: /View on Basescan/ })).toHaveAttribute(
      'href',
      `https://sepolia.basescan.org/address/${ALICE}`,
    )
    // The header and the open menu must fit a phone screen without sideways scrolling.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await menu.getByRole('button', { name: 'Disconnect' }).click()
    await expect(page.getByRole('banner').getByRole('button', { name: 'Connect Wallet' })).toBeVisible()
    await expect(page.getByTestId('wallet-status')).toHaveText('disconnected')
  })

  test('explains a rejected connection', async ({ page, wallet }) => {
    await wallet({ rejectConnect: true })
    await page.goto('/')
    await page.getByRole('banner').getByRole('button', { name: 'Connect Wallet' }).click()
    const dialog = page.getByRole('dialog', { name: 'Connect Wallet' })
    await dialog.getByRole('button', { name: /Retry Test Wallet/ }).click()
    await expect(dialog.getByRole('alert')).toHaveText('Connection rejected. Please try again.')
  })

  test('stops waiting when the wallet window closes without answering', async ({ page, wallet }) => {
    await wallet({ ignoreConnect: true })
    await page.goto('/')
    await page.getByRole('banner').getByRole('button', { name: 'Connect Wallet' }).click()
    const dialog = page.getByRole('dialog', { name: 'Connect Wallet' })
    await dialog.getByRole('button', { name: /Retry Test Wallet/ }).click()
    await expect(dialog.getByText('Waiting for wallet…')).toBeVisible()
    await expect(page.getByTestId('wallet-status')).toHaveText('connecting')

    // The extension window takes focus, then the user closes it without answering.
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'))
      window.dispatchEvent(new Event('focus'))
    })
    await expect(dialog.getByRole('alert')).toHaveText(
      "Your wallet didn't confirm the connection. Make sure it is unlocked with an Ethereum (EVM) account selected, then try again.",
    )
    await expect(dialog.getByText('Waiting for wallet…')).toBeHidden()
    await expect(page.getByTestId('wallet-status')).toHaveText('disconnected')
    await expect(dialog.getByRole('button', { name: /Retry Test Wallet/ })).toBeEnabled()

    // Closing the picker leaves nothing stuck on "Connecting…".
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(page.getByRole('button', { name: /Connecting/ })).toHaveCount(0)
  })

  test('flags Ethereum Mainnet as Wrong Network and switches to Base Sepolia on click', async ({ page, wallet }) => {
    await wallet({ chainId: 1 })
    await page.goto('/')
    await connectTestWallet(page)
    const header = page.getByRole('banner')
    await expect(header.getByRole('button', { name: 'Wrong Network' })).toBeVisible()
    await expect(page.getByTestId('network-wallet-chain')).toHaveText('Ethereum (1)')
    await expect(page.getByTestId('balance-value')).toHaveText('Please switch to Base Sepolia.')

    const guard = page.getByRole('alert').filter({ hasText: 'Wrong Network' }).first()
    await guard.getByRole('button', { name: 'Switch to Base Sepolia' }).click()
    await expect(page.getByTestId('rw3-network-indicator')).toContainText('Base Sepolia')
    await expect(page.getByTestId('balance-value')).toHaveText('Balance: 0.0234 ETH')
  })

  test('reports a rejected network switch', async ({ page, wallet }) => {
    await wallet({ chainId: 42161, rejectSwitch: true })
    await page.goto('/')
    await connectTestWallet(page)
    await page.getByRole('banner').getByRole('button', { name: 'Wrong Network' }).click()
    const menu = page.getByTestId('rw3-wallet-menu')
    await menu.getByRole('button', { name: 'Switch to Base Sepolia' }).click()
    await expect(menu.getByRole('alert').first()).toHaveText('Network switch rejected. Please switch to Base Sepolia.')
  })

  test('follows network and account changes made in the wallet', async ({ page, wallet }) => {
    await wallet()
    await page.goto('/')
    await connectTestWallet(page)
    await expect(page.getByTestId('balance-value')).toHaveText('Balance: 0.0234 ETH')

    await page.evaluate(() => (window as never as { __retryMockWallet: { changeChain(id: number): void } }).__retryMockWallet.changeChain(8453))
    await expect(page.getByTestId('rw3-network-indicator')).toHaveText('Base')
    await expect(page.getByTestId('network-notice')).toContainText('read-only')
    await expect(page.getByTestId('balance-value')).toHaveText('Balance: 5 ETH')

    await page.evaluate(
      (next) =>
        (window as never as { __retryMockWallet: { changeAccounts(a: string[]): void } }).__retryMockWallet.changeAccounts([
          next,
        ]),
      BOB,
    )
    await expect(page.getByRole('banner').getByRole('button', { name: short(BOB) })).toBeVisible()
    await expect(page.getByTestId('diag-events')).toContainText(`account ${short(ALICE)} → ${short(BOB)}`)
  })

  test('shows an explicit error when the RPC fails and recovers on refresh', async ({ page, wallet, rpc }) => {
    rpc.failStatus = 503
    await wallet()
    await page.goto('/')
    await connectTestWallet(page)
    await expect(page.getByTestId('balance-value')).toHaveText('Unable to fetch your balance.', { timeout: 15_000 })
    rpc.failStatus = undefined
    await page.getByRole('button', { name: 'Refresh balance' }).click()
    await expect(page.getByTestId('balance-value')).toHaveText('Balance: 0.0234 ETH')
  })

  test('restores the session after a reload', async ({ page, wallet }) => {
    await wallet()
    await page.goto('/')
    await connectTestWallet(page)
    await expect(page.getByRole('banner').getByRole('button', { name: short(ALICE) })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('banner').getByRole('button', { name: short(ALICE) })).toBeVisible()
  })

  test('disconnects when the wallet ends the session', async ({ page, wallet }) => {
    await wallet()
    await page.goto('/')
    await connectTestWallet(page)
    await page.evaluate(() => (window as never as { __retryMockWallet: { endSession(): void } }).__retryMockWallet.endSession())
    await expect(page.getByRole('banner').getByRole('button', { name: 'Connect Wallet' })).toBeVisible()
  })

  test('never asks the wallet to sign or send anything', async ({ page, wallet }) => {
    await wallet({ chainId: 1 })
    await page.goto('/')
    await connectTestWallet(page)
    await page.getByRole('banner').getByRole('button', { name: 'Wrong Network' }).click()
    await page.getByTestId('rw3-wallet-menu').getByRole('button', { name: 'Switch to Base Sepolia' }).click()
    await expect(page.getByTestId('balance-value')).toHaveText('Balance: 0.0234 ETH')
    const calls = await page.evaluate(
      () => (window as never as { __retryMockWallet: { state: { calls: string[] } } }).__retryMockWallet.state.calls,
    )
    expect(calls.filter((method) => /sign|send|approve/i.test(method))).toEqual([])
  })
})
