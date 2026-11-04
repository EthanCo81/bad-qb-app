// Active + practice-squad NFL QBs from Ourlads 2026 team depth charts (fetched 2026-11-04)
// https://www.ourlads.com/nfldepthcharts/depthcharts.aspx
export const QBS = [
  { name: "Aaron Rodgers", team: "PIT" },
  { name: "Aidan O'Connell", team: "LV" },
  { name: "Andy Dalton", team: "ATL" },
  { name: "Anthony Richardson Sr.", team: "IND" },
  { name: "Athan Kaliakmanis", team: "WAS" },
  { name: "Austin Reed", team: "BAL" },
  { name: "Baker Mayfield", team: "TB" },
  { name: "Behren Morton", team: "NE" },
  { name: "Bo Nix", team: "DEN" },
  { name: "Brady Cook", team: "MIA" },
  { name: "Brock Purdy", team: "SF" },
  { name: "Bryce Young", team: "CAR" },
  { name: "C.J. Stroud", team: "HOU" },
  { name: "Cade Klubnik", team: "NYJ" },
  { name: "Caleb Williams", team: "CHI" },
  { name: "Cam Miller", team: "GB" },
  { name: "Cam Ward", team: "TEN" },
  { name: "Carson Beck", team: "ARZ" },
  { name: "Carson Wentz", team: "MIN" },
  { name: "Case Keenum", team: "CHI" },
  { name: "Cole Payton", team: "PHI" },
  { name: "Dak Prescott", team: "DAL" },
  { name: "Daniel Jones", team: "IND" },
  { name: "Davis Mills", team: "HOU" },
  { name: "Deshaun Watson", team: "CLE" },
  { name: "Dillon Gabriel", team: "CLE" },
  { name: "DJ Uiagalelei", team: "LAC" },
  { name: "Drake Maye", team: "NE" },
  { name: "Drew Allar", team: "PIT" },
  { name: "Drew Lock", team: "SEA" },
  { name: "Easton Stick", team: "TB" },
  { name: "Fernando Mendoza", team: "LV" },
  { name: "Gardner Minshew II", team: "ARZ" },
  { name: "Garrett Nussmeier", team: "KC" },
  { name: "Geno Smith", team: "NYJ" },
  { name: "Haynes King", team: "CAR" },
  { name: "Hendon Hooker", team: "TEN" },
  { name: "J.J. McCarthy", team: "NYG" },
  { name: "Jack Strand", team: "ATL" },
  { name: "Jacoby Brissett", team: "ARZ" },
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
  { name: "Joey Aguilar", team: "JAX" },
  { name: "Jordan Love", team: "GB" },
  { name: "Josh Allen", team: "BUF" },
  { name: "Josh Johnson", team: "CIN" },
  { name: "Joshua Dobbs", team: "DET" },
  { name: "Justin Fields", team: "KC" },
  { name: "Justin Herbert", team: "LAC" },
  { name: "Kedon Slovis", team: "BAL" },
  { name: "Kenny Pickett", team: "CAR" },
  { name: "Kirk Cousins", team: "LV" },
  { name: "Kurtis Rourke", team: "SF" },
  { name: "Kyle Allen", team: "BUF" },
  { name: "Kyle McCord", team: "MIA" },
  { name: "Kyle Trask", team: "DAL" },
  { name: "Kyler Murray", team: "MIN" },
  { name: "Lamar Jackson", team: "BAL" },
  { name: "Luke Altmyer", team: "DET" },
  { name: "Mac Jones", team: "SF" },
  { name: "Malik Willis", team: "MIA" },
  { name: "Marcus Mariota", team: "WAS" },
  { name: "Mason Rudolph", team: "PIT" },
  { name: "Matthew Stafford", team: "LAR" },
  { name: "Max Brosmer", team: "MIN" },
  { name: "Michael Penix Jr.", team: "ATL" },
  { name: "Miller Moss", team: "CHI" },
  { name: "Mitchell Trubisky", team: "TEN" },
  { name: "Nick Mullens", team: "JAX" },
  { name: "Patrick Mahomes", team: "KC" },
  { name: "Quinn Ewers", team: "JAX" },
  { name: "Riley Leonard", team: "IND" },
  { name: "Sam Darnold", team: "SEA" },
  { name: "Sam Ehlinger", team: "DEN" },
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
  { name: "Tyler Huntley", team: "BAL" },
  { name: "Tyler Shough", team: "NO" },
  { name: "Tyrod Taylor", team: "GB" },
  { name: "Tyson Bagent", team: "CHI" },
  { name: "Will Howard", team: "PIT" },
  { name: "Will Levis", team: "NYJ" },
  { name: "Zach Wilson", team: "NO" },
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
