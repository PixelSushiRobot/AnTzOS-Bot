import { IChainVerifier } from "./IChainVerifier.js";
import { ethers } from "ethers";

export class EthVerifier implements IChainVerifier {
  chainName = "ethereum";

  // Instant local cryptographic math verification (Still 100% free)
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

  // Free RPC-based balance scanner (Bypasses Etherscan entirely!)
  async verifyAssetOwnership(
    walletAddress: string,
    contractAddress: string,
  ): Promise<boolean> {
    const cleanWallet = walletAddress.toLowerCase();
    const cleanContract = contractAddress.toLowerCase();

    // High-performance public, free RPC nodes
    const rpcNetworks = [
      { name: "Ethereum Mainnet", url: "https://cloudflare-eth.com" },
      { name: "Base L2", url: "https://mainnet.base.org" },
      { name: "Arbitrum One", url: "https://arb1.arbitrum.io/rpc" },
    ];

    // The universal code layout (ABI) needed to ask a contract: "How many tokens does this user have?"
    const minimalAbi = [
      "function balanceOf(address owner) view returns (uint256)",
    ];

    for (const network of rpcNetworks) {
      try {
        console.log(`📡 Dialing ${network.name} RPC node directly...`);

        // Connect to the blockchain network directly
        const provider = new ethers.JsonRpcProvider(network.url);

        // Bind the NFT contract using our minimal blueprint
        const contract = new ethers.Contract(
          cleanContract,
          minimalAbi,
          provider,
        ) as {
          balanceOf?: (owner: string) => Promise<bigint>;
        };

        // Call the contract directly on-chain
        const balance = await contract.balanceOf?.(cleanWallet);
        if (balance === undefined) throw new Error("balanceOf not available");

        console.log(
          `📊 [${network.name}] Raw Balance Response: ${balance.toString()}`,
        );

        if (Number(balance) > 0) {
          console.log(
            `🎉 NFT Asset Confirmed! Wallet holds ${balance.toString()} item(s) on ${network.name}`,
          );
          return true;
        }
      } catch (err) {
        // This is normal; it will fail on networks where the contract doesn't exist
        console.log(
          `ℹ️ Contract not found or inactive on ${network.name}. Moving to next chain...`,
        );
      }
    }

    console.log(
      `❌ No active token balance found across Mainnet, Base, or Arbitrum for contract: ${cleanContract}`,
    );
    return false;
  }
}
