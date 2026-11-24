import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { userPicksForWeek, weekNumber } from "./button-copy.js";

const statePath = path.join(process.cwd(), "data", "starter-reminders.json");

/** Discord usernames (no @) that get starter-verify DM reminders after picking. */
export const STARTER_REMINDER_USERNAMES = ["sdennison", "jimjamit"];

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const STOP_FOOTER = "Reply STOP to end messages for the week";

function emptyState() {
  return { users: {} };
}

async function loadState() {
  try {
    const parsed = JSON.parse(await readFile(statePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || typeof parsed.users !== "object") {
      return emptyState();
    }
    return { users: parsed.users };
  } catch {
    return emptyState();
  }
}

async function saveState(state) {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2));
}

export function isStarterReminderUsername(username) {
  const key = String(username || "").toLowerCase();
  return STARTER_REMINDER_USERNAMES.includes(key);
}

export function normalizeReplyText(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201A\u201B`]/g, "'")
    .trim();
}

/** Exact STOP (case-insensitive) ends reminders for the current week. */
export function isWeekStopReply(text) {
  return normalizeReplyText(text).toLowerCase() === "stop";
}

/** "Ethan I'm sorry" (case-insensitive) ends all starter reminders permanently. */
export function isPermanentStopReply(text) {
  const normalized = normalizeReplyText(text)
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/\s+/g, " ");
  return normalized === "ethan im sorry";
}

export function formatStarterReminderMessage(name1, name2) {
  return [
    `You picked **${name1}** and **${name2}**. Please verify those players are starting.`,
    "",
    STOP_FOOTER,
  ].join("\n");
}

function userKey(username) {
  return String(username || "").toLowerCase();
}

function getEntry(state, username) {
  return state.users[userKey(username)] || null;
}

function setEntry(state, username, entry) {
  state.users[userKey(username)] = entry;
}

/**
 * After a target user submits /pick, schedule (or refresh) the 4-hour reminder loop.
 * Skips if they permanently opted out, or already replied STOP for this week.
 */
export async function scheduleAfterPick({ username, userId, name1, name2, week, now = Date.now() }) {
  if (!isStarterReminderUsername(username)) return null;

  const state = await loadState();
  const existing = getEntry(state, username) || {};
  if (existing.permanentlyStopped) {
    console.log(`Starter reminder: ${username} permanently opted out; not scheduling`);
    return existing;
  }

  const weekNum = Number(week);
  if (existing.stoppedWeek === weekNum) {
    // Keep pick names current but do not resume reminders until next week.
    const kept = {
      ...existing,
      username: String(username),
      userId: userId != null ? String(userId) : existing.userId || "",
      week: weekNum,
      name1,
      name2,
      nextAt: null,
    };
    setEntry(state, username, kept);
    await saveState(state);
    console.log(`Starter reminder: ${username} stopped for week ${weekNum}; picks updated only`);
    return kept;
  }

  const entry = {
    username: String(username),
    userId: userId != null ? String(userId) : existing.userId || "",
    week: weekNum,
    name1,
    name2,
    nextAt: now + FOUR_HOURS_MS,
    stoppedWeek: null,
    permanentlyStopped: false,
  };
  setEntry(state, username, entry);
  await saveState(state);
  console.log(
    `Starter reminder: scheduled for ${username} in 4h (week ${week}: ${name1}, ${name2})`,
  );
  return entry;
}

/**
 * Handle a DM reply from a target user. Returns what happened for logging/tests.
 */
export async function handleStarterReminderReply({
  username,
  userId,
  content,
  now = Date.now(),
}) {
  if (!isStarterReminderUsername(username)) return { action: "ignored" };

  const state = await loadState();
  const existing = getEntry(state, username) || {
    username: String(username),
    userId: userId != null ? String(userId) : "",
    week: weekNumber(),
    name1: "",
    name2: "",
    nextAt: null,
    stoppedWeek: null,
    permanentlyStopped: false,
  };

  if (userId != null) existing.userId = String(userId);

  if (isPermanentStopReply(content)) {
    existing.permanentlyStopped = true;
    existing.nextAt = null;
    existing.stoppedWeek = null;
    setEntry(state, username, existing);
    await saveState(state);
    return { action: "permanent_stop", entry: existing };
  }

  if (existing.permanentlyStopped) {
    return { action: "already_permanent_stop", entry: existing };
  }

  const currentWeek = weekNumber();
  if (isWeekStopReply(content)) {
    existing.stoppedWeek = existing.week || currentWeek;
    existing.nextAt = null;
    setEntry(state, username, existing);
    await saveState(state);
    return { action: "week_stop", entry: existing };
  }

  if (existing.stoppedWeek != null && existing.stoppedWeek === (existing.week || currentWeek)) {
    return { action: "already_week_stop", entry: existing };
  }

  // Any other reply: next reminder in 1 hour from the reply.
  if (!existing.name1 && !existing.name2) {
    return { action: "no_picks", entry: existing };
  }

  existing.nextAt = now + ONE_HOUR_MS;
  setEntry(state, username, existing);
  await saveState(state);
  return { action: "reschedule_1h", entry: existing };
}

async function sendReminderDm(client, entry) {
  const content = formatStarterReminderMessage(entry.name1, entry.name2);
  let user = null;
  if (entry.userId) {
    try {
      user = await client.users.fetch(entry.userId);
    } catch (error) {
      console.warn(
        `Starter reminder: could not fetch user id ${entry.userId}`,
        error?.message || error,
      );
    }
  }
  if (!user && entry.username) {
    // Fall back: search guild members by username if we have a guild configured.
    const guildId = process.env.DISCORD_GUILD_ID;
    if (guildId) {
      try {
        const guild = await client.guilds.fetch(guildId);
        await guild.members.fetch();
        const member = guild.members.cache.find(
          (m) => m.user.username.toLowerCase() === entry.username.toLowerCase(),
        );
        if (member) user = member.user;
      } catch (error) {
        console.warn(
          `Starter reminder: guild lookup failed for ${entry.username}`,
          error?.message || error,
        );
      }
    }
  }
  if (!user) {
    throw new Error(`Could not resolve Discord user for ${entry.username}`);
  }
  await user.send(content);
  return user.id;
}

/**
 * Send any due starter reminders and schedule the next one 4 hours out.
 * Also syncs pick names from the sheet when available.
 */
export async function maybeSendStarterReminders(client, sheetRows, now = Date.now()) {
  const state = await loadState();
  const week = weekNumber();
  let changed = false;

  for (const username of STARTER_REMINDER_USERNAMES) {
    const entry = getEntry(state, username);
    if (!entry || entry.permanentlyStopped) continue;
    if (entry.stoppedWeek === week) continue;
    if (entry.nextAt == null || entry.nextAt > now) continue;

    // Refresh picks from the sheet for the current week when possible.
    const picks = userPicksForWeek(sheetRows || [], {
      userId: entry.userId,
      username: entry.username || username,
    });
    if (picks) {
      entry.name1 = picks.name1;
      entry.name2 = picks.name2;
      entry.week = week;
    }

    if (!entry.name1 || !entry.name2) {
      entry.nextAt = null;
      setEntry(state, username, entry);
      changed = true;
      console.log(`Starter reminder: ${username} has no picks; clearing schedule`);
      continue;
    }

    try {
      const resolvedId = await sendReminderDm(client, entry);
      if (resolvedId) entry.userId = String(resolvedId);
      entry.nextAt = now + FOUR_HOURS_MS;
      setEntry(state, username, entry);
      changed = true;
      console.log(`Starter reminder: DM'd ${username} (${entry.name1}, ${entry.name2})`);
    } catch (error) {
      // Retry in a minute via the existing poll loop.
      console.warn(
        `Starter reminder: failed to DM ${username}`,
        error?.message || error,
      );
    }
  }

  if (changed) await saveState(state);
}

/** Test helper: load current persisted state. */
export async function loadStarterReminderState() {
  return loadState();
}
