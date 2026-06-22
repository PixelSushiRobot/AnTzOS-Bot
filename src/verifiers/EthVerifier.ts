import { IChainVerifier } from "./IChainVerifier.js";
import { ethers } from "ethers";

export class EthVerifier implements IChainVerifier {
  chainName = "ethereum";

  // Local cryptographic signature math (100% Free)
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

  // Scrapes ERC-1155 Transfer Events over public RPC nodes for any Token ID matches
  async verifyAssetOwnership(
    walletAddress: string,
    contractAddress: string,
  ): Promise<boolean> {
    const targetWallet = walletAddress.toLowerCase();
    const cleanContract = contractAddress.toLowerCase();

    const rpcNetworks = [
      { name: "Ethereum Mainnet", url: "https://ethereum-rpc.publicnode.com" },
      { name: "Base L2", url: "https://mainnet.base.org" },
      { name: "Arbitrum One", url: "https://arb1.arbitrum.io/rpc" },
    ];

    // Standard ERC-1155 Transfer Event Hashing Blueprints
    // TransferSingle: Hashed topic signature for single token movements
    const TRANSFER_SINGLE_TOPIC =
      "0xc3d5a22cd3e74753541de4a9da167199738bf2b940d50d5a5e07b8c566c18871";

    for (const network of rpcNetworks) {
      try {
        console.log(
          `📡 Scanning ${network.name} RPC events for contract: ${cleanContract}...`,
        );
        const provider = new ethers.JsonRpcProvider(network.url);

        // 1. Check if the user received any individual tokens from this contract
        const incomingLogs = await provider.getLogs({
          fromBlock: "0x0",
          toBlock: "latest",
          address: cleanContract,
          topics: [
            TRANSFER_SINGLE_TOPIC,
            null,
            null,
            ethers.zeroPadValue(targetWallet, 32),
          ],
        });

        if (incomingLogs.length > 0) {
          const tokenBalances: { [id: string]: number } = {};

          for (const log of incomingLogs) {
            try {
              const parsedData = ethers.AbiCoder.defaultAbiCoder().decode(
                ["uint256", "uint256"],
                log.data,
              );
              const tokenId = parsedData[0].toString();
              const value = Number(parsedData[1]);
              tokenBalances[tokenId] = (tokenBalances[tokenId] || 0) + value;
            } catch (e) {
              continue;
            }
          }

          const outgoingLogs = await provider.getLogs({
            fromBlock: "0x0",
            toBlock: "latest",
            address: cleanContract,
            topics: [
              TRANSFER_SINGLE_TOPIC,
              null,
              ethers.zeroPadValue(targetWallet, 32),
              null,
            ],
          });

          for (const log of outgoingLogs) {
            try {
              const parsedData = ethers.AbiCoder.defaultAbiCoder().decode(
                ["uint256", "uint256"],
                log.data,
              );
              const tokenId = parsedData[0].toString();
              const value = Number(parsedData[1]);
              if (tokenBalances[tokenId]) {
                tokenBalances[tokenId] -= value;
              }
            } catch (e) {
              continue;
            }
          }

          for (const id in tokenBalances) {
            const balance = tokenBalances[id] ?? 0;
            if (balance > 0) {
              console.log(
                `🎉 ERC-1155 Token Owned! Wallet holds ${balance} unit(s) of Token ID: #${id} on ${network.name}`,
              );
              return true;
            }
          }
        }
      } catch (err) {
        console.log(
          `ℹ️ Asset scanning bypassed or unsupported on ${network.name}.`,
        );
      }
    }

    console.log(
      `❌ No active ERC-1155 token holdings found across Mainnet, Base, or Arbitrum for: ${cleanContract}`,
    );
    return false;
  }
}
