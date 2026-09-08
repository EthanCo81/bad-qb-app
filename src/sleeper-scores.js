const SLEEPER_API = "https://api.sleeper.app/v1";
const DEFAULT_LEAGUE_ID = "1322259662862581760";

let playersCache = null;
let scoringCache = null;
let qbIndex = null;

function leagueId() {
  return process.env.SLEEPER_LEAGUE_ID || DEFAULT_LEAGUE_ID;
}

async function getJson(path) {
  const response = await fetch(`${SLEEPER_API}${path}`);
  if (!response.ok) {
    throw new Error(`Sleeper ${path} failed (${response.status})`);
  }
  return response.json();
}

export function normalizePlayerName(name) {
  return String(name)
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function buildQbIndex(players) {
  const index = new Map();
  for (const [id, player] of Object.entries(players)) {
    if (!player || player.position !== "QB") continue;
    const names = [
      player.full_name,
      `${player.first_name || ""} ${player.last_name || ""}`.trim(),
    ].filter(Boolean);
    for (const name of names) {
      const key = normalizePlayerName(name);
      if (!key) continue;
      const existing = index.get(key);
      if (!existing || player.status === "Active") {
        index.set(key, id);
      }
    }
  }
  return index;
}

async function loadPlayers() {
  if (!playersCache) {
    playersCache = await getJson("/players/nfl");
    qbIndex = buildQbIndex(playersCache);
  }
  return { players: playersCache, index: qbIndex };
}

async function loadScoring() {
  if (!scoringCache) {
    const league = await getJson(`/league/${leagueId()}`);
    scoringCache = league.scoring_settings || {};
  }
  return scoringCache;
}

export function fantasyPoints(stats, scoring) {
  if (!stats || !scoring) return 0;
  let points = 0;
  for (const [stat, weight] of Object.entries(scoring)) {
    const value = stats[stat];
    if (typeof value === "number" && typeof weight === "number") {
      points += value * weight;
    }
  }
  return Math.round(points * 100) / 100;
}

export function findQbId(name, index) {
  return index.get(normalizePlayerName(name)) || null;
}

function statsHaveGames(statsByPlayer) {
  return Object.values(statsByPlayer).some(
    (stats) => stats && (stats.gp || stats.pass_att || stats.pass_yd || stats.rush_att),
  );
}

function isBlank(value) {
  return value === "" || value == null;
}

function missingScore(row) {
  return isBlank(row.score1) || isBlank(row.score2);
}

export async function buildScoreUpdates(rows, week, season) {
  const targets = rows.filter((row) => Number(row.week) === week && missingScore(row));
  if (targets.length === 0) return [];

  const statsByPlayer = await getJson(`/stats/nfl/regular/${season}/${week}`);
  if (!statsByPlayer || !statsHaveGames(statsByPlayer)) {
    return null;
  }

  const [{ index }, scoring] = await Promise.all([loadPlayers(), loadScoring()]);
  return targets.map((row) => ({
    userId: String(row.userId),
    week,
    score_1: pointsForName(row.name1, index, statsByPlayer, scoring),
    score_2: pointsForName(row.name2, index, statsByPlayer, scoring),
  }));
}

function pointsForName(name, index, statsByPlayer, scoring) {
  const id = findQbId(name, index);
  if (!id) return 0;
  return fantasyPoints(statsByPlayer[id], scoring);
}

export async function currentSleeperSeason() {
  const state = await getJson("/state/nfl");
  return String(state.season || new Date().getFullYear());
}
