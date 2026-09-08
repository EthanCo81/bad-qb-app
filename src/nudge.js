import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PermissionFlagsBits } from "discord.js";
import { dateKey, localHour, rowsForWeek, weekNumber } from "./button-copy.js";

const statePath = path.join(process.cwd(), "data", "nudge-date.json");
const NUDGE_HOUR = Number(process.env.DISCORD_NUDGE_HOUR || 11);
const CHANNEL_NAME = (process.env.DISCORD_NUDGE_CHANNEL || "bad-qb").replace(/^#/, "");

async function loadNudgeDate() {
  try {
    const parsed = JSON.parse(await readFile(statePath, "utf8"));
    return parsed.date || "";
  } catch {
    return "";
  }
}

async function saveNudgeDate(date) {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify({ date }, null, 2));
}

function submittedThisWeek(rows) {
  const ids = new Set();
  const names = new Set();
  for (const row of rowsForWeek(rows)) {
    if (row.userId) ids.add(String(row.userId));
    if (row.username) names.add(row.username.toLowerCase());
  }
  return { ids, names };
}

async function findNudgeChannel(client) {
  const guildId = process.env.DISCORD_GUILD_ID;
  const guilds = guildId ? [await client.guilds.fetch(guildId)] : [...client.guilds.cache.values()];
  for (const guild of guilds) {
    await guild.channels.fetch();
    const channel = guild.channels.cache.find(
      (entry) => entry.name === CHANNEL_NAME && entry.isTextBased(),
    );
    if (channel) return channel;
  }
  return null;
}

function chunkUserIds(ids) {
  const chunks = [];
  let current = [];
  let length = 0;
  for (const id of ids) {
    const mention = `<@${id}> `;
    if (current.length && length + mention.length > 1600) {
      chunks.push(current);
      current = [];
      length = 0;
    }
    current.push(id);
    length += mention.length;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

export async function maybeNudgeMissingPicks(client, sheetRows) {
  const today = dateKey();
  if (localHour() !== NUDGE_HOUR) return;
  if ((await loadNudgeDate()) === today) return;

  const channel = await findNudgeChannel(client);
  if (!channel) {
    console.warn(`Could not find #${CHANNEL_NAME} for the daily nudge`);
    return;
  }

  const guild = channel.guild;
  await guild.members.fetch();
  const { ids, names } = submittedThisWeek(sheetRows);
  const missing = [...guild.members.cache.values()].filter((member) => {
    if (member.user.bot) return false;
    const canSee = channel.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel);
    if (!canSee) return false;
    if (ids.has(member.id)) return false;
    if (names.has(member.user.username.toLowerCase())) return false;
    return true;
  });

  if (missing.length === 0) {
    await saveNudgeDate(today);
    console.log("Daily nudge: everyone in #bad-qb has submitted this week");
    return;
  }

  const week = weekNumber();
  const pickHint = "Submit with **/pick**.";
  const chunks = chunkUserIds(missing.map((member) => member.id));
  for (let i = 0; i < chunks.length; i++) {
    const mentions = chunks[i].map((id) => `<@${id}>`).join(" ");
    const header =
      i === 0
        ? `Week ${week} picks are missing from:\n${mentions}\n${pickHint}`
        : mentions;
    await channel.send({
      content: header,
      allowedMentions: { users: chunks[i] },
    });
  }
  await saveNudgeDate(today);
  console.log(`Daily nudge tagged ${missing.length} member(s) in #${CHANNEL_NAME}`);
}
