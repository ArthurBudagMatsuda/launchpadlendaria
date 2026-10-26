import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Explicit read-only allowlist. This script has no signing/transaction methods.
const manifest = JSON.parse(await readFile(new URL('../../../docs/protocol/research/dex-deployments.json', import.meta.url), 'utf8'));
const allowed = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getCode', 'eth_call']);
async function rpc(url, method, params = []) {
  if (!allowed.has(method)) throw new Error('RPC_METHOD_FORBIDDEN');
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  const result = await response.json();
  if (result.error) throw new Error(JSON.stringify(result.error));
  if (!Object.hasOwn(result, 'result')) throw new Error('RPC_RESULT_MISSING');
  return result.result;
}

const networks = await Promise.all(manifest.networks.map(async network => {
  try {
    const actualChain = await rpc(network.rpc, 'eth_chainId');
    if (BigInt(actualChain) !== BigInt(network.chainId)) throw new Error('WRONG_CHAIN');
    const blockNumber = await rpc(network.rpc, 'eth_blockNumber');
    const block = await rpc(network.rpc, 'eth_getBlockByNumber', [blockNumber, false]);
    const contracts = [];
    for (const [role, address] of Object.entries(network.contracts)) {
      try {
        const code = await rpc(network.rpc, 'eth_getCode', [address, blockNumber]);
        if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(code)) throw new Error('NO_OR_INVALID_CODE');
        const record = { role, address, byteLength: (code.length - 2) / 2,
          bytecodeSha256: createHash('sha256').update(Buffer.from(code.slice(2), 'hex')).digest('hex'), status: 'CODE_PRESENT' };
        if (role === 'v3PositionManager') {
          const factory = await rpc(network.rpc, 'eth_call', [{ to: address, data: '0xc45a0155' }, blockNumber]);
          record.reportedFactory = `0x${factory.slice(-40)}`;
          if (record.reportedFactory.toLowerCase() !== network.contracts.v3Factory.toLowerCase()) throw new Error('FACTORY_MISMATCH');
          const wrapped = await rpc(network.rpc, 'eth_call', [{ to: address, data: '0x4aa4a4fc' }, blockNumber]);
          record.reportedWeth = `0x${wrapped.slice(-40)}`;
        }
        if (role === 'v4PositionManager') {
          const manager = await rpc(network.rpc, 'eth_call', [{ to: address, data: '0xdc4c90d3' }, blockNumber]);
          record.reportedPoolManager = `0x${manager.slice(-40)}`;
          if (record.reportedPoolManager.toLowerCase() !== network.contracts.v4PoolManager.toLowerCase()) throw new Error('POOL_MANAGER_MISMATCH');
        }
        contracts.push(record);
      } catch (error) { contracts.push({ role, address, status: 'UNVERIFIED', error: error.message }); }
    }
    const endBlock = await rpc(network.rpc, 'eth_getBlockByNumber', [blockNumber, false]);
    if (!block?.hash || block.hash !== endBlock?.hash) throw new Error('BLOCK_CHANGED');
    return { chainId: network.chainId, rpc: network.rpc, blockNumber, blockHash: block.hash,
      contracts, status: contracts.every(contract => contract.status === 'CODE_PRESENT') ? 'READ_ONLY_CHECK_PASSED' : 'INCOMPLETE' };
  } catch (error) { return { chainId: network.chainId, rpc: network.rpc, status: 'UNVERIFIED', error: error.message }; }
}));
const result = { inspectedAt: new Date().toISOString(), status: 'RESEARCH_ONLY',
  limitation: 'Code presence, V3 factory/WETH getters and V4 poolManager relationship are checked. SHA-256 is a snapshot fingerprint, not EVM EXTCODEHASH or proof of audited bytecode equivalence. A single public RPC per chain is not independent consensus verification.', networks };
const encoded = JSON.stringify(result, null, 2) + '\n';
if (process.argv.includes('--write')) await writeFile(new URL('../../../docs/protocol/research/dex-readonly-check.json', import.meta.url), encoded);
console.log(encoded);
if (networks.some(network => network.status !== 'READ_ONLY_CHECK_PASSED')) process.exitCode = 1;
