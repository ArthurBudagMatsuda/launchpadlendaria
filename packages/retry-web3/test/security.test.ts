import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RETRY_FINANCIAL_OPERATIONS_ENABLED } from '../src/config/wagmi.js'

const SRC = join(import.meta.dirname, '..', 'src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

const files = sourceFiles(SRC).map((path) => ({
  path: relative(SRC, path),
  code: readFileSync(path, 'utf8'),
}))

describe('stage 2 safety rails', () => {
  it('keeps financial operations disabled', () => {
    expect(RETRY_FINANCIAL_OPERATIONS_ENABLED).toBe(false)
  })

  it.each([
    ['transaction sending', /\b(useSendTransaction|sendTransaction|useSendCalls|sendCalls)\b/],
    [
      'contract writes',
      /\b(useWriteContract|writeContract|useDeployContract|deployContract|useSimulateContract)\b/,
    ],
    [
      'message or typed-data signing',
      /\b(useSignMessage|signMessage|useSignTypedData|signTypedData|personal_sign)\b/,
    ],
    ['token approvals', /\bapprove\s*\(|functionName:\s*['"]approve['"]|maxUint256/],
    ['key or seed handling', /\b(privateKeyToAccount|mnemonicToAccount|generatePrivateKey|hdKeyToAccount)\b/],
    ['raw HTML injection', /dangerouslySetInnerHTML|innerHTML\s*=/],
  ])('contains no %s', (_label, pattern) => {
    const offenders = files
      // The mock wallet names signing methods only to refuse them.
      .filter((file) => !file.path.startsWith('testing/'))
      .filter((file) => pattern.test(file.code))
      .map((file) => file.path)
    expect(offenders).toEqual([])
  })

  it('does not persist anything itself (wagmi only stores public connection state)', () => {
    const offenders = files
      .filter((file) => /\b(localStorage|sessionStorage)\.setItem|document\.cookie\s*=/.test(file.code))
      .map((file) => file.path)
    expect(offenders).toEqual([])
  })

  it('does not hardcode contract addresses', () => {
    const offenders = files
      .filter((file) => !file.path.startsWith('testing/'))
      .filter((file) => /0x[0-9a-fA-F]{40}\b/.test(file.code.replace(/0x0{40}/g, '')))
      .map((file) => file.path)
    expect(offenders).toEqual([])
  })
})
