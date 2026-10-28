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
  it("contains no EVM clients, former featured contract, mock fixtures or transaction builders in active source", () => {
    const forbidden = [
      /@retry\/web3/,
      /from ["'](?:viem|wagmi|@coinbase|@metamask|@walletconnect)/,
      /0xb200000000000000000000585fd80c20af698f01/i,
      /eth_requestAccounts|wallet_switchEthereumChain|eth_call/,
      /signAndSendTransaction|signTransaction|sendTransaction|signMessage/,
      /fixtures\/|generateHistory|demo-market/,
      /localStorage\.clear\(/,
    ];
    for (const file of files("src")) {
      const content = readFileSync(file, "utf8");
      for (const pattern of forbidden)
        expect(content, `${file}: ${pattern}`).not.toMatch(pattern);
    }
  });
  it("keeps financial execution disabled and removes EVM dependencies", () => {
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
