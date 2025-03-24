import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} from "discord.js";
import dotenv from "dotenv";
import DripAPI from "../DRIP/index.js";
import { db } from "../database.js";
import logger from "../utils/logger.js";
import { time } from "console";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config();

const DRIP = new DripAPI();
const bulkTipCache = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EmbedMessage {
  static BOT_NAME = process.env.BOT_NAME;
  static POINT_NAME = process.env.POINT_NAME;

  /**
   * Generates the main menu embed with balance and history buttons.
   */
  static menu() {
    const imagePath = path.join(__dirname, "../img", "flowsend.jpg");
    const attachment = new AttachmentBuilder(imagePath);
    const embed = new EmbedBuilder()
      .setTitle(`Welcome To ${this.BOT_NAME}!`)
      .setDescription(
        `**${this.BOT_NAME}** is a Discord bot that allows users to easily tip in bulk.\n\n` +
          "**Get Started!**\n" +
          "- 💰 **Balance** – Check your current account balance\n" +
          "- 📄 **History** – View your transaction history\n" +
          "- 💸 `/bulktip` – Start a bulk tip transaction"
      )
      .setImage("attachment://flowsend.jpg");

    const components = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("balance")
        .setLabel("💰 Balance")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("history")
        .setLabel("📄 History")
        .setStyle(ButtonStyle.Secondary)
    );

    return { embed, components, files: [attachment] };
  }

  /**
   * Retrieves user balance and generates an embed with deposit/withdraw buttons.
   */
  static async balance(interaction) {
    const { username, id } = interaction.user;
    const pfp = interaction.user.displayAvatarURL();
    const balance = await DRIP.getBalance(id);
    let tipBalance = db
      .prepare("SELECT balance FROM users WHERE id = ?")
      .get(id);

    if (!tipBalance) {
      db.prepare("INSERT INTO users (id, balance) VALUES (?, ?)").run(id, 0);
      tipBalance = { balance: 0 };
    }

    const embed = new EmbedBuilder()
      .setTitle(`${username}'s Balance`)
      .setDescription(
        `💰 **Balance:** ${balance} ${this.POINT_NAME}\n💸 **Tip Balance:** ${tipBalance.balance} ${this.POINT_NAME}`
      )
      .setThumbnail(pfp);

    const components = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("deposit")
        .setLabel("▲ Deposit")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("withdraw")
        .setLabel("▼ Withdraw")
        .setStyle(ButtonStyle.Danger)
    );

    return { embed, components };
  }

  /**
   * Handles deposit transactions.
   */
  static async deposit(interaction, amount) {
    try {
      const userId = interaction.user.id;
      await DRIP.updateBalance(userId, -parseInt(amount));
      db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(
        parseInt(amount),
        userId
      );
      const tipBalance = db
        .prepare("SELECT balance FROM users WHERE id = ?")
        .get(userId).balance;
      const balance = await DRIP.getBalance(userId);
      const embed = new EmbedBuilder()
        .setTitle("✅ Deposit Success")
        .setDescription(
          `- 💰 -${amount} Balance\n- 💸 +${amount} Tip Balance\n\n` +
            `**Current Balance**\n- 💰 **Balance:** ${balance} ${this.POINT_NAME}\n- 💸 **Tip Balance:** ${tipBalance} ${this.POINT_NAME}`
        );

      return { embed };
    } catch (error) {
      return { embed: this.errorEmbed("Deposit Failed", error) };
    }
  }

  /**
   * Handles withdrawal transactions.
   */
  static async withdraw(interaction, amount) {
    try {
      const userId = interaction.user.id;
      await DRIP.updateBalance(userId, parseInt(amount));
      db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(
        parseInt(amount),
        userId
      );
      const tipBalance = db
        .prepare("SELECT balance FROM users WHERE id = ?")
        .get(userId).balance;
      const balance = await DRIP.getBalance(userId);
      const embed = new EmbedBuilder()
        .setTitle("✅ Withdraw Success")
        .setDescription(
          `- 💰 +${amount} Balance\n- 💸 -${amount} Tip Balance\n\n` +
            `**Current Balance**\n- 💰 **Balance:** ${balance}\n- 💸 **Tip Balance:** ${tipBalance}`
        );

      return { embed };
    } catch (error) {
      return { embed: this.errorEmbed("Withdraw Failed", error) };
    }
  }

  /**
   * Processes bulk tipping and provides an option to broadcast the transaction.
   */
  static async bulktip(interaction, data) {
    const totalAmount = data.reduce((sum, entry) => sum + entry.amount, 0);
    const tipBalance = db
      .prepare("SELECT balance FROM users WHERE id = ?")
      .get(interaction.user.id).balance;

    if (tipBalance < totalAmount) {
      return {
        embed: this.errorEmbed("Bulk Tip Failed", "Insufficient Tip Balance"),
        components: new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("balance")
            .setLabel("💰 Balance")
            .setStyle(ButtonStyle.Primary)
        ),
      };
    }
    try {
      const bulkTip = await DRIP.batchUpdateBalance(data);
      bulkTipCache.set(interaction.user.id, data);
      const embed = new EmbedBuilder()
        .setTitle("✅ Bulk Tip Success")
        .setDescription(
          `Total Users: ${data.length}\nTip Spend: ${totalAmount}\n\n**Do you want to broadcast it?**`
        );
      const insertTransaction = db
        .prepare(
          "INSERT INTO transactions (user_id, count, amount) VALUES (?, ?, ?)"
        )
        .run(interaction.user.id, data.length, totalAmount);
      const components = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ybroadcast")
          .setLabel("✓")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("nbroadcast")
          .setLabel("𐄂")
          .setStyle(ButtonStyle.Danger)
      );

      return { embed, components };
    } catch (error) {
      logger.error(error);
      return { embed: this.errorEmbed("Bulk Tip Failed", error) };
    }
  }
  static async broadcast(interaction, channelId) {
    const data = bulkTipCache.get(interaction.user.id);
    if (!data) {
      return { embed: this.errorEmbed("Error", "No data found") };
    }
    const content = data
      .map(
        (entry) =>
          `<@${entry.userId}> - ${entry.amount} **${
            this.POINT_NAME
          }**\n_Note_: ${entry.note || ""}\n\n`
      )
      .join("\n");
    const embed = new EmbedBuilder()
      .setAuthor({
        name: `@${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTitle("Transaction: Tip")
      .setDescription(content);
    bulkTipCache.delete(interaction.user.id);
    return { embed };
  }

  static async history(interaction) {
    const userId = interaction.user.id;
    const history = db
      .prepare(
        "SELECT * FROM transactions WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10"
      )
      .all(userId);

    if (history.length === 0) {
      return { content: "You have no transaction history.", ephemeral: true };
    }

    const embed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle("📋 Transaction History")
      .setDescription(
        history.length > 0
          ? history
              .map(
                (entry) =>
                  `\`\`\`md\n# Transaction on ${entry.timestamp}\n> Amount: ${entry.amount} ${this.POINT_NAME}\n> Recipients: ${entry.count} users\`\`\``
              )
              .join("\n")
          : "No transaction history found."
      )
      .setFooter({ text: "FlowSend Bulk Tipping" })
      .setTimestamp();

    return { embeds: [embed] };
  }

  /**
   * Generates an error embed message.
   */
  static errorEmbed(title, error) {
    return new EmbedBuilder()
      .setTitle(`❌ ${title}`)
      .setDescription(`\`\`\`js\nError: ${error}\n\`\`\``);
  }
}

export default EmbedMessage;
