import "dotenv/config";
import { randomBytes } from "node:crypto";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  GatewayIntentBits,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type Interaction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { EthVerifier } from "./verifiers/EthVerifier.js";
import type { IChainVerifier } from "./verifiers/IChainVerifier.js";
import { TezosVerifier } from "./verifiers/TezosVerifier.js";

type ChainKey = "tezos" | "ethereum";

type VerificationSession = {
  chain: ChainKey;
  expectedCode: string;
  createdAt: number;
};

type ChainConfig = {
  displayName: string;
  roleId: string;
  contractAddress: string;
  verifier: IChainVerifier;
};

const NETWORK_SELECT_CUSTOM_ID = "antzos:verify:network";
const ETH_OPEN_MODAL_CUSTOM_ID = "antzos:verify:ethereum-wallet";
const TEZOS_OPEN_MODAL_CUSTOM_ID = "antzos:verify:tezos-wallet";
const WALLET_MODAL_CUSTOM_ID = "antzos:verify:wallet-modal";
const WALLET_INPUT_CUSTOM_ID = "walletAddress";
const GUILD_ID = process.env.GUILD_ID;

const activeSessions = new Map<string, VerificationSession>();

const chainConfigs: Record<ChainKey, ChainConfig> = {
  tezos: {
    displayName: "Tezos (AnTzOS Native)",
    roleId: process.env.TEZOS_ROLE_ID ?? "",
    contractAddress: process.env.TEZOS_NFT_CONTRACT_ADDRESS ?? "",
    verifier: new TezosVerifier(),
  },
  ethereum: {
    displayName: "Ethereum / L2",
    roleId: process.env.ETH_ROLE_ID ?? "",
    contractAddress: process.env.ETH_NFT_CONTRACT_ADDRESS ?? "",
    verifier: new EthVerifier(),
  },
};

// Minimal, secure intents needed exclusively for slash commands and role management.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Required to modify member roles.
  ],
});

client.on("ready", async () => {
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
      console.log(`⚡ Slash commands deployed instantly to Guild: ${GUILD_ID}`);
    }
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleVerifyCommand(interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      await handleNetworkSelection(interaction);
      return;
    }

    if (interaction.isButton()) {
      await handleWalletButton(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleWalletModal(interaction);
    }
  } catch (error) {
    console.error("Interaction handling failed:", error);
    await replyWithFailure(
      interaction,
      "Verification hit a temporary issue. Please try again.",
    );
  }
});

async function handleVerifyCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (interaction.commandName !== "verify") {
    return;
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(NETWORK_SELECT_CUSTOM_ID)
    .setPlaceholder("Choose your verification network")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Tezos (AnTzOS Native)")
        .setDescription("Verify through your TzKT alias or profile metadata.")
        .setValue("tezos"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Ethereum / L2")
        .setDescription("Verify through Etherscan verified signatures.")
        .setValue("ethereum"),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    selectMenu,
  );

  await interaction.reply({
    content: "Choose the network you want to verify with.",
    components: [row],
    ephemeral: true,
  });
}

async function handleNetworkSelection(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  if (interaction.customId !== NETWORK_SELECT_CUSTOM_ID) {
    return;
  }

  const selectedChain = interaction.values[0] as ChainKey | undefined;

  if (!selectedChain || !isSupportedChain(selectedChain)) {
    await interaction.reply({
      content: "That network is not available for verification yet.",
      ephemeral: true,
    });
    return;
  }

  const expectedCode = createVerificationCode();
  activeSessions.set(interaction.user.id, {
    chain: selectedChain,
    expectedCode,
    createdAt: Date.now(),
  });

  if (selectedChain === "tezos") {
    const button = new ButtonBuilder()
      .setCustomId(TEZOS_OPEN_MODAL_CUSTOM_ID)
      .setLabel("Validation check")
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await interaction.reply({
      content:
        `🐜 **AnTzOS Tezos Verification (Frictionless)**\n\n` +
        `1. Copy your unique token code: \`${expectedCode}\`\n` +
        `2. Paste this code into your profile settings on **Tezos Domains** or your global account description.\n` +
        `3. Re-run \`/verify\` and click the validation check button to enter your wallet address!`,
      components: [row],
      ephemeral: true,
    });
    return;
  }

  const button = new ButtonBuilder()
    .setCustomId(ETH_OPEN_MODAL_CUSTOM_ID)
    .setLabel("Validation check")
    .setStyle(ButtonStyle.Primary);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  await interaction.reply({
    content:
      `⛓️ **AnTzOS Ethereum & L2 Verification (Local Validation)**\n\n` +
      `1. Copy your unique token code: \`${expectedCode}\`\n` +
      `2. Open **[etherscan.io/verifiedSignatures](https://etherscan.io/verifiedSignatures)**\n` +
      `3. Connect your wallet, paste the code into the text input box, and click **Sign**.\n` +
      `4. **Do not click publish!** Simply copy the long text hash under **Signature Hash** (starts with \`0x\`).\n\n` +
      `*Re-run \`/verify\` right now to submit your verification form modal context fields!*`,
    components: [row],
    ephemeral: true,
  });
}

async function handleWalletButton(interaction: Interaction): Promise<void> {
  if (!interaction.isButton()) {
    return;
  }

  const session = activeSessions.get(interaction.user.id);

  if (
    !session ||
    (interaction.customId === ETH_OPEN_MODAL_CUSTOM_ID &&
      session.chain !== "ethereum") ||
    (interaction.customId === TEZOS_OPEN_MODAL_CUSTOM_ID &&
      session.chain !== "tezos")
  ) {
    await interaction.reply({
      content: "Your verification session expired. Run `/verify` again.",
      ephemeral: true,
    });
    return;
  }

  if (
    interaction.customId !== ETH_OPEN_MODAL_CUSTOM_ID &&
    interaction.customId !== TEZOS_OPEN_MODAL_CUSTOM_ID
  ) {
    return;
  }

  await interaction.showModal(
    createWalletModal(session.expectedCode, session.chain),
  );
}

async function handleWalletModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  if (interaction.customId !== WALLET_MODAL_CUSTOM_ID) {
    return;
  }

  const session = activeSessions.get(interaction.user.id);

  if (!session) {
    await interaction.reply({
      content: "Your verification session expired. Run `/verify` again.",
      ephemeral: true,
    });
    return;
  }

  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({
      content:
        "Verification must be completed inside the AnTzOS Discord server.",
      ephemeral: true,
    });
    return;
  }

  const config = chainConfigs[session.chain];
  const walletAddress = interaction.fields
    .getTextInputValue(WALLET_INPUT_CUSTOM_ID)
    .trim();

  if (!config.roleId || !config.contractAddress) {
    await interaction.reply({
      content: `The ${config.displayName} verifier is missing its role or NFT contract configuration. Please tell an admin.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const ownsWallet = await config.verifier.verifyOwnership(
    walletAddress,
    session.expectedCode,
  );

  if (!ownsWallet) {
    await interaction.editReply(
      "Wallet ownership could not be verified. Confirm the code is published, then try `/verify` again.",
    );
    return;
  }

  const ownsAsset = await config.verifier.verifyAssetOwnership(
    walletAddress,
    config.contractAddress,
  );

  if (!ownsAsset) {
    await interaction.editReply(
      "Wallet ownership passed, but the target AnTzOS NFT was not found in that wallet.",
    );
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  await member.roles.add(config.roleId);
  activeSessions.delete(interaction.user.id);

  await interaction.editReply(
    `Success. ${config.displayName} ownership verified and your AnTzOS role has been assigned.`,
  );
}

function createWalletModal(
  expectedCode: string,
  chain: ChainKey,
): ModalBuilder {
  const walletInput = new TextInputBuilder()
    .setCustomId(WALLET_INPUT_CUSTOM_ID)
    .setLabel("Public Wallet Address")
    .setPlaceholder("Enter the public wallet address you are verifying.")
    .setRequired(true)
    .setStyle(TextInputStyle.Short);

  const modal = new ModalBuilder()
    .setCustomId(WALLET_MODAL_CUSTOM_ID)
    .setTitle(`${chain.toUpperCase()} Verification`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(walletInput),
    );

  // EVERY chain now collects the raw signature input string dynamically!
  const sigInput = new TextInputBuilder()
    .setCustomId("crypto_sig")
    .setLabel("Signature String Payload")
    .setPlaceholder(
      chain === "ethereum"
        ? "Paste your 0x... signature hash output"
        : "Paste your domain signature fields",
    )
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(sigInput),
  );

  return modal;
}

function createVerificationCode(): string {
  return `AnTzOS-${randomBytes(4).toString("hex").toUpperCase()}-2027`;
}

function isSupportedChain(chain: string): chain is ChainKey {
  return chain === "tezos" || chain === "ethereum";
}

async function replyWithFailure(
  interaction: Interaction,
  message: string,
): Promise<void> {
  if (!interaction.isRepliable()) {
    return;
  }

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ content: message, ephemeral: true });
    return;
  }

  await interaction.reply({ content: message, ephemeral: true });
}

const discordToken = process.env.DISCORD_TOKEN;

if (!discordToken) {
  throw new Error("DISCORD_TOKEN is required to start AnTzOS.");
}

await client.login(discordToken);
