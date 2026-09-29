import { teammatesForQb } from "./qbs.js";

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
  return targets.map((row) => {
    const pick1 = resolvePickScore(row.name1, row.name2, index, statsByPlayer, scoring);
    const pick2 = resolvePickScore(row.name2, pick1.name, index, statsByPlayer, scoring);
    return {
      userId: String(row.userId),
      week,
      name_1: pick1.name,
      name_2: pick2.name,
      score_1: pick1.score,
      score_2: pick2.score,
    };
  });
}

function pointsForName(name, index, statsByPlayer, scoring) {
  const id = findQbId(name, index);
  if (!id) return 0;
  return fantasyPoints(statsByPlayer[id], scoring);
}

/**
 * A score of 0 means the QB did not play (illegal pick). Replace with a
 * same-team QB who scored non-zero this week, preferring the highest score.
 * Skips the other pick on the same row so both slots stay distinct.
 */
export function resolvePickScore(name, otherPickName, index, statsByPlayer, scoring) {
  const score = pointsForName(name, index, statsByPlayer, scoring);
  if (score !== 0) {
    return { name, score };
  }

  const otherKey = String(otherPickName || "")
    .trim()
    .toLowerCase();
  let best = null;
  for (const teammate of teammatesForQb(name)) {
    if (teammate.toLowerCase() === otherKey) continue;
    const teammateScore = pointsForName(teammate, index, statsByPlayer, scoring);
    if (teammateScore === 0) continue;
    if (!best || teammateScore > best.score) {
      best = { name: teammate, score: teammateScore };
    }
  }
  return best || { name, score: 0 };
}

export async function currentSleeperSeason() {
  const state = await getJson("/state/nfl");
  return String(state.season || new Date().getFullYear());
}
