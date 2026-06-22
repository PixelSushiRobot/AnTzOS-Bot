import {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Interaction,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { TezosVerifier } from "./verifiers/TezosVerifier.js";
import { EthVerifier } from "./verifiers/EthVerifier.js";
import "dotenv/config";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const GUILD_ID = process.env.GUILD_ID;

// Map the custom configurations directly
const verifiers = {
  tezos: {
    instance: new TezosVerifier(),
    role: process.env.TEZOS_ROLE_ID!,
    contract: process.env.TEZOS_NFT_CONTRACT_ADDRESS!,
  },
  ethereum: {
    instance: new EthVerifier(),
    role: process.env.ETH_ROLE_ID!,
    contract: process.env.ETH_NFT_CONTRACT_ADDRESS!,
  },
};

// Track temporary unique active generation strings
const activeSessions = new Map<
  string,
  { code: string; chain: "tezos" | "ethereum" }
>();

client.on(Events.ClientReady, async () => {
  console.log(`🐜 AnTzOS active as ${client.user?.tag}`);
  if (GUILD_ID) {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (guild) {
      await guild.commands.set([
        {
          name: "verify",
          description:
            "🪐 Run AnTzOS Gatekeeper verification to claim your community role.",
        },
      ]);
      console.log(
        `⚡ Clear slash command deployed exclusively to Guild: ${GUILD_ID}`,
      );
    }
  }
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  // 1. Initial Command Execution Setup
  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "verify"
  ) {
    const menu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_chain")
        .setPlaceholder("Choose your Network...")
        .addOptions([
          {
            label: "Tezos (AnTzOS Native)",
            value: "tezos",
            description:
              "Verify using your Tezos Domain profile profile metadata text.",
          },
          {
            label: "Ethereum / L2",
            value: "ethereum",
            description:
              "Verify using an instant local signature hash validation.",
          },
        ]),
    );
    await interaction.reply({
      content:
        "🪐 **Welcome to the AnTzOS Gatekeeper.** Select your network chain:",
      components: [menu],
      ephemeral: true,
    });
    return;
  }

  // 2. Network Selection Routing Logic
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "select_chain"
  ) {
    const selectedChain = interaction.values[0] as "tezos" | "ethereum";

    const code = `Antzos-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    activeSessions.set(interaction.user.id, { code, chain: selectedChain });

    let instructionText = "";

    if (selectedChain === "tezos") {
      instructionText =
        `🐜 **AnTzOS Tezos Verification**\n\n` +
        `1. Copy your unique code: \`${code}\`\n` +
        `2. Paste this code into your **Tezos Domains** fields (Nickname, Twitter, etc).\n` +
        `3. Save the transaction on-chain.\n\n` +
        `*Once saved, click the green button below to enter your wallet address.*`;
    } else {
      instructionText =
        `⛓️ **AnTzOS Ethereum & L2 Verification**\n\n` +
        `1. Copy your unique code: \`${code}\`\n` +
        `2. Open **[etherscan.io/verifiedSignatures](https://etherscan.io/verifiedSignatures)**\n` +
        `3. Connect your wallet, paste the code, and click **Sign**.\n` +
        `4. Copy the long **Signature Hash** (starts with \`0x\`).\n\n` +
        `*Once copied, click the green button below to paste your signature data.*`;
    }

    // CREATE A TRIGGER BUTTON: This gives the user a clean interaction anchor to open the modal
    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`open_modal_${selectedChain}`)
        .setLabel("🔓 Open Verification Form")
        .setStyle(ButtonStyle.Success),
    );

    // Update the message layout with your instructions text and the new button row
    await interaction.update({
      content: instructionText,
      components: [buttonRow],
    });
    return;
  }

  // 2.5 Button Trigger Logic to display the form reliably
  if (
    interaction.isButton() &&
    interaction.customId.startsWith("open_modal_")
  ) {
    const selectedChain = interaction.customId.replace("open_modal_", "") as
      | "tezos"
      | "ethereum";

    const modal = new ModalBuilder()
      .setCustomId("verify_modal")
      .setTitle(`${selectedChain.toUpperCase()} Verification`);

    const addrInput = new TextInputBuilder()
      .setCustomId("wallet_addr")
      .setLabel("Public Wallet Address")
      .setPlaceholder(selectedChain === "ethereum" ? "0x..." : "tz1...")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(addrInput),
    );

    if (selectedChain === "ethereum") {
      const sigInput = new TextInputBuilder()
        .setCustomId("crypto_sig")
        .setLabel("Signature Hash String")
        .setPlaceholder(
          "Paste your generated 0x... signature text hash output payload here",
        )
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(sigInput),
      );
    }

    // This interaction is fresh and direct, meaning the modal is guaranteed to pop up!
    await interaction.showModal(modal);
    return;
  }

  // 3. Modal Form Collection and Execution Node
  if (interaction.isModalSubmit() && interaction.customId === "verify_modal") {
    await interaction.deferReply({ ephemeral: true });

    const session = activeSessions.get(interaction.user.id);
    if (!session)
      return interaction.editReply(
        "Session expired. Please execute `/verify` to restart the authentication loop.",
      );

    const walletAddress = interaction.fields.getTextInputValue("wallet_addr");

    // Safely extract signature only if the active field profile calls for it
    let signature: string | undefined = undefined;
    try {
      signature = interaction.fields.getTextInputValue("crypto_sig");
    } catch {
      // Tezos route doesn't have crypto_sig in the form layout anymore, ignore it safely!
    }

    const config = verifiers[session.chain];

    // Pass everything cleanly down to the selected chain module strategy
    const isOwner = await config.instance.verifyOwnership(
      walletAddress,
      session.code,
      signature,
    );
    if (!isOwner)
      return interaction.editReply(
        "❌ Wallet verification check failed. Ensure code properties are unmodified.",
      );

    const holdsAsset = await config.instance.verifyAssetOwnership(
      walletAddress,
      config.contract,
    );
    if (!holdsAsset)
      return interaction.editReply(
        "❌ Ownership matched, but required NFT collection tokens were missing from this wallet.",
      );

    try {
      const member = await interaction.guild?.members.fetch(
        interaction.user.id,
      );
      await member?.roles.add(config.role);

      activeSessions.delete(interaction.user.id);
      await interaction.editReply(
        `🎉 **AnTzOS Verified!** Your specialized multi-chain holder role assignment is complete.`,
      );
    } catch (roleError) {
      console.error(roleError);
      await interaction.editReply(
        "❌ Verification successfully verified, but the bot could not assign the role. Check role hierarchy order permissions.",
      );
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
