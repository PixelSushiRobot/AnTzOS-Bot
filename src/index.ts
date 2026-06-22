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
const SIGNATURE_INPUT_CUSTOM_ID = "signaturePayload";
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
          description: "🪐 Run AnTzOS Gatekeeper verification to claim your community role.",
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
    await replyWithFailure(interaction, "Verification hit a temporary issue. Please try again.");
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
        .setDescription("Verify instantly with a Kukai signed message.")
        .setValue("tezos"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Ethereum / L2")
        .setDescription("Verify through Etherscan verified signatures.")
        .setValue("ethereum"),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

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
      .setLabel("Enter wallet and signature")
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await interaction.reply({
      content:
        `🔮 **AnTzOS Tezos Verification (Instant)**\n\n` +
        `1. Copy your code: \`${expectedCode}\`\n` +
        `2. Go to **[kukai.app/sign-message](https://kukai.app/sign-message)**\n` +
        `3. Connect your wallet, paste the code into the text field box, and click **Sign**.\n` +
        `4. Copy the long signature string generated.\n\n` +
        `*Use the button below to open the modal form and paste your address and signature payload.*`,
      components: [row],
      ephemeral: true,
    });
    return;
  }

  const button = new ButtonBuilder()
    .setCustomId(ETH_OPEN_MODAL_CUSTOM_ID)
    .setLabel("Enter wallet address")
    .setStyle(ButtonStyle.Primary);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  await interaction.update({
    content:
      `Your verification code is \`${expectedCode}\`.\n\n` +
      "Go to https://etherscan.io/verifiedSignatures, sign and publish a message with this code, then enter your wallet address.",
    components: [row],
  });
}

async function handleWalletButton(interaction: Interaction): Promise<void> {
  if (!interaction.isButton()) {
    return;
  }

  const session = activeSessions.get(interaction.user.id);

  if (
    !session ||
    (interaction.customId === ETH_OPEN_MODAL_CUSTOM_ID && session.chain !== "ethereum") ||
    (interaction.customId === TEZOS_OPEN_MODAL_CUSTOM_ID && session.chain !== "tezos")
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

  await interaction.showModal(createWalletModal(session.expectedCode, session.chain));
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
      content: "Verification must be completed inside the AnTzOS Discord server.",
      ephemeral: true,
    });
    return;
  }

  const config = chainConfigs[session.chain];
  const walletAddress = interaction.fields.getTextInputValue(WALLET_INPUT_CUSTOM_ID).trim();
  const signaturePayload =
    session.chain === "tezos"
      ? interaction.fields.getTextInputValue(SIGNATURE_INPUT_CUSTOM_ID).trim()
      : undefined;

  if (!config.roleId || !config.contractAddress) {
    await interaction.reply({
      content:
        `The ${config.displayName} verifier is missing its role or NFT contract configuration. Please tell an admin.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const ownsWallet = await config.verifier.verifyOwnership(
    walletAddress,
    session.expectedCode,
    signaturePayload,
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

function createWalletModal(expectedCode: string, chain: ChainKey): ModalBuilder {
  const walletInput = new TextInputBuilder()
    .setCustomId(WALLET_INPUT_CUSTOM_ID)
    .setLabel("Public Wallet Address")
    .setPlaceholder("Enter the public wallet address you are verifying.")
    .setRequired(true)
    .setStyle(TextInputStyle.Short);

  const modal = new ModalBuilder()
    .setCustomId(WALLET_MODAL_CUSTOM_ID)
    .setTitle(`Code: ${expectedCode}`)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(walletInput));

  if (chain === "tezos") {
    const signatureInput = new TextInputBuilder()
      .setCustomId(SIGNATURE_INPUT_CUSTOM_ID)
      .setLabel("Signature Payload")
      .setPlaceholder("Paste the long signature string generated by Kukai.")
      .setRequired(true)
      .setStyle(TextInputStyle.Paragraph);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(signatureInput),
    );
  }

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
