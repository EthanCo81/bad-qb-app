// Active + practice-squad NFL QBs from Ourlads depth charts (fetched 2026-11-24)
// https://www.ourlads.com/nfldepthcharts/depthcharts.aspx
// Runtime refreshes land in data/qbs.json via src/roster-update.js (Tuesday 1am).
export const DEFAULT_QBS = [
  { name: "Aaron Rodgers", team: "PIT" },
  { name: "Aidan O'Connell", team: "LV" },
  { name: "Andy Dalton", team: "ATL" },
  { name: "Anthony Richardson Sr.", team: "IND" },
  { name: "Baker Mayfield", team: "TB" },
  { name: "Behren Morton", team: "NE" },
  { name: "Bo Nix", team: "DEN" },
  { name: "Brady Cook", team: "MIA" },
  { name: "Brett Rypien", team: "LV" },
  { name: "Brock Purdy", team: "SF" },
  { name: "Bryce Young", team: "CAR" },
  { name: "C.J. Stroud", team: "HOU" },
  { name: "Cade Klubnik", team: "NYJ" },
  { name: "Caleb Williams", team: "CHI" },
  { name: "Cam Miller", team: "GB" },
  { name: "Cam Ward", team: "TEN" },
  { name: "Carson Beck", team: "ARZ" },
  { name: "Carson Wentz", team: "MIN" },
  { name: "Cooper Rush", team: "TB" },
  { name: "Dak Prescott", team: "DAL" },
  { name: "Davis Mills", team: "HOU" },
  { name: "Deshaun Watson", team: "CLE" },
  { name: "Dillon Gabriel", team: "CLE" },
  { name: "DJ Uiagalelei", team: "LAC" },
  { name: "Drake Maye", team: "NE" },
  { name: "Drew Lock", team: "SEA" },
  { name: "Fernando Mendoza", team: "LV" },
  { name: "Geno Smith", team: "NYJ" },
  { name: "Hendon Hooker", team: "TEN" },
  { name: "J.J. McCarthy", team: "NYG" },
  { name: "Jack Strand", team: "ATL" },
  { name: "Jacoby Brissett", team: "BAL" },
  { name: "Jake Browning", team: "LAC" },
  { name: "Jake Haener", team: "NYG" },
  { name: "Jalen Milroe", team: "SEA" },
  { name: "Jalon Daniels", team: "TB" },
  { name: "Jameis Winston", team: "NYG" },
  { name: "Jared Goff", team: "DET" },
  { name: "Jarrett Stidham", team: "DEN" },
  { name: "Jayden Daniels", team: "WAS" },
  { name: "Joe Burrow", team: "CIN" },
  { name: "Joe Fagnano", team: "BAL" },
  { name: "Joe Flacco", team: "CIN" },
  { name: "Joe Milton", team: "PHI" },
  { name: "Joey Aguilar", team: "ARZ" },
  { name: "Jordan Love", team: "GB" },
  { name: "Josh Allen", team: "BUF" },
  { name: "Josh Johnson", team: "ARZ" },
  { name: "Joshua Dobbs", team: "DET" },
  { name: "Justin Fields", team: "KC" },
  { name: "Justin Herbert", team: "LAC" },
  { name: "Kenny Pickett", team: "CAR" },
  { name: "Kirk Cousins", team: "MIN" },
  { name: "Kyle Allen", team: "BUF" },
  { name: "Kyle McCord", team: "MIA" },
  { name: "Kyle Trask", team: "DAL" },
  { name: "Kyler Murray", team: "MIN" },
  { name: "Luke Altmyer", team: "DET" },
  { name: "Mac Jones", team: "SF" },
  { name: "Marcus Mariota", team: "WAS" },
  { name: "Mason Rudolph", team: "PIT" },
  { name: "Matthew Stafford", team: "LAR" },
  { name: "Michael Penix Jr.", team: "ATL" },
  { name: "Mitchell Trubisky", team: "TEN" },
  { name: "Nick Mullens", team: "JAX" },
  { name: "Patrick Mahomes", team: "KC" },
  { name: "Quinn Ewers", team: "JAX" },
  { name: "Riley Leonard", team: "IND" },
  { name: "Sam Darnold", team: "SEA" },
  { name: "Sam Hartman", team: "WAS" },
  { name: "Sam Howell", team: "DAL" },
  { name: "Sean Clifford", team: "CIN" },
  { name: "Shane Buechele", team: "BUF" },
  { name: "Shedeur Sanders", team: "CLE" },
  { name: "Spencer Rattler", team: "NO" },
  { name: "Stetson Bennett IV", team: "LAR" },
  { name: "Tanner McKee", team: "PHI" },
  { name: "Taylen Green", team: "CLE" },
  { name: "Tommy DeVito", team: "NE" },
  { name: "Trevor Lawrence", team: "JAX" },
  { name: "Tua Tagovailoa", team: "ATL" },
  { name: "Ty Simpson", team: "LAR" },
  { name: "Tyler Shough", team: "NO" },
  { name: "Tyrod Taylor", team: "GB" },
  { name: "Tyson Bagent", team: "CHI" },
  { name: "Will Levis", team: "NYJ" },
];

export let QBS = DEFAULT_QBS.map((qb) => ({ ...qb }));

export function normalizeQbKey(name) {
  return String(name)
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function replaceQbs(next) {
  QBS = next.map((qb) => ({ name: qb.name, team: qb.team }));
  return QBS;
}

function qbName(qb) {
  return typeof qb === "string" ? qb : qb.name;
}

export function suggestQbs(query, exclude = new Set()) {
  const needle = query.trim().toLowerCase();
  const matches = QBS.filter((qb) => {
    const name = qbName(qb);
    if (exclude.has(name.toLowerCase())) return false;
    if (!needle) return true;
    return name.toLowerCase().includes(needle);
  });
  return matches.slice(0, 25).map((qb) => {
    const name = qbName(qb);
    return { name, value: name };
  });
}

export function isKnownQb(name) {
  return canonicalQb(name) != null;
}

export function canonicalQb(name) {
  const needle = String(name).trim().toLowerCase();
  const match = QBS.find((qb) => qbName(qb).toLowerCase() === needle);
  return match ? qbName(match) : null;
}

export function teamForQb(name) {
  const needle = String(name).trim().toLowerCase();
  const match = QBS.find((qb) => qbName(qb).toLowerCase() === needle);
  return match?.team ?? null;
}

export function teammatesForQb(name) {
  const team = teamForQb(name);
  if (!team) return [];
  const needle = String(name).trim().toLowerCase();
  return QBS.filter((qb) => qb.team === team && qbName(qb).toLowerCase() !== needle).map(qbName);
}
