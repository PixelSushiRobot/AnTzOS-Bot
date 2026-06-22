// test-rpc.js
import { ethers } from "ethers";

// 👇 REPLACE THESE WITH YOUR DATA
const WALLET_TO_TEST = "0x012C6934d9e8e1422A48Af53948754b58F373169";
const CONTRACT_TO_TEST = "0xa7570f92efc664293e7a0efdc5c6c85cd182c189";
const TOKEN_ID_TO_TEST = "8"; // 💎 PUT YOUR NFT'S TOKEN ID NUMBER HERE (Look on OpenSea details)

const rpcNetworks = [
  { name: "Ethereum Mainnet", url: "https://ethereum-rpc.publicnode.com" }, // Swapped to a more stable public endpoint
  { name: "Base L2", url: "https://mainnet.base.org" },
  { name: "Arbitrum One", url: "https://arb1.arbitrum.io/rpc" },
];

// Modern ERC-1155 ABI standard lookup blueprint
const minimalAbi = [
  "function balanceOf(address account, uint256 id) view returns (uint256)",
];

async function runDiagnostic() {
  console.log("⚙️ Starting AnTzOS EVM ERC-1155 Diagnostic...");
  console.log(`Target Wallet:   ${WALLET_TO_TEST}`);
  console.log(`Target Contract: ${CONTRACT_TO_TEST}`);
  console.log(`Target Token ID: ${TOKEN_ID_TO_TEST}\n`);

  let foundMatch = false;

  for (const network of rpcNetworks) {
    try {
      console.log(`📡 Connecting to ${network.name}...`);
      const provider = new ethers.JsonRpcProvider(network.url);
      const contract = new ethers.Contract(
        CONTRACT_TO_TEST,
        minimalAbi,
        provider,
      );

      // Execute the ERC-1155 specific balance check
      const balance = await contract.balanceOf(
        WALLET_TO_TEST,
        TOKEN_ID_TO_TEST,
      );
      const stringBalance = balance.toString();

      console.log(`   ➡️  Success! Response Balance: ${stringBalance}`);

      if (parseInt(stringBalance) > 0) {
        console.log(
          `   🎉 MATCH FOUND! You own this ERC-1155 asset on ${network.name}.\n`,
        );
        foundMatch = true;
      } else {
        console.log(`   ℹ️ Connected, but balance is 0 on this network.\n`);
      }
    } catch (err) {
      console.log(`   ❌ Inactive/Error on ${network.name}.`);
      console.log(`      Reason: ${err.shortMessage || err.message}\n`);
    }
  }

  if (!foundMatch) {
    console.log(
      "❌ DIAGNOSTIC COMPLETE: No assets located with this Token ID configuration.",
    );
  } else {
    console.log(
      "✅ DIAGNOSTIC COMPLETE: ERC-1155 RPC queries are communicating perfectly!",
    );
  }
}

runDiagnostic();
