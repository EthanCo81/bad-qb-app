import { weekNumber } from "./button-copy.js";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

async function postToSheet(payload) {
  const webhookUrl = required("SHEETS_WEBHOOK_URL");
  const secret = required("SHEETS_WEBHOOK_SECRET");
  const body = JSON.stringify({ secret, ...payload });
  let response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body,
    redirect: "manual",
  });

  // Apps Script /exec 302s to googleusercontent; that URL only accepts GET
  // (Google still runs doPost with the original body).
  for (let hop = 0; hop < 5 && response.status >= 300 && response.status < 400; hop += 1) {
    const location = response.headers.get("location");
    if (!location) {
      throw new Error(`Sheet webhook redirected without a Location header (${response.status})`);
    }
    response = await fetch(location, { method: "GET", redirect: "manual" });
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Sheet webhook failed (${response.status}): ${text}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Sheet webhook returned non-JSON: ${text}`);
  }

  if (!parsed.ok) {
    throw new Error(parsed.error || "Sheet webhook rejected the request");
  }

  return parsed;
}

export async function upsertWeekPicks({
  username,
  userId,
  name1,
  name2,
  week,
  weekStart,
  weekEnd,
}) {
  await postToSheet({
    action: "upsert",
    timestamp: new Date().toISOString(),
    username,
    userId: String(userId),
    name1,
    name2,
    week,
    weekStart,
    weekEnd,
    timezone: process.env.DISPLAY_TIMEZONE || "America/Chicago",
  });
}

export async function setWeekScores(updates) {
  if (!updates.length) return;
  await postToSheet({
    action: "setScores",
    updates,
  });
}

export async function listSheetRows() {
  const parsed = await postToSheet({ action: "list" });
  const raw = Array.isArray(parsed.rows) ? parsed.rows : [];
  return raw
    .filter((row) => Array.isArray(row) && row.some((cell) => String(cell).trim() !== ""))
    .filter((row) => String(row[0]).toLowerCase() !== "timestamp")
    .map((row) => {
      const timestamp = String(row[0] ?? "").trim();
      const weekCell = row[5];
      const parsedWeek =
        weekCell === "" || weekCell == null ? "" : Number(weekCell);
      const fromTimestamp = timestamp ? weekNumber(new Date(timestamp)) : "";
      return {
        timestamp,
        username: String(row[1] ?? "").trim(),
        userId: String(row[2] ?? "").trim(),
        name1: String(row[3] ?? "").trim(),
        name2: String(row[4] ?? "").trim(),
        week: parsedWeek === "" || Number.isNaN(parsedWeek) ? fromTimestamp : parsedWeek,
        score1: row[6] === "" || row[6] == null ? "" : Number(row[6]),
        score2: row[7] === "" || row[7] == null ? "" : Number(row[7]),
      };
    });
}
