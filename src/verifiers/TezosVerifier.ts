import { IChainVerifier } from "./IChainVerifier";

export class TezosVerifier implements IChainVerifier {
  chainName = "tezos";

  async verifyOwnership(
    walletAddress: string,
    expectedCode: string,
  ): Promise<boolean> {
    try {
      // 1. Query the dedicated TzKT Domains API filtering by the owner's address
      const res = await fetch(
        `https://api.tzkt.io/v1/domains?owner=${walletAddress}`,
      );
      const data = await res.json();

      // If the user doesn't own any .tez domains, exit immediately
      if (!Array.isArray(data) || data.length === 0) {
        console.log(`❌ No Tezos Domains found for address: ${walletAddress}`);
        return false;
      }

      // 2. Convert the entire domain records array (including data, data.nickname, etc.) to lowercase text
      const rawDomainsString = JSON.stringify(data).toLowerCase();
      const cleanTargetCode = expectedCode.toLowerCase();

      // 3. Search for the AnTzOS verification code string
      return rawDomainsString.includes(cleanTargetCode);
    } catch (error) {
      console.error("AnTzOS Tezos Domains API Error:", error);
      return false;
    }
  }

  async verifyAssetOwnership(
    walletAddress: string,
    contractAddress: string,
  ): Promise<boolean> {
    try {
      const res = await fetch(
        `https://api.tzkt.io/v1/tokens/balances?account=${walletAddress}&token.contract=${contractAddress}`,
      );
      const data = await res.json();
      return data.length > 0 && parseInt(data[0].balance) > 0;
    } catch (error) {
      console.error("AnTzOS Tezos Balance Check Error:", error);
      return false;
    }
  }
}
