import {
  Client,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import embedMessage from "./embeds/message.js";
import dotenv from "dotenv";
import logger from "./utils/logger.js";
import axios from "axios";
import csvParser from "csv-parser";

dotenv.config();
const TOKEN = process.env.DISCORD_TOKEN;
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, async (readyClient) => {
  logger.info(`✅ Ready! Logged in as ${readyClient.user.tag}`);

  const commandData = new SlashCommandBuilder()
    .setName("bulktip")
    .setDescription("Bulk tip to users using CSV file")
    .addAttachmentOption((option) =>
      option.setName("file").setDescription("CSV file").setRequired(true)
    );

  const guild = client.guilds.cache.first();
  if (guild) {
    await guild.commands.create(commandData);
    console.log("✅ Slash command /bulksend registered!");
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.content === "!show") {
    const { embed, components, files } = embedMessage.menu();
    await message.channel.send({
      embeds: [embed],
      components: [components],
      files,
    });
  }
  console.log(
    `New message from ${message.author.username}: ${message.content}`
  );
});

// Handle interaction events
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    await handleButtonInteraction(interaction);
  } else if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction);
  } else if (interaction.isCommand() && interaction.commandName === "bulktip") {
    await handleFileUpload(interaction);
  } else if (interaction.customId === "channel_select") {
    await handleChannelSelection(interaction);
  }
});

// Handle button interactions
async function handleButtonInteraction(interaction) {
  switch (interaction.customId) {
    case "balance":
      await interaction.deferReply({ ephemeral: true });
      await showBalance(interaction);
      break;
    case "history":
      await interaction.deferReply({ ephemeral: true });
      await showHistory(interaction);
      break;
    case "deposit":
    case "withdraw":
      await showTransactionModal(interaction);
      break;
    case "ybroadcast":
      await interaction.deferReply({ ephemeral: true });
      await showChannelSelection(interaction);
      break;
    case "nbroadcast":
      await interaction.reply({ content: "Okie", ephemeral: true });
      break;
  }
}

// Show deposit/withdraw modal
async function showTransactionModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(interaction.customId)
    .setTitle(
      `${
        interaction.customId === "deposit" ? "Deposit" : "Withdraw"
      } Tip Balance`
    );

  const amountInput = new TextInputBuilder()
    .setCustomId("amount")
    .setLabel("Amount")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
  await interaction.showModal(modal);
}

async function showHistory(interaction) {
  const history = await embedMessage.history(interaction);
  await interaction.editReply(history);
}

async function showBalance(interaction) {
  const { embed, components } = await embedMessage.balance(interaction);
  await interaction.editReply({
    embeds: [embed],
    components: [components],
  });
}

// Handle modal submissions
async function handleModalSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const amount = interaction.fields.getTextInputValue("amount");
  const { embed } =
    interaction.customId === "deposit"
      ? await embedMessage.deposit(interaction, amount)
      : await embedMessage.withdraw(interaction, amount);

  await interaction.editReply({ embeds: [embed] });
}

// Show dropdown to select a channel
async function showChannelSelection(interaction) {
  const channels = interaction.guild.channels.cache
    .filter((channel) => channel.isTextBased())
    .map((channel) => ({ label: `#${channel.name}`, value: channel.id }));

  if (channels.length === 0) {
    return interaction.editReply({
      content: "❌ No available text channels!",
      ephemeral: true,
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("channel_select")
    .setPlaceholder("Select a channel...")
    .addOptions(channels);

  await interaction.editReply({
    content: "🔽 Select a channel below:",
    components: [new ActionRowBuilder().addComponents(selectMenu)],
    ephemeral: true,
  });
}

// Handle CSV file upload
async function handleFileUpload(interaction) {
  const attachment = interaction.options.getAttachment("file");
  if (!attachment || !attachment.name.endsWith(".csv")) {
    return interaction.reply({
      content: "❌ Please upload a valid CSV file!",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });
  try {
    const response = await axios.get(attachment.url, {
      responseType: "stream",
    });
    const results = [];

    response.data
      .pipe(csvParser())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        const parsedData = results.map((item) => ({
          userId: item.userId,
          amount: parseInt(item.amount, 10),
          note: item.note,
        }));
        console.log(parsedData); // Log the parsed data for debugging
        const { embed, components } = await embedMessage.bulktip(
          interaction,
          parsedData
        );
        await interaction.editReply({
          embeds: [embed],
          components: components ? [components] : [], // Wrap components in an array if they exist
        });
      });
  } catch (error) {
    console.error("❌ Error processing CSV:", error);
    await interaction.editReply({
      content: "❌ Failed to process CSV file.",
      embeds: [embedMessage.errorEmbed("Bulk Tip Failed", error.message)],
    });
  }
}

// Handle channel selection
async function handleChannelSelection(interaction) {
  const selectedChannelId = interaction.values[0];
  const channel = interaction.guild.channels.cache.get(selectedChannelId);
  const { embed } = await embedMessage.broadcast(interaction, channel);
  try {
    await channel.send({ embeds: [embed] });
    await interaction.reply({
      content: `✅ Message Broadcasted to: <#${channel.id}>`,
      ephemeral: true,
    });
  } catch (error) {
    console.error("❌ Error sending message:", error);
  }
}

client.login(TOKEN);
