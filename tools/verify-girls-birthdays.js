const fs = require("fs");

const AS_OF = { year: 2026, month: 2, day: 10 };

function parseMatchesAges() {
  const html = fs.readFileSync("Matches.html", "utf8");
  const re = /<img[^>]*\salt="([^"]+)"[^>]*>[\s\S]*?<span class="meta">\s*•\s*(\d+)\s*<\/span>/g;
  const map = {};
  let match;
  while ((match = re.exec(html))) {
    const label = String(match[1] || "").trim();
    const age = Number(match[2]);
    if (!label) continue;
    const key = label.toLowerCase();
    if (key === "user" || key === "your profile photo") continue;
    if (Number.isFinite(age)) map[label] = age;
  }
  return map;
}

function ageFromDob(dob) {
  const [y, m, d] = String(dob).split("-").map(Number);
  if (!y || !m || !d) return null;
  let age = AS_OF.year - y;
  const birthdayStillAhead = m > AS_OF.month || (m === AS_OF.month && d > AS_OF.day);
  if (birthdayStillAhead) age -= 1;
  return age;
}

function parseGirls() {
  const text = fs.readFileSync("30pagesofgirls/girls-data.js", "utf8");
  const re = /"name"\s*:\s*"([^"]+)"[\s\S]*?"birthday"\s*:\s*"(\d{4}-\d{2}-\d{2})"/g;
  const out = [];
  let match;
  while ((match = re.exec(text))) out.push({ name: match[1], birthday: match[2] });
  return out;
}

const matchesAges = parseMatchesAges();
const girls = parseGirls();

const mismatches = [];
for (const g of girls) {
  const firstName = g.name.split(/\s+/)[0];
  const expected = matchesAges[firstName];
  if (!expected) continue;
  const got = ageFromDob(g.birthday);
  if (got !== expected) mismatches.push({ name: g.name, birthday: g.birthday, expected, got });
}

if (mismatches.length) {
  console.log("MISMATCHES:");
  console.log(JSON.stringify(mismatches, null, 2));
  process.exitCode = 1;
} else {
  console.log("OK: All girls with ages in Matches.html match as-of age.");
}
