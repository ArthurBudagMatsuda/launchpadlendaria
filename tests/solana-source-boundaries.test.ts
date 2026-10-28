import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory()
      ? files(path.join(dir, item.name))
      : [path.join(dir, item.name)],
  );
}
describe("production migration boundaries", () => {
  it("contains no EVM clients, former featured contract, mock fixtures or key material in active source", () => {
    const forbidden = [
      /@retry\/web3/,
      /from ["'](?:viem|wagmi|@coinbase|@metamask|@walletconnect)/,
      /0xb200000000000000000000585fd80c20af698f01/i,
      /eth_requestAccounts|wallet_switchEthereumChain|eth_call/,
      // RETRY asks wallets to sign transactions only: never messages, and it
      // never hands sending to the wallet (it stores the signature first).
      /signAndSendTransaction|signMessage|signAllTransactions|\bsendTransaction\b/,
      /fixtures\/|generateHistory|demo-market/,
      /localStorage\.clear\(/,
      // No private keys, seeds or mnemonics; fresh keypairs only.
      /fromSecretKey|fromSeed|mnemonic|bip39|secretKey\s*[:=]/i,
      /NEXT_PUBLIC_\w*(SECRET|PRIVATE|PASSWORD|API_KEY)/,
    ];
    for (const file of files("src")) {
      const content = readFileSync(file, "utf8");
      for (const pattern of forbidden)
        expect(content, `${file}: ${pattern}`).not.toMatch(pattern);
    }
  });
  it("keeps wallet signing, sending and skipPreflight in the reviewed modules only", () => {
    const allowed: [RegExp, string[]][] = [
      [
        /signTransaction/,
        ["src/lib/meteora/wallet-signer.ts", "src/lib/meteora/transactions.ts"],
      ],
      [/sendRawTransaction/, ["src/lib/meteora/transactions.ts"]],
      [/skipPreflight:\s*true/, ["src/lib/meteora/transactions.ts"]],
      [/Keypair\.generate/, ["src/lib/meteora/create-token.ts"]],
    ];
    for (const file of files("src")) {
      const content = readFileSync(file, "utf8");
      for (const [pattern, owners] of allowed)
        if (pattern.test(content))
          expect(owners, `${file} uses ${pattern}`).toContain(
            file.split(path.sep).join("/"),
          );
    }
    // The only skipPreflight: true is the rebroadcast of already-sent bytes.
    const tx = readFileSync("src/lib/meteora/transactions.ts", "utf8");
    expect(tx.match(/skipPreflight:\s*true/g)).toHaveLength(1);
    expect(tx).toMatch(/skipPreflight: false/);
  });
  it("keeps external-token trading disabled and removes EVM dependencies", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    for (const name of [
      "viem",
      "wagmi",
      "@retry/web3",
      "@coinbase/wallet-sdk",
      "@metamask/connect-evm",
      "@walletconnect/ethereum-provider",
    ])
      expect(pkg.dependencies[name]).toBeUndefined();
    expect(
      readFileSync("src/components/trade/trade-panel.tsx", "utf8"),
    ).toContain("<Button disabled>");
    const workflows = files(".github/workflows")
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(workflows).not.toMatch(/deploy-pages|pages: write|id-token: write/);
  });
});
