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

    const rpcNetworks = [
      { name: "Ethereum Mainnet", url: "https://ethereum-rpc.publicnode.com" },
      { name: "Base L2", url: "https://mainnet.base.org" },
      { name: "Arbitrum One", url: "https://arb1.arbitrum.io/rpc" },
    ];

    // Hybrid ABI that supports reading BOTH ERC-721 and ERC-1155 configurations
    const hybridAbi = [
      "function balanceOf(address owner) view returns (uint256)",
      "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])",
      "function supportsInterface(bytes4 interfaceId) view returns (bool)",
    ];

    for (const network of rpcNetworks) {
      try {
        console.log(`📡 Dialing ${network.name} RPC for hybrid check...`);
        const provider = new ethers.JsonRpcProvider(network.url);
        const contract = new ethers.Contract(
          cleanContract,
          hybridAbi,
          provider,
        ) as {
          supportsInterface?: (interfaceId: string) => Promise<boolean>;
          balanceOf?: (owner: string) => Promise<bigint>;
          balanceOfBatch?: (
            accounts: string[],
            ids: string[],
          ) => Promise<bigint[]>;
        };

        let isErc1155 = false;
        try {
          const supports1155 = await contract.supportsInterface?.("0xd9b67a26");
          isErc1155 = supports1155 ?? false;
        } catch {
          // If supportsInterface fails or isn't present, we fall back to ERC-721
        }

        if (isErc1155) {
          console.log(
            `➡️ Detected ERC-1155 Multi-Token Contract on ${network.name}`,
          );
          const tokenIdsToCheck = Array.from({ length: 30 }, (_, i) =>
            (i + 1).toString(),
          );
          const accountsArray = Array(tokenIdsToCheck.length).fill(cleanWallet);

          const balances = await contract.balanceOfBatch?.(
            accountsArray,
            tokenIdsToCheck,
          );
          if (!balances) throw new Error("balanceOfBatch not available");

          for (let i = 0; i < balances.length; i++) {
            if (Number(balances[i]) > 0) {
              console.log(`🎉 ERC-1155 Holder Confirmed via Batch Lookup!`);
              return true;
            }
          }
        } else {
          console.log(
            `➡️ Detected Standard ERC-721 NFT Contract on ${network.name}`,
          );
          const balance = await contract.balanceOf?.(cleanWallet);

          if (balance && Number(balance) > 0) {
            console.log(
              `🎉 ERC-721 Holder Confirmed! Wallet holds ${balance.toString()} item(s).`,
            );
            return true;
          }
        }
      } catch (err) {
        console.log(`ℹ️ Contract address not responsive on ${network.name}.`);
      }
    }

    console.log(
      `❌ Verification Complete: No active balances found on any network.`,
    );
    return false;
  }
}
