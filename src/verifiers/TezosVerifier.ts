import { IChainVerifier } from "./IChainVerifier";

export class TezosVerifier implements IChainVerifier {
  chainName = "tezos";

  async verifyOwnership(
    walletAddress: string,
    expectedCode: string,
  ): Promise<boolean> {
    try {
      const cleanTargetCode = expectedCode.toLowerCase();
      console.log(`🔍 Initiating AnTzOS scan for wallet: ${walletAddress}`);

      // 1. QUERY PATH A: Check if this wallet is the Domain OWNER (tz1aa9q...)
      const resOwner = await fetch(
        `https://api.tzkt.io/v1/domains?owner.eq=${walletAddress}`,
      );
      const domainsByOwner = await resOwner.json();

      if (Array.isArray(domainsByOwner) && domainsByOwner.length > 0) {
        for (const record of domainsByOwner) {
          const flatString = JSON.stringify(record).toLowerCase();
          if (flatString.includes(cleanTargetCode)) {
            console.log(
              `✅ Match found! Code detected in a Domain owned by this wallet.`,
            );
            return true;
          }
        }
      }

      // 2. QUERY PATH B: Check if a Domain points/resolves TO this wallet (tz1ghSu...)
      const resAddress = await fetch(
        `https://api.tzkt.io/v1/domains?address.eq=${walletAddress}`,
      );
      const domainsByAddress = await resAddress.json();

      if (Array.isArray(domainsByAddress) && domainsByAddress.length > 0) {
        for (const record of domainsByAddress) {
          const flatString = JSON.stringify(record).toLowerCase();
          if (flatString.includes(cleanTargetCode)) {
            console.log(
              `✅ Match found! Code detected in a Domain pointing to this wallet.`,
            );
            return true;
          }
        }
      }

      // If it fails both explicit tracks
      console.log(
        `❌ Checked domains owned by or pointing to ${walletAddress}. No matching code found.`,
      );
      return false;
    } catch (error) {
      console.error("AnTzOS Tezos Domain Dual-Query Failure:", error);
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
