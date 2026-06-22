import { IChainVerifier } from "./IChainVerifier.js";
import { ethers } from "ethers";

export class EthVerifier implements IChainVerifier {
  chainName = "ethereum";

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
    const cleanWallet = walletAddress.toLowerCase();
    const cleanContract = contractAddress.toLowerCase();

    // High-availability RPC nodes
    const rpcNetworks = [
      { name: "Ethereum Mainnet", url: "https://ethereum-rpc.publicnode.com" },
      { name: "Base L2", url: "https://mainnet.base.org" },
      { name: "Arbitrum One", url: "https://arb1.arbitrum.io/rpc" },
    ];

    // Standard ERC-1155 Batch Balance lookup blueprint
    const minimalAbi = [
      "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])",
    ];

    const tokenIdsToCheck = Array.from({ length: 30 }, (_, i) =>
      (i + 1).toString(),
    );
    const accountsArray = Array(tokenIdsToCheck.length).fill(cleanWallet);

    for (const network of rpcNetworks) {
      try {
        console.log(`📡 Querying batch balances on ${network.name}...`);
        const provider = new ethers.JsonRpcProvider(network.url);
        const contract = new ethers.Contract(
          cleanContract,
          minimalAbi,
          provider,
        ) as {
          balanceOfBatch?: (
            accounts: string[],
            ids: string[],
          ) => Promise<bigint[]>;
        };

        const balances = await contract.balanceOfBatch?.(
          accountsArray,
          tokenIdsToCheck,
        );
        if (!balances) throw new Error("balanceOfBatch not available");

        for (let i = 0; i < balances.length; i++) {
          const balance = balances[i];
          if (balance && Number(balance) > 0) {
            console.log(
              `🎉 Success! Wallet holds ${balance.toString()} unit(s) of Token ID #${tokenIdsToCheck[i]} on ${network.name}`,
            );
            return true;
          }
        }
      } catch (err) {
        console.log(`ℹ️ Contract query bypassed on ${network.name}.`);
      }
    }

    console.log(
      `❌ No active token holdings detected for contract: ${cleanContract}`,
    );
    return false;
  }
}
