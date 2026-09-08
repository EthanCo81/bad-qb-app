const timezone = process.env.DISPLAY_TIMEZONE || "America/Chicago";
const WEEK1_START = "2026-09-08"; // Tuesday; week 1 is 9/8 through 9/14, week 2 starts 9/15

export function localHour(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value ?? "0");
}

export function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function utcDays(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function addDays(isoDate, days) {
  return new Date((utcDays(isoDate) + days) * 86_400_000).toISOString().slice(0, 10);
}

export function weekNumber(date = new Date()) {
  const days = utcDays(dateKey(date)) - utcDays(WEEK1_START);
  return Math.max(1, Math.floor(days / 7) + 1);
}

function weekStartKey(week) {
  return addDays(WEEK1_START, (week - 1) * 7);
}

function formatShortIso(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(Date.UTC(year, month - 1, day));
}

function rowDateKey(row) {
  const parsed = new Date(row.timestamp);
  if (!Number.isNaN(parsed.getTime())) {
    return dateKey(parsed);
  }
  return "";
}

export function currentWeekRange(date = new Date()) {
  const week = weekNumber(date);
  const start = weekStartKey(week);
  const end = addDays(start, 6);
  return { week, start, end };
}

function isSameUser(row, { userId, username }) {
  if (userId && String(row.userId) === String(userId)) return true;
  if (username && row.username && row.username.toLowerCase() === username.toLowerCase()) {
    return true;
  }
  return false;
}

export function rowsForWeek(rows, date = new Date()) {
  const { start, end } = currentWeekRange(date);
  return rows.filter((row) => {
    const key = rowDateKey(row);
    return key >= start && key <= end;
  });
}

export function userPicksForWeek(rows, identity, date = new Date()) {
  const mine = rowsForWeek(rows, date).filter((row) => isSameUser(row, identity));
  if (mine.length === 0) return null;
  const row = mine[mine.length - 1];
  if (!row.name1 && !row.name2) return null;
  return { name1: row.name1, name2: row.name2 };
}

export function cappedPlayersForUser(rows, identity, { ignoreWeek } = {}) {
  const weeksByPlayer = new Map();
  for (const row of rows) {
    if (!isSameUser(row, identity)) continue;
    const parsed = new Date(row.timestamp);
    if (Number.isNaN(parsed.getTime())) continue;
    const week = weekNumber(parsed);
    if (ignoreWeek != null && week === ignoreWeek) continue;
    for (const name of [row.name1, row.name2]) {
      if (!name) continue;
      const key = name.toLowerCase();
      if (!weeksByPlayer.has(key)) weeksByPlayer.set(key, new Set());
      weeksByPlayer.get(key).add(week);
    }
  }

  const capped = new Set();
  for (const [name, weeks] of weeksByPlayer) {
    if (weeks.size >= 2) capped.add(name);
  }
  return capped;
}

export function buildButtonPayload() {
  const week = weekNumber();
  const start = weekStartKey(week);
  const end = addDays(start, 6);
  const title = `Bad QB picks for week ${week}`;
  const description = [
    `${formatShortIso(start)} – ${formatShortIso(end)} (weeks start Tuesday)`,
    "",
    "Click the button to choose two QBs from the list, or search with **/pick**. Picks are not shown in this channel.",
  ].join("\n");

  return { title, description, label: title.slice(0, 80) };
}
