import "dotenv/config";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { appendNames } from "./sheets.js";

const BUTTON_ID = "bad-qb-open-form";
const MODAL_ID = "bad-qb-names-modal";
const NAME_ONE_ID = "name1";
const NAME_TWO_ID = "name2";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Missing DISCORD_TOKEN");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

function formButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_ID)
      .setLabel("Log two names")
      .setStyle(ButtonStyle.Primary),
  );
}

function namesModal() {
  return new ModalBuilder()
    .setCustomId(MODAL_ID)
    .setTitle("Log two names")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(NAME_ONE_ID)
          .setLabel("First name")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(NAME_TWO_ID)
          .setLabel("Second name")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ),
    );
}

async function registerCommands() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    console.warn("DISCORD_CLIENT_ID missing; skip command registration. Run npm run register after setting it.");
    return;
  }

  const commands = [
    new SlashCommandBuilder()
      .setName("post-button")
      .setDescription("Post the two-name intake button in this channel")
      .toJSON(),
  ];
  const rest = new REST({ version: "10" }).setToken(token);
  const guildId = process.env.DISCORD_GUILD_ID;
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);
  await rest.put(route, { body: commands });
  console.log(`Registered /post-button ${guildId ? `for guild ${guildId}` : "globally"}`);
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  try {
    await registerCommands();
  } catch (error) {
    console.error("Failed to register slash commands", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "post-button") {
      await interaction.reply({
        content: "Click the button, enter two names, and they will be added to the sheet along with your Discord username.",
        components: [formButtonRow()],
      });
      return;
    }

    if (interaction.isButton() && interaction.customId === BUTTON_ID) {
      await interaction.showModal(namesModal());
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === MODAL_ID) {
      const name1 = interaction.fields.getTextInputValue(NAME_ONE_ID).trim();
      const name2 = interaction.fields.getTextInputValue(NAME_TWO_ID).trim();
      const username = interaction.user.username;
      const userId = interaction.user.id;

      await interaction.deferReply({ ephemeral: true });
      await appendNames({ username, userId, name1, name2 });
      await interaction.editReply(
        `Saved **${name1}** and **${name2}** to the sheet (logged as \`${username}\`).`,
      );
    }
  } catch (error) {
    console.error(error);
    const message = "Could not save those names. Check the bot logs and sheet sharing.";
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
    } else if (interaction.isRepliable()) {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
    }
  }
});

await client.login(token);
