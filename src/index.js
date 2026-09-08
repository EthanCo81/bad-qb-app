import "dotenv/config";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  DiscordAPIError,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
} from "discord.js";
import { buildButtonPayload, cappedPlayersForUser, currentWeekRange, dateKey, userPicksForWeek, weekNumber } from "./button-copy.js";
import { slashCommands } from "./commands.js";
import { maybeNudgeMissingPicks } from "./nudge.js";
import {
  SELECT_ID_PREFIX,
  eligibleQbs,
  parsePickControlId,
  pendingPicks,
  pickSelectPayload,
} from "./pick-select.js";
import { clearPostedMessage, loadPostedMessage, savePostedMessage } from "./posted-message.js";
import { canonicalQb, suggestQbs } from "./qbs.js";
import { listSheetRows, setWeekScores, upsertWeekPicks } from "./sheets.js";
import { buildScoreUpdates, currentSleeperSeason } from "./sleeper-scores.js";

const BUTTON_ID = "bad-qb-open-form";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Missing DISCORD_TOKEN");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

let lastRenderedDate = "";
let pickCommandId = "";
let sheetRows = [];

function formButtonRow(label) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_ID)
      .setLabel(label)
      .setStyle(ButtonStyle.Primary),
  );
}

function excludeForUser(interaction, extraNames = []) {
  const identity = {
    userId: interaction.user.id,
    username: interaction.user.username,
  };
  const exclude = cappedPlayersForUser(sheetRows, identity, { ignoreWeek: weekNumber() });
  for (const name of extraNames) {
    if (name) exclude.add(String(name).toLowerCase());
  }
  return exclude;
}

function pickMenuFor(interaction) {
  const existing = userPicksForWeek(sheetRows, {
    userId: interaction.user.id,
    username: interaction.user.username,
  });
  const pending = pendingPicks.get(interaction.user.id) || { qb1: "", qb2: "" };
  const names = eligibleQbs(excludeForUser(interaction));
  return pickSelectPayload({
    names,
    existing,
    qb1: pending.qb1,
    qb2: pending.qb2,
  });
}

async function completePick(interaction, name1, name2) {
  if (interaction.isRepliable() && (interaction.deferred || interaction.replied)) {
    await interaction.deferUpdate();
  } else {
    await interaction.deferReply({ ephemeral: true });
  }
  const saved = await savePick({
    username: interaction.user.username,
    userId: interaction.user.id,
    name1,
    name2,
  });
  pendingPicks.delete(interaction.user.id);
  try {
    await refreshPostedButton(interaction.client);
  } catch (error) {
    console.error("Saved the row but failed to refresh the button message", error);
  }
  const text = `Saved **${saved.name1}** and **${saved.name2}** to the sheet (logged as \`${interaction.user.username}\`).`;
  await interaction.editReply({ content: text, components: [] });
}

async function loadSheetRows() {
  sheetRows = await listSheetRows();
  return sheetRows;
}

function pickError(message) {
  const error = new Error(message);
  error.userFacing = true;
  return error;
}

async function buttonMessageOptions() {
  await loadSheetRows();
  const { title, description, label } = buildButtonPayload();
  lastRenderedDate = dateKey();
  const pickMention = pickCommandId ? `</pick:${pickCommandId}>` : "**/pick**";
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle(title)
        .setDescription(description.replace("**/pick**", pickMention))
        .setColor(0x5865f2),
    ],
    components: [formButtonRow(label)],
  };
}

async function refreshPostedButton(discordClient) {
  const posted = await loadPostedMessage();
  if (!posted?.channelId || !posted?.messageId) {
    return;
  }
  try {
    const channel = await discordClient.channels.fetch(posted.channelId);
    if (!channel?.isTextBased()) {
      return;
    }
    const message = await channel.messages.fetch(posted.messageId);
    await message.edit(await buttonMessageOptions());
  } catch (error) {
    const lost =
      error instanceof DiscordAPIError && [50001, 50013, 10003, 10008].includes(error.code);
    if (lost) {
      console.warn(
        "Lost access to the posted weekly message. Run /post-button in #bad-qb after giving the bot View Channel, Read Message History, and Send Messages.",
      );
      await clearPostedMessage();
      return;
    }
    throw error;
  }
}

async function savePick({ username, userId, name1, name2 }) {
  const resolved1 = canonicalQb(name1);
  const resolved2 = canonicalQb(name2);
  if (!resolved1 || !resolved2) {
    const unknown = !resolved1 ? name1 : name2;
    const hints = suggestQbs(unknown)
      .map((choice) => choice.name)
      .filter((name) => name.toLowerCase() !== unknown.toLowerCase())
      .slice(0, 5);
    throw pickError(
      hints.length
        ? `"${unknown}" is not on the QB list. Close matches: ${hints.join(", ")}.`
        : "Pick a QB from the list for both fields.",
    );
  }
  if (resolved1.toLowerCase() === resolved2.toLowerCase()) {
    throw pickError("Pick two different QBs.");
  }
  const identity = { userId, username };
  const capped = cappedPlayersForUser(sheetRows, identity, { ignoreWeek: weekNumber() });
  for (const name of [resolved1, resolved2]) {
    if (capped.has(name.toLowerCase())) {
      throw pickError(
        `You've already picked ${name} in 2 different weeks, so they can't be picked again.`,
      );
    }
  }
  const { start, end, week } = currentWeekRange();
  await upsertWeekPicks({
    username,
    userId,
    name1: resolved1,
    name2: resolved2,
    week,
    weekStart: start,
    weekEnd: end,
  });
  await loadSheetRows();
  return { name1: resolved1, name2: resolved2 };
}

async function registerCommands() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    console.warn("DISCORD_CLIENT_ID missing; skip command registration. Run npm run register after setting it.");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(token);
  const guildId = process.env.DISCORD_GUILD_ID;
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);
  const registered = await rest.put(route, { body: slashCommands() });
  const pick = registered.find((command) => command.name === "pick");
  if (pick?.id) {
    pickCommandId = pick.id;
  }
  console.log(`Registered slash commands ${guildId ? `for guild ${guildId}` : "globally"}`);
}

async function scoreFinishedWeeks() {
  const completed = weekNumber() - 1;
  if (completed < 1) return;
  await loadSheetRows();
  const weeks = [
    ...new Set(
      sheetRows
        .filter(
          (row) =>
            Number(row.week) >= 1 &&
            Number(row.week) <= completed &&
            (row.score1 === "" || row.score2 === ""),
        )
        .map((row) => Number(row.week)),
    ),
  ].sort((a, b) => a - b);
  if (weeks.length === 0) return;

  const season = await currentSleeperSeason();
  let wrote = false;
  for (const week of weeks) {
    const updates = await buildScoreUpdates(sheetRows, week, season);
    if (updates == null) {
      console.log(`Sleeper stats for week ${week} are not ready yet`);
      continue;
    }
    if (updates.length) {
      await setWeekScores(updates);
      wrote = true;
      console.log(`Wrote Sleeper scores for ${updates.length} row(s) in week ${week}`);
    }
  }
  if (wrote) await loadSheetRows();
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  try {
    await registerCommands();
  } catch (error) {
    console.error("Failed to register slash commands", error);
  }
  try {
    await loadSheetRows();
  } catch (error) {
    console.error("Failed to load picks from the sheet", error);
  }
  try {
    await refreshPostedButton(readyClient);
  } catch (error) {
    console.error("Failed to refresh posted button", error);
  }
  try {
    await scoreFinishedWeeks();
  } catch (error) {
    console.error("Failed to fill Sleeper scores", error);
  }
  try {
    await loadSheetRows();
    await maybeNudgeMissingPicks(readyClient, sheetRows);
  } catch (error) {
    console.error("Failed to send daily missing-pick nudge", error);
  }

  setInterval(() => {
    if (dateKey() !== lastRenderedDate) {
      refreshPostedButton(readyClient).catch((error) => {
        console.error("Failed to refresh button for a new date", error);
      });
    }
    scoreFinishedWeeks().catch((error) => {
      console.error("Failed to fill Sleeper scores", error);
    });
    loadSheetRows()
      .then(() => maybeNudgeMissingPicks(readyClient, sheetRows))
      .catch((error) => {
        console.error("Failed to send daily missing-pick nudge", error);
      });
  }, 60_000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isAutocomplete() && interaction.commandName === "pick") {
      const focused = interaction.options.getFocused(true);
      const otherName =
        focused.name === "qb1"
          ? interaction.options.getString("qb2")
          : interaction.options.getString("qb1");
      const identity = {
        userId: interaction.user.id,
        username: interaction.user.username,
      };
      const exclude = cappedPlayersForUser(sheetRows, identity, { ignoreWeek: weekNumber() });
      if (otherName) exclude.add(otherName.toLowerCase());
      await interaction.respond(suggestQbs(focused.value, exclude));
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "post-button") {
      await interaction.deferReply();
      const options = await buttonMessageOptions();
      const message = await interaction.editReply(options);
      await savePostedMessage({ channelId: message.channelId, messageId: message.id });
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "pick") {
      await completePick(
        interaction,
        interaction.options.getString("qb1", true).trim(),
        interaction.options.getString("qb2", true).trim(),
      );
      return;
    }

    if (interaction.isButton() && interaction.customId === BUTTON_ID) {
      pendingPicks.set(interaction.user.id, { qb1: "", qb2: "" });
      await interaction.reply(pickMenuFor(interaction));
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith(`${SELECT_ID_PREFIX}:`)) {
      const parsed = parsePickControlId(interaction.customId);
      if (!parsed) return;
      const chosen = interaction.values[0];
      const pending = pendingPicks.get(interaction.user.id) || { qb1: "", qb2: "" };
      if (parsed.slot === 1) pending.qb1 = chosen;
      if (parsed.slot === 2) pending.qb2 = chosen;
      pendingPicks.set(interaction.user.id, pending);
      if (pending.qb1 && pending.qb2) {
        await completePick(interaction, pending.qb1, pending.qb2);
        return;
      }
      await interaction.update(pickMenuFor(interaction));
    }
  } catch (error) {
    console.error(error);
    if (error instanceof DiscordAPIError && error.code === 10062) {
      return;
    }
    if (interaction.isAutocomplete()) {
      await interaction.respond([]).catch(() => {});
      return;
    }
    const message =
      error?.userFacing && error instanceof Error
        ? error.message
        : "Could not save those names. Check the bot logs and Apps Script webhook.";
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
    } else if (interaction.isRepliable()) {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
    }
  }
});

await client.login(token);
