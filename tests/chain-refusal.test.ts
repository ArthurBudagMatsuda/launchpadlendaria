import { describe, expect, it, vi } from "vitest";
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { sendExpectingFailure } from "./chain/harness";
function setup(error: unknown) {
  const signer = Keypair.fromSeed(new Uint8Array(32).fill(7)); // deterministic test key, no real funds
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: signer.publicKey,
      toPubkey: signer.publicKey,
      lamports: 0,
    }),
  );
  const connection = {
    getLatestBlockhash: vi.fn(async () => ({
      blockhash: "11111111111111111111111111111111",
      lastValidBlockHeight: 1,
    })),
    sendRawTransaction: vi.fn(async () => "test-signature"),
    confirmTransaction: vi.fn(async () => {
      throw { InstructionError: [0, { Custom: 6022 }] };
    }),
    getTransaction: vi.fn(async () =>
      error === undefined
        ? null
        : { meta: { err: error, logMessages: ["program refused"] } },
    ),
  };
  return { signer, tx, connection };
}
describe("adversarial chain evidence", () => {
  it("waits for delayed ledger indexing without resending the refused transaction", async () => {
    const error = { InstructionError: [0, { Custom: 6022 }] };
    const { signer, tx, connection } = setup(error);
    connection.getTransaction.mockResolvedValueOnce(null);
    const result = await sendExpectingFailure(
      connection as unknown as Connection,
      tx,
      [signer],
    );
    expect(result.error).toContain("6022");
    expect(connection.sendRawTransaction).toHaveBeenCalledOnce();
    expect(connection.getTransaction).toHaveBeenCalledTimes(2);
  });
  it("accepts an expected confirmation error only after reading the actual failed transaction", async () => {
    const { signer, tx, connection } = setup({
      InstructionError: [0, { Custom: 6022 }],
    });
    const result = await sendExpectingFailure(
      connection as unknown as Connection,
      tx,
      [signer],
    );
    expect(result.error).toContain("6022");
    expect(connection.getTransaction).toHaveBeenCalledOnce();
  });
  it.each([null, undefined])(
    "does not turn a confirmation exception into a proved refusal when ledger error is %s",
    async (error) => {
      const { signer, tx, connection } = setup(error);
      await expect(
        sendExpectingFailure(connection as unknown as Connection, tx, [signer]),
      ).rejects.toThrow(/not proved/);
    },
  );
});
