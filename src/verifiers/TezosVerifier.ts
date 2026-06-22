import { verifySignature } from "@taquito/utils";
import type { IChainVerifier } from "./IChainVerifier.js";

type TzktTokenBalanceResponse = Array<{
  balance?: unknown;
}>;

export class TezosVerifier implements IChainVerifier {
  public chainName = "tezos";

  // Instant verification using mathematical verification with no profile API delay.
  public async verifyOwnership(
    walletAddress: string,
    expectedCode: string,
    signature?: string,
  ): Promise<boolean> {
    if (!signature) {
      return false;
    }

    try {
      const messageHex = Buffer.from(expectedCode, "utf8").toString("hex");

      return verifySignature(messageHex, walletAddress, signature);
    } catch (error) {
      console.error("Tezos Cryptographic Signature Verification Error:", error);
      return false;
    }
  }

  public async verifyAssetOwnership(
    walletAddress: string,
    contractAddress: string,
  ): Promise<boolean> {
    try {
      const params = new URLSearchParams({
        account: walletAddress,
        "token.contract": contractAddress,
      });
      const res = await fetch(
        `https://api.tzkt.io/v1/tokens/balances?${params.toString()}`,
      );

      if (!res.ok) {
        return false;
      }

      const data = (await res.json()) as TzktTokenBalanceResponse;
      const firstBalance = data[0]?.balance;

      return data.length > 0 && Number.parseInt(String(firstBalance), 10) > 0;
    } catch {
      return false;
    }
  }
}
