import { weekNumber } from "./button-copy.js";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

function resolveRedirectUrl(currentUrl, location) {
  return new URL(location, currentUrl).href;
}

function isGoogleusercontentUrl(url) {
  try {
    return new URL(url).hostname.endsWith("googleusercontent.com");
  } catch {
    return false;
  }
}

function sheetWebhookErrorPage(text) {
  const compact = String(text).replace(/\s+/g, " ").trim();
  if (/Script function not found:\s*doGet/i.test(compact)) {
    return "Apps Script handled a GET without doGet. Keep POSTing to /exec until Google redirects to googleusercontent, then GET that URL. Redeploy apps-script/Code.gs (it includes doGet) if this still happens.";
  }
  if (compact.startsWith("<!") || compact.startsWith("<html")) {
    return compact.slice(0, 180);
  }
  return null;
}

async function postToSheet(payload) {
  const webhookUrl = required("SHEETS_WEBHOOK_URL");
  const secret = required("SHEETS_WEBHOOK_SECRET");
  const body = JSON.stringify({ secret, ...payload });
  let url = webhookUrl;
  let method = "POST";
  let response;

  // /exec 302s first to another script.google.com URL (must stay POST), then to
  // googleusercontent, which only accepts GET and still runs doPost.
  for (let hop = 0; hop < 6; hop += 1) {
    response = await fetch(url, {
      method,
      headers: method === "POST" ? { "Content-Type": "text/plain;charset=utf-8" } : undefined,
      body: method === "POST" ? body : undefined,
      redirect: "manual",
    });
    if (response.status < 300 || response.status >= 400) {
      break;
    }
    const location = response.headers.get("location");
    if (!location) {
      throw new Error(`Sheet webhook redirected without a Location header (${response.status})`);
    }
    url = resolveRedirectUrl(url, location);
    method = isGoogleusercontentUrl(url) ? "GET" : "POST";
  }

  const text = await response.text();
  const htmlError = sheetWebhookErrorPage(text);
  if (!response.ok) {
    throw new Error(`Sheet webhook failed (${response.status}): ${htmlError || text}`);
  }
  if (htmlError) {
    throw new Error(`Sheet webhook returned non-JSON: ${htmlError}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Sheet webhook returned non-JSON: ${text.slice(0, 180)}`);
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

export async function listWeekSheet(week) {
  const parsed = await postToSheet({ action: "listWeek", week: Number(week) });
  if (!parsed.found) return null;
  const raw = Array.isArray(parsed.rows) ? parsed.rows : [];
  return parseWeekSheetRows(raw);
}

export function parseWeekSheetRows(raw) {
  let title = "";
  let headerIndex = -1;
  for (let i = 0; i < raw.length; i++) {
    const row = Array.isArray(raw[i]) ? raw[i] : [];
    const first = String(row[0] ?? "").trim();
    if (!title && first) title = first;
    if (/^username$/i.test(first)) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) {
    return { title, entries: [] };
  }

  const entries = [];
  for (let i = headerIndex + 1; i < raw.length; i++) {
    const row = Array.isArray(raw[i]) ? raw[i] : [];
    if (!row.some((cell) => String(cell ?? "").trim() !== "")) continue;
    entries.push({
      username: String(row[0] ?? "").trim(),
      pick1: String(row[1] ?? "").trim(),
      score1: String(row[2] ?? "").trim(),
      pick2: String(row[3] ?? "").trim(),
      score2: String(row[4] ?? "").trim(),
      weekTotal: String(row[5] ?? "").trim(),
      seasonTotal: String(row[6] ?? "").trim(),
    });
  }
  return { title, entries };
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
