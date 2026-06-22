import { IChainVerifier } from "./IChainVerifier";
import { ethers } from "ethers";

export class EthVerifier implements IChainVerifier {
  chainName = "ethereum";
  private apiKey = process.env.ETHERSCAN_API_KEY || "";

  /**
   * ZERO-API LOCAL MATH VERIFICATION
   * Verifies an off-chain Ethereum signature instantly using local cryptography.
   */
  async verifyOwnership(
    walletAddress: string,
    expectedCode: string,
    signature?: string,
  ): Promise<boolean> {
    if (!signature) {
      console.log(
        "❌ EVM Verification Failed: No signature string provided to the modal.",
      );
      return false;
    }

    try {
      // ethers recovers the public wallet address that physically signed this exact text string
      const recoveredAddress = ethers.verifyMessage(expectedCode, signature);

      // Compare the recovered signing key against the address the user typed in
      const isValid =
        recoveredAddress.toLowerCase() === walletAddress.toLowerCase();

      if (isValid) {
        console.log(
          `✅ EVM Cryptographic Ownership verified locally for: ${walletAddress}`,
        );
        return true;
      }

      console.log(
        `❌ Address mismatch. Recovered signer: ${recoveredAddress}, Expected: ${walletAddress}`,
      );
      return false;
    } catch (error) {
      console.error("🔒 Local EVM Cryptographic Math Error:", error);
      return false;
    }
  }

  /**
   * Scans asset holdings across multiple EVM L2 networks using your free Etherscan V2 key
   */
  async verifyAssetOwnership(
    walletAddress: string,
    contractAddress: string,
  ): Promise<boolean> {
    const targetChains = ["1", "8453", "42161"]; // Mainnet, Base, Arbitrum

    for (const chainId of targetChains) {
      try {
        const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=addresstokenbalance&address=${walletAddress}&contractaddress=${contractAddress}&apikey=${this.apiKey}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status === "1" && parseInt(data.result) > 0) {
          console.log(
            `🎨 NFT Found! Wallet holds token on Chain ID: ${chainId}`,
          );
          return true;
        }
      } catch (err) {
        console.error(
          `Error querying EVM asset balance on chain ${chainId}:`,
          err,
        );
      }
    }
    return false;
  }
}
