import type { IChainVerifier } from "./IChainVerifier.js";

type TzktAccountResponse = {
  alias?: string;
  metadata?: unknown;
};

type TzktTokenBalanceResponse = Array<{
  balance?: string;
}>;

export class TezosVerifier implements IChainVerifier {
  public chainName = "tezos";

  /**
   * Verifies account ownership by checking if the user added the unique
   * AnTzOS token code into their global Tezos Profile or Tezos Domain metadata.
   */
  public async verifyOwnership(
    walletAddress: string,
    expectedCode: string,
  ): Promise<boolean> {
    try {
      const res = await fetch(`https://api.tzkt.io/v1/accounts/${walletAddress}`);
      const data = (await res.json()) as TzktAccountResponse;

      // 1. Check native account alias properties managed instantly by TzKT.
      if (data.alias?.toLowerCase().includes(expectedCode.toLowerCase())) {
        return true;
      }

      // 2. Fallback: Flatten the entire profile metadata layer (Tezos Domains / TZ Profiles)
      // into a single string to hunt down the matching code string.
      const rawDataString = JSON.stringify(data.metadata || {}).toLowerCase();

      return rawDataString.includes(expectedCode.toLowerCase());
    } catch (error) {
      console.error("AnTzOS Tezos Indexer Error:", error);
      return false;
    }
  }

  /**
   * Scans the TzKT token balance engine to confirm they hold the target NFT collection.
   */
  public async verifyAssetOwnership(
    walletAddress: string,
    contractAddress: string,
  ): Promise<boolean> {
    try {
      const res = await fetch(
        `https://api.tzkt.io/v1/tokens/balances?account=${walletAddress}&token.contract=${contractAddress}`,
      );
      const data = (await res.json()) as TzktTokenBalanceResponse;

      // Validates that the account tracks a real balance greater than zero.
      return data.length > 0 && parseInt(data[0]?.balance ?? "0") > 0;
    } catch (error) {
      console.error("AnTzOS Tezos Balance Check Error:", error);
      return false;
    }
  }
}
