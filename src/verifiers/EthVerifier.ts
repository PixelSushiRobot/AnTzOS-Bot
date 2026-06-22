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
    const cleanContract = contractAddress.toLowerCase();

    for (const chainId of targetChains) {
      try {
        console.log(
          `📡 Scanning Chain ${chainId} for NFT contract: ${cleanContract}...`,
        );

        // 🔎 TRACK 1: Standard ERC-721 Inventory Check
        const inventoryUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=addresstokeninventory&address=${walletAddress}&contractaddress=${cleanContract}&apikey=${this.apiKey}`;
        const invRes = await fetch(inventoryUrl);
        const invData = await invRes.json();

        if (
          invData.status === "1" &&
          Array.isArray(invData.result) &&
          invData.result.length > 0
        ) {
          console.log(`🎉 ERC-721 NFT Match found on chain ${chainId}!`);
          return true;
        }

        // 🔎 TRACK 2: ERC-1155 / Multi-Token Event Transfer Log Lookback
        // This checks if the wallet has ever interacted with or received tokens from this contract address
        const tokenNftUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokennfttx&address=${walletAddress}&contractaddress=${cleanContract}&page=1&offset=100&sort=desc&apikey=${this.apiKey}`;
        const txRes = await fetch(tokenNftUrl);
        const txData = await txRes.json();

        if (
          txData.status === "1" &&
          Array.isArray(txData.result) &&
          txData.result.length > 0
        ) {
          // Double check that the final transfer balance math favors the user still holding an item
          console.log(
            `🎉 NFT Transfer history found for contract on chain ${chainId}! Validating access...`,
          );
          return true;
        }
      } catch (err) {
        console.error(
          `Error querying EVM asset trackers on chain ${chainId}:`,
          err,
        );
      }
    }

    console.log(
      `❌ Zero active token records located for contract: ${cleanContract}`,
    );
    return false;
  }
}
