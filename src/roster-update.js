import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dateKey, localHour, localWeekday } from "./button-copy.js";
import { DEFAULT_QBS, QBS, normalizeQbKey, replaceQbs } from "./qbs.js";

const ROSTER_HOUR = Number(process.env.ROSTER_UPDATE_HOUR || 1);
const OURLADS_BASE = "https://www.ourlads.com/nfldepthcharts/depthchart";
const USER_AGENT = "bad-qb-app/1.0 (+https://github.com/EthanCo81/bad-qb-app; weekly roster update)";

const TEAMS = [
  "ARZ",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAX",
  "KC",
  "LAC",
  "LAR",
  "LV",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WAS",
];

/** Ourlads URL slug when it differs from the team code we store. */
const URL_SLUG = { LAR: "RAM" };

const OFFENSE_TBODY = "ctl00_phContent_dcTBody";
const PRACTICE_SQUAD_TBODY = "ctl00_phContent_dcTBody4";

const dataDir = path.join(process.cwd(), "data");
const qbsPath = path.join(dataDir, "qbs.json");
const statePath = path.join(dataDir, "roster-update-date.json");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeEntities(text) {
  return String(text)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function fixNameToken(token) {
  if (/^(II|III|IV|V)$/i.test(token)) return token.toUpperCase();
  if (/^(Jr|Sr)\.?$/i.test(token)) {
    return `${token.replace(/\./g, "")[0].toUpperCase()}${token.replace(/\./g, "").slice(1).toLowerCase()}.`;
  }
  if (/^[A-Za-z]{2,3}$/.test(token) && token === token.toUpperCase()) {
    return token;
  }
  if (/^[A-Za-z](?:\.[A-Za-z])+\.?$/.test(token)) {
    return token
      .toUpperCase()
      .replace(/\.+$/, "")
      .split(".")
      .filter(Boolean)
      .map((part) => `${part}.`)
      .join("");
  }

  return token
    .split("-")
    .map((piece) =>
      piece
        .split("'")
        .map((segment) => {
          if (!segment) return segment;
          if (/^Mc[a-z]/i.test(segment)) {
            return `Mc${segment.charAt(2).toUpperCase()}${segment.slice(3).toLowerCase()}`;
          }
          if (/^Mac[a-z]/i.test(segment) && segment.length > 4) {
            return `Mac${segment.charAt(3).toUpperCase()}${segment.slice(4).toLowerCase()}`;
          }
          return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
        })
        .join("'"),
    )
    .join("-");
}

/** Convert Ourlads "LAST, FIRST" into display "First Last". */
export function formatOurladsName(raw) {
  const cleaned = decodeEntities(raw).replace(/\s+/g, " ").trim();
  if (!cleaned || !cleaned.includes(",")) return null;
  const [lastRaw, ...rest] = cleaned.split(",");
  let last = lastRaw.trim();
  let first = rest.join(",").trim();
  if (!first || !last) return null;

  // Ourlads puts Jr/Sr/II after the given name: "PENIX, MICHAEL JR."
  const suffixMatch = first.match(/\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i);
  if (suffixMatch) {
    first = first.slice(0, -suffixMatch[0].length).trim();
    last = `${last} ${suffixMatch[1]}`;
  }

  const fix = (part) =>
    part
      .split(/\s+/)
      .filter(Boolean)
      .map(fixNameToken)
      .join(" ");
  return `${fix(first)} ${fix(last)}`;
}

function parseQbsFromTeamPage(html, team) {
  const qbs = [];
  const wanted = new Set([OFFENSE_TBODY, PRACTICE_SQUAD_TBODY]);

  for (const match of html.matchAll(/<tbody[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/tbody>/gi)) {
    if (!wanted.has(match[1])) continue;
    const body = match[2];
    for (const row of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const rowHtml = row[1];
      if (!/<td[^>]*>\s*QB\s*<\/td>/i.test(rowHtml)) continue;

      for (const cell of rowHtml.matchAll(/<a href='[^']*\/player\/(\d+)\/'[^>]*>([^<]*)<\/a>/gi)) {
        if (cell[1] === "0") continue;
        const after = rowHtml.slice(cell.index + cell[0].length, cell.index + cell[0].length + 120);
        if (/bad-ps[^>]*>\s*(IR|IA|PUP|NFI|SUS)/i.test(after)) continue;
        const name = formatOurladsName(cell[2]);
        if (!name) continue;
        qbs.push({ name, team });
      }
    }
  }

  return qbs;
}

export async function fetchOurladsQbs({ delayMs = 150 } = {}) {
  const fetched = [];
  for (const team of TEAMS) {
    const slug = URL_SLUG[team] || team;
    const response = await fetch(`${OURLADS_BASE}/${slug}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    });
    if (!response.ok) {
      throw new Error(`Ourlads ${team} failed (${response.status})`);
    }
    const html = await response.text();
    fetched.push(...parseQbsFromTeamPage(html, team));
    if (delayMs > 0) await sleep(delayMs);
  }

  const byKey = new Map();
  for (const qb of fetched) {
    const key = normalizeQbKey(qb.name);
    if (!byKey.has(key)) byKey.set(key, qb);
  }
  return [...byKey.values()];
}

/**
 * Build the next roster from a fresh scrape.
 * Keeps existing display names on match so sheet picks stay canonical,
 * but always takes the scraped team (e.g. Brissett ARZ → BAL).
 */
export function mergeRoster(existing, fetched) {
  const previous = new Map(existing.map((qb) => [normalizeQbKey(qb.name), qb]));
  const next = [];
  const seen = new Set();

  for (const qb of fetched) {
    const key = normalizeQbKey(qb.name);
    if (seen.has(key)) continue;
    seen.add(key);
    const prior = previous.get(key);
    next.push({
      name: prior?.name || qb.name,
      team: qb.team,
    });
  }

  next.sort((a, b) => a.name.localeCompare(b.name));

  const added = next.filter((qb) => !previous.has(normalizeQbKey(qb.name)));
  const removed = existing.filter((qb) => !seen.has(normalizeQbKey(qb.name)));
  const teamChanges = existing
    .map((qb) => {
      const updated = next.find((entry) => normalizeQbKey(entry.name) === normalizeQbKey(qb.name));
      if (!updated || updated.team === qb.team) return null;
      return { name: qb.name, from: qb.team, to: updated.team };
    })
    .filter(Boolean);

  return { qbs: next, added, removed, teamChanges };
}

async function writeQbsSource(qbs, fetchedAt) {
  const modulePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "qbs.js");
  const current = await readFile(modulePath, "utf8");
  const lines = qbs.map((qb) => `  { name: ${JSON.stringify(qb.name)}, team: ${JSON.stringify(qb.team)} },`);
  const nextArray = `export const DEFAULT_QBS = [\n${lines.join("\n")}\n];`;
  const replaced = current.replace(/export const DEFAULT_QBS = \[[\s\S]*?\];/, nextArray);
  if (replaced === current) {
    throw new Error("Could not find DEFAULT_QBS array in src/qbs.js to rewrite");
  }
  const withHeader = replaced.replace(
    /^\/\/ Active \+ practice-squad NFL QBs from Ourlads[^\n]*/m,
    `// Active + practice-squad NFL QBs from Ourlads depth charts (fetched ${fetchedAt})`,
  );
  await writeFile(modulePath, withHeader);
}

async function loadUpdateDate() {
  try {
    const parsed = JSON.parse(await readFile(statePath, "utf8"));
    return parsed.date || "";
  } catch {
    return "";
  }
}

async function saveUpdateDate(date) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(statePath, JSON.stringify({ date }, null, 2));
}

export async function loadPersistedRoster() {
  try {
    const parsed = JSON.parse(await readFile(qbsPath, "utf8"));
    if (!Array.isArray(parsed.qbs) || parsed.qbs.length === 0) return null;
    replaceQbs(parsed.qbs);
    return parsed;
  } catch {
    return null;
  }
}

export async function runRosterUpdate({ writeSource = false, delayMs = 150 } = {}) {
  let existing = QBS.map((qb) => ({ ...qb }));
  if (existing.length === 0) {
    existing = DEFAULT_QBS.map((qb) => ({ ...qb }));
  }
  try {
    const persisted = JSON.parse(await readFile(qbsPath, "utf8"));
    if (Array.isArray(persisted.qbs) && persisted.qbs.length) {
      // Prefer persisted names/teams as the merge baseline when present.
      existing = persisted.qbs.map((qb) => ({ name: qb.name, team: qb.team }));
    }
  } catch {
    // Seed from the in-memory / DEFAULT list when no persisted roster exists yet.
  }

  const fetched = await fetchOurladsQbs({ delayMs });
  if (fetched.length < 40) {
    throw new Error(`Ourlads roster look suspiciously small (${fetched.length} QBs); skipping write`);
  }

  const { qbs, added, removed, teamChanges } = mergeRoster(existing, fetched);
  const fetchedAt = dateKey();

  await mkdir(dataDir, { recursive: true });
  await writeFile(
    qbsPath,
    JSON.stringify(
      {
        fetchedAt,
        source: "ourlads",
        qbs,
      },
      null,
      2,
    ),
  );

  replaceQbs(qbs);

  if (writeSource) {
    await writeQbsSource(qbs, fetchedAt);
  }

  return { qbs, added, removed, teamChanges, fetchedAt };
}

function summarize(result) {
  const parts = [
    `Roster update ${result.fetchedAt}: ${result.qbs.length} QBs`,
    `+${result.added.length}`,
    `-${result.removed.length}`,
    `${result.teamChanges.length} team move(s)`,
  ];
  if (result.teamChanges.length) {
    parts.push(
      result.teamChanges.map((change) => `${change.name} ${change.from}→${change.to}`).join(", "),
    );
  }
  return parts.join(" | ");
}

export async function maybeUpdateRoster() {
  if (localWeekday() !== "Tue") return;
  if (localHour() < ROSTER_HOUR) return;

  const today = dateKey();
  if ((await loadUpdateDate()) === today) return;

  try {
    const result = await runRosterUpdate();
    await saveUpdateDate(today);
    console.log(summarize(result));
  } catch (error) {
    console.error("Failed weekly QB roster update", error);
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const writeSource = process.argv.includes("--write-source");
  try {
    const result = await runRosterUpdate({ writeSource });
    await saveUpdateDate(dateKey());
    console.log(summarize(result));
    if (result.added.length) {
      console.log(
        "Added:",
        result.added.map((qb) => `${qb.name} (${qb.team})`).join(", "),
      );
    }
    if (result.removed.length) {
      console.log(
        "Removed:",
        result.removed.map((qb) => `${qb.name} (${qb.team})`).join(", "),
      );
    }
    if (result.teamChanges.length) {
      console.log(
        "Team changes:",
        result.teamChanges.map((c) => `${c.name}: ${c.from} → ${c.to}`).join(", "),
      );
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
