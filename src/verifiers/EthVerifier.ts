import { IChainVerifier } from "./IChainVerifier";
import { ethers } from "ethers";

export class EthVerifier implements IChainVerifier {
  chainName = "ethereum";
  private apiKey = process.env.ETHERSCAN_API_KEY || "";

  /**
   * Verifies account ownership instantly using local cryptographic math.
   */
  async verifyOwnership(
    walletAddress: string,
    expectedCode: string,
    signature?: string,
  ): Promise<boolean> {
    if (!signature) {
      console.log("❌ EVM Verification Failed: No signature string provided.");
      return false;
    }

    try {
      const recoveredAddress = ethers.verifyMessage(expectedCode, signature);
      return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
    } catch (error) {
      console.error("🔒 Local EVM Cryptographic Math Error:", error);
      return false;
    }
  }

  /**
   * Scans the Etherscan V2 NFT inventory endpoint across Mainnet and L2 networks.
   */
  async verifyAssetOwnership(
    walletAddress: string,
    contractAddress: string,
  ): Promise<boolean> {
    // 1 = Ethereum Mainnet, 8453 = Base, 42161 = Arbitrum
    const targetChains = ["1", "8453", "42161"];

    for (const chainId of targetChains) {
      try {
        // Using addresstokeninventory to accurately parse ERC-721 / ERC-1155 NFT holdings
        const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=addresstokeninventory&address=${walletAddress}&contractaddress=${contractAddress}&apikey=${this.apiKey}`;

        const res = await fetch(url);
        const data = await res.json();

        // Etherscan returns status "1" and an array of token objects if NFTs are found
        if (
          data.status === "1" &&
          Array.isArray(data.result) &&
          data.result.length > 0
        ) {
          console.log(
            `🎨 NFT Found! Wallet owns ${data.result.length} item(s) on Chain ID: ${chainId}`,
          );
          return true;
        }
      } catch (err) {
        console.error(
          `Error querying EVM asset inventory on chain ${chainId}:`,
          err,
        );
      }
    }

    console.log(
      `❌ No NFT tokens found for wallet ${walletAddress} inside contract ${contractAddress}`,
    );
    return false;
  }
}
