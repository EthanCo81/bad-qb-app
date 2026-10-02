import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PermissionFlagsBits } from "discord.js";
import { dateKey, localHour, localWeekday, rowsForWeek, weekNumber } from "./button-copy.js";
import { listWeekSheet } from "./sheets.js";

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

function isTuesday(date = new Date()) {
  return localWeekday(date) === "Tue";
}

function parseScore(value) {
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function mentionFor(username, idsByName) {
  const id = idsByName.get(String(username).toLowerCase());
  return id ? `<@${id}>` : `@${username}`;
}

function userIdsByUsername(sheetRows, guild) {
  const map = new Map();
  for (const row of sheetRows || []) {
    if (row.username && row.userId) {
      map.set(String(row.username).toLowerCase(), String(row.userId));
    }
  }
  if (guild) {
    for (const member of guild.members.cache.values()) {
      map.set(member.user.username.toLowerCase(), member.id);
    }
  }
  return map;
}

function mentionIdsIn(text) {
  return [...new Set([...text.matchAll(/<@(\d+)>/g)].map((match) => match[1]))];
}

function splitMessage(text, max = 1900) {
  const lines = text.split("\n");
  const chunks = [];
  let current = "";
  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > max && current) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function formatWeekSummary(week, parsed, idsByName = new Map()) {
  const entries = parsed.entries.map((entry) => ({
    ...entry,
    weekTotalNum: parseScore(entry.weekTotal),
    seasonTotalNum: parseScore(entry.seasonTotal),
    score1Num: parseScore(entry.score1),
    score2Num: parseScore(entry.score2),
  }));

  const scored = entries.filter((entry) => entry.weekTotalNum != null);
  const lowestWeek = scored.length ? Math.min(...scored.map((entry) => entry.weekTotalNum)) : null;
  const bestScorer = scored
    .filter((entry) => entry.weekTotalNum === lowestWeek)
    .sort((a, b) => String(a.username).localeCompare(String(b.username)))[0];

  const picks = [];
  for (const entry of entries) {
    picks.push({ player: entry.pick1, score: entry.score1Num, display: entry.score1 });
    picks.push({ player: entry.pick2, score: entry.score2Num, display: entry.score2 });
  }
  const scoredPicks = picks.filter((pick) => pick.player && pick.score != null);
  const lowestPick = scoredPicks.length ? Math.min(...scoredPicks.map((pick) => pick.score)) : null;
  const bestPick = scoredPicks
    .filter((pick) => pick.score === lowestPick)
    .sort((a, b) => String(a.player).localeCompare(String(b.player)))[0];

  const weekLines = [...entries]
    .sort((a, b) => {
      if (a.weekTotalNum != null && b.weekTotalNum != null && a.weekTotalNum !== b.weekTotalNum) {
        return a.weekTotalNum - b.weekTotalNum;
      }
      return String(a.username).localeCompare(String(b.username));
    })
    .map(
      (entry) =>
        `${mentionFor(entry.username, idsByName)}: ${entry.pick1}, ${entry.pick2} - ${entry.weekTotal}`,
    );

  const seasonLines = [...entries]
    .sort((a, b) => {
      if (a.seasonTotalNum != null && b.seasonTotalNum != null && a.seasonTotalNum !== b.seasonTotalNum) {
        return a.seasonTotalNum - b.seasonTotalNum;
      }
      return String(a.username).localeCompare(String(b.username));
    })
    .map((entry) => `${entry.username}: ${entry.seasonTotal}`);

  return [
    `Week ${week} Summary:`,
    `Best Scorer - ${bestScorer ? bestScorer.username : "—"}`,
    `Best Pick - ${bestPick ? `${bestPick.player}: ${bestPick.display}` : "—"}`,
    "",
    ...weekLines,
    "",
    "Season Totals:",
    ...seasonLines,
  ].join("\n");
}

export async function weekSummaryPayloads(week, sheetRows, guild) {
  const parsed = await listWeekSheet(week);
  if (!parsed) {
    const error = new Error(`No "Week ${week}" tab in the spreadsheet yet.`);
    error.userFacing = true;
    throw error;
  }
  if (guild) await guild.members.fetch();
  const idsByName = userIdsByUsername(sheetRows, guild);
  return splitMessage(formatWeekSummary(week, parsed, idsByName)).map((chunk) => ({
    content: chunk,
    allowedMentions: { users: mentionIdsIn(chunk) },
  }));
}

async function maybeSendWeekSummary(client, sheetRows) {
  const today = dateKey();
  const week = weekNumber() - 1;
  if (week < 1) {
    await saveNudgeDate(today);
    console.log("Tuesday recap: no previous week yet");
    return true;
  }

  const channel = await findNudgeChannel(client);
  if (!channel) {
    console.warn(`Could not find #${CHANNEL_NAME} for the weekly recap`);
    return false;
  }

  let payloads;
  try {
    payloads = await weekSummaryPayloads(week, sheetRows, channel.guild);
  } catch (error) {
    if (error?.userFacing) {
      console.log(`Tuesday recap: ${error.message}`);
      return false;
    }
    throw error;
  }

  for (const payload of payloads) {
    await channel.send(payload);
  }
  await saveNudgeDate(today);
  console.log(`Posted Week ${week} recap in #${CHANNEL_NAME}`);
  return true;
}

async function sendMissingPickNudge(client, sheetRows) {
  const today = dateKey();
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
  const content = `Week ${week} picks are missing. Submit with **/pick**.`;
  let sent = 0;
  for (const member of missing) {
    try {
      await member.send(content);
      sent += 1;
    } catch (error) {
      console.warn(
        `Daily nudge: could not DM ${member.user.tag} (${member.id})`,
        error?.message || error,
      );
    }
  }
  await saveNudgeDate(today);
  console.log(
    `Daily nudge DM'd ${sent}/${missing.length} member(s) missing picks for #${CHANNEL_NAME}`,
  );
}

export async function maybeNudgeMissingPicks(client, sheetRows) {
  const today = dateKey();
  if ((await loadNudgeDate()) === today) return;

  if (isTuesday()) {
    if (localHour() < NUDGE_HOUR) return;
    await maybeSendWeekSummary(client, sheetRows);
    return;
  }

  if (localHour() !== NUDGE_HOUR) return;
  await sendMissingPickNudge(client, sheetRows);
}
