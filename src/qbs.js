// Active NFL QBs from Ourlads 2026 team depth charts (fetched 2026-09-29)
// https://www.ourlads.com/nfldepthcharts/depthcharts.aspx
// plus Dillon Gabriel (Browns IR) from the CLE reserves list.
export const QBS = [
  { name: "Joey Aguilar", team: "JAX" },
  { name: "Drew Allar", team: "PIT" },
  { name: "Josh Allen", team: "BUF" },
  { name: "Kyle Allen", team: "BUF" },
  { name: "Luke Altmyer", team: "DET" },
  { name: "Tyson Bagent", team: "CHI" },
  { name: "Carson Beck", team: "ARZ" },
  { name: "Stetson Bennett IV", team: "LAR" },
  { name: "Jacoby Brissett", team: "ARZ" },
  { name: "Shane Buechele", team: "BUF" },
  { name: "Joe Burrow", team: "CIN" },
  { name: "Sean Clifford", team: "CIN" },
  { name: "Brady Cook", team: "MIA" },
  { name: "Kirk Cousins", team: "LV" },
  { name: "Andy Dalton", team: "PHI" },
  { name: "Jalon Daniels", team: "TB" },
  { name: "Jayden Daniels", team: "WAS" },
  { name: "Jaxson Dart", team: "NYG" },
  { name: "Sam Darnold", team: "SEA" },
  { name: "Tommy DeVito", team: "NE" },
  { name: "Joshua Dobbs", team: "DET" },
  { name: "Sam Ehlinger", team: "DEN" },
  { name: "Quinn Ewers", team: "JAX" },
  { name: "Joe Fagnano", team: "BAL" },
  { name: "Justin Fields", team: "KC" },
  { name: "Joe Flacco", team: "CIN" },
  { name: "Dillon Gabriel", team: "CLE" },
  { name: "Jared Goff", team: "DET" },
  { name: "Taylen Green", team: "CLE" },
  { name: "Jake Haener", team: "NYG" },
  { name: "Sam Hartman", team: "WAS" },
  { name: "Justin Herbert", team: "LAC" },
  { name: "Hendon Hooker", team: "TEN" },
  { name: "Will Howard", team: "PIT" },
  { name: "Sam Howell", team: "DAL" },
  { name: "Tyler Huntley", team: "BAL" },
  { name: "Jalen Hurts", team: "PHI" },
  { name: "Lamar Jackson", team: "BAL" },
  { name: "Josh Johnson", team: "CIN" },
  { name: "Daniel Jones", team: "IND" },
  { name: "Mac Jones", team: "SF" },
  { name: "Athan Kaliakmanis", team: "WAS" },
  { name: "Case Keenum", team: "CHI" },
  { name: "Haynes King", team: "CAR" },
  { name: "Cade Klubnik", team: "NYJ" },
  { name: "Trey Lance", team: "LAC" },
  { name: "Trevor Lawrence", team: "JAX" },
  { name: "Riley Leonard", team: "IND" },
  { name: "Drew Lock", team: "SEA" },
  { name: "Jordan Love", team: "GB" },
  { name: "Patrick Mahomes", team: "KC" },
  { name: "Marcus Mariota", team: "WAS" },
  { name: "Drake Maye", team: "NE" },
  { name: "Baker Mayfield", team: "TB" },
  { name: "J.J. McCarthy", team: "MIN" },
  { name: "Kyle McCord", team: "MIA" },
  { name: "Tanner McKee", team: "PHI" },
  { name: "Fernando Mendoza", team: "LV" },
  { name: "Davis Mills", team: "HOU" },
  { name: "Jalen Milroe", team: "SEA" },
  { name: "Gardner Minshew II", team: "ARZ" },
  { name: "Behren Morton", team: "NE" },
  { name: "Nick Mullens", team: "JAX" },
  { name: "Kyler Murray", team: "MIN" },
  { name: "Bo Nix", team: "DEN" },
  { name: "Garrett Nussmeier", team: "KC" },
  { name: "Aidan O'Connell", team: "LV" },
  { name: "Cole Payton", team: "PHI" },
  { name: "Michael Penix Jr.", team: "ATL" },
  { name: "Kenny Pickett", team: "CAR" },
  { name: "Dak Prescott", team: "DAL" },
  { name: "Brock Purdy", team: "SF" },
  { name: "Spencer Rattler", team: "NO" },
  { name: "Anthony Richardson Sr.", team: "IND" },
  { name: "Aaron Rodgers", team: "PIT" },
  { name: "Kurtis Rourke", team: "SF" },
  { name: "Cooper Rush", team: "ATL" },
  { name: "Mason Rudolph", team: "PIT" },
  { name: "Shedeur Sanders", team: "CLE" },
  { name: "Tyler Shough", team: "NO" },
  { name: "Ty Simpson", team: "LAR" },
  { name: "Geno Smith", team: "NYJ" },
  { name: "Matthew Stafford", team: "LAR" },
  { name: "Easton Stick", team: "TB" },
  { name: "Jarrett Stidham", team: "DEN" },
  { name: "Jack Strand", team: "ATL" },
  { name: "C.J. Stroud", team: "HOU" },
  { name: "Tua Tagovailoa", team: "ATL" },
  { name: "Tyrod Taylor", team: "GB" },
  { name: "Mitchell Trubisky", team: "TEN" },
  { name: "DJ Uiagalelei", team: "LAC" },
  { name: "Cam Ward", team: "TEN" },
  { name: "Deshaun Watson", team: "CLE" },
  { name: "Carson Wentz", team: "MIN" },
  { name: "Caleb Williams", team: "CHI" },
  { name: "Malik Willis", team: "MIA" },
  { name: "Zach Wilson", team: "NO" },
  { name: "Jameis Winston", team: "NYG" },
  { name: "Bryce Young", team: "CAR" },
  { name: "Bailey Zappe", team: "NYJ" },
];

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
