// Active NFL QBs from Ourlads 2026 team depth charts (fetched 2026-09-08)
// https://www.ourlads.com/nfldepthcharts/depthcharts.aspx
// plus Dillon Gabriel (Browns IR) from NFL.com cutdown coverage.
export const QBS = [
  "Joey Aguilar",
  "Drew Allar",
  "Josh Allen",
  "Kyle Allen",
  "Luke Altmyer",
  "Tyson Bagent",
  "Carson Beck",
  "Stetson Bennett IV",
  "Jacoby Brissett",
  "Shane Buechele",
  "Joe Burrow",
  "Sean Clifford",
  "Brady Cook",
  "Kirk Cousins",
  "Andy Dalton",
  "Jalon Daniels",
  "Jayden Daniels",
  "Jaxson Dart",
  "Sam Darnold",
  "Tommy DeVito",
  "Joshua Dobbs",
  "Sam Ehlinger",
  "Quinn Ewers",
  "Joe Fagnano",
  "Justin Fields",
  "Joe Flacco",
  "Dillon Gabriel",
  "Jared Goff",
  "Taylen Green",
  "Jake Haener",
  "Sam Hartman",
  "Justin Herbert",
  "Hendon Hooker",
  "Will Howard",
  "Sam Howell",
  "Tyler Huntley",
  "Jalen Hurts",
  "Lamar Jackson",
  "Josh Johnson",
  "Daniel Jones",
  "Mac Jones",
  "Athan Kaliakmanis",
  "Case Keenum",
  "Haynes King",
  "Cade Klubnik",
  "Trey Lance",
  "Trevor Lawrence",
  "Riley Leonard",
  "Drew Lock",
  "Jordan Love",
  "Patrick Mahomes",
  "Marcus Mariota",
  "Drake Maye",
  "Baker Mayfield",
  "J.J. McCarthy",
  "Kyle McCord",
  "Tanner McKee",
  "Fernando Mendoza",
  "Davis Mills",
  "Jalen Milroe",
  "Gardner Minshew II",
  "Behren Morton",
  "Nick Mullens",
  "Kyler Murray",
  "Bo Nix",
  "Garrett Nussmeier",
  "Aidan O'Connell",
  "Cole Payton",
  "Michael Penix Jr.",
  "Kenny Pickett",
  "Dak Prescott",
  "Brock Purdy",
  "Spencer Rattler",
  "Anthony Richardson Sr.",
  "Aaron Rodgers",
  "Kurtis Rourke",
  "Cooper Rush",
  "Mason Rudolph",
  "Shedeur Sanders",
  "Tyler Shough",
  "Ty Simpson",
  "Geno Smith",
  "Matthew Stafford",
  "Easton Stick",
  "Jarrett Stidham",
  "Jack Strand",
  "C.J. Stroud",
  "Tua Tagovailoa",
  "Tyrod Taylor",
  "Mitchell Trubisky",
  "DJ Uiagalelei",
  "Cam Ward",
  "Deshaun Watson",
  "Carson Wentz",
  "Caleb Williams",
  "Malik Willis",
  "Zach Wilson",
  "Jameis Winston",
  "Bryce Young",
  "Bailey Zappe",
];

export function suggestQbs(query, exclude = new Set()) {
  const needle = query.trim().toLowerCase();
  const matches = QBS.filter((name) => {
    if (exclude.has(name.toLowerCase())) return false;
    if (!needle) return true;
    return name.toLowerCase().includes(needle);
  });
  return matches.slice(0, 25).map((name) => ({ name, value: name }));
}

export function isKnownQb(name) {
  return canonicalQb(name) != null;
}

export function canonicalQb(name) {
  const needle = String(name).trim().toLowerCase();
  return QBS.find((qb) => qb.toLowerCase() === needle) ?? null;
}
