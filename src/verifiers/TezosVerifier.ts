import { IChainVerifier } from "./IChainVerifier";

export class TezosVerifier implements IChainVerifier {
  chainName = "tezos";

  async verifyOwnership(
    walletAddress: string,
    expectedCode: string,
  ): Promise<boolean> {
    try {
      // The .any parameter tells TzKT to match if the wallet is EITHER the Owner OR the target Address resolution line
      const res = await fetch(
        `https://api.tzkt.io/v1/domains?anyof.owner.address=${walletAddress}`,
      );
      const domains = await res.json();

      if (!Array.isArray(domains) || domains.length === 0) {
        console.log(
          `❌ No registered Tezos Domains found matching wallet address properties: ${walletAddress}`,
        );
        return false;
      }

      const cleanTargetCode = expectedCode.toLowerCase();

      // Loop through all domains found under either ownership or address mapping records
      for (const record of domains) {
        // Flatten the complete data layout object tree
        const flatRecordString = JSON.stringify(record).toLowerCase();

        if (flatRecordString.includes(cleanTargetCode)) {
          console.log(
            `✅ Match discovered inside domain data matrix for: ${record.name}`,
          );
          return true;
        }
      }

      console.log(
        `❌ Target code string was not detected inside the found domain parameters.`,
      );
      return false;
    } catch (error) {
      console.error("AnTzOS Multi-Field Domain Verification Failure:", error);
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
