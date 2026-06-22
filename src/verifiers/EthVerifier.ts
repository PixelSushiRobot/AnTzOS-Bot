import { IChainVerifier } from "./IChainVerifier";
import { ethers } from "ethers";

export class EthVerifier implements IChainVerifier {
  chainName = "ethereum";
  private apiKey = process.env.ETHERSCAN_API_KEY || "";

  async verifyOwnership(
    walletAddress: string,
    expectedCode: string,
    signature?: string,
  ): Promise<boolean> {
    if (!signature) return false;
    try {
      const recoveredAddress = ethers.verifyMessage(expectedCode, signature);
      return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
    } catch (error) {
      console.error("🔒 Local EVM Cryptographic Math Error:", error);
      return false;
    }
  }

  async verifyAssetOwnership(
    walletAddress: string,
    contractAddress: string,
  ): Promise<boolean> {
    // 1 = Ethereum Mainnet, 8453 = Base, 42161 = Arbitrum
    const targetChains = ["1", "8453", "42161"];
    const targetWallet = walletAddress.toLowerCase();
    const cleanContract = contractAddress.toLowerCase();

    for (const chainId of targetChains) {
      try {
        console.log(
          `📡 Scanning Chain ${chainId} transfer history for contract: ${cleanContract}...`,
        );

        // Use tokennfttx — the most stable, globally supported Etherscan endpoint in existence
        const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokennfttx&address=${targetWallet}&contractaddress=${cleanContract}&page=1&offset=100&sort=asc&apikey=${this.apiKey}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.status === "1" && Array.isArray(data.result)) {
          let tokenCount = 0;

          // Process the transfer logs to calculate current ownership state
          for (const tx of data.result) {
            if (tx.to && tx.to.toLowerCase() === targetWallet) {
              tokenCount++; // User received an NFT
            }
            if (tx.from && tx.from.toLowerCase() === targetWallet) {
              tokenCount--; // User transferred/sold an NFT
            }
          }

          if (tokenCount > 0) {
            console.log(
              `🎉 NFT Confirmed! Wallet currently holds ${tokenCount} asset(s) on Chain ID: ${chainId}`,
            );
            return true;
          }
        }
      } catch (err) {
        console.error(
          `Error querying EVM asset trackers on chain ${chainId}:`,
          err,
        );
      }
    }

    console.log(
      `❌ No active token holdings located for contract: ${cleanContract}`,
    );
    return false;
  }
}
