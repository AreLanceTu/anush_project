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

function computeDobFromAgeKeepingMonthDay(age, month, day) {
  let year = AS_OF.year - Number(age);
  const birthdayStillAhead = month > AS_OF.month || (month === AS_OF.month && day > AS_OF.day);
  if (birthdayStillAhead) year -= 1;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function main() {
  const ages = parseMatchesAges();

  const dataText = fs.readFileSync("30pagesofgirls/girls-data.js", "utf8");
  const entryRe = /"slug"\s*:\s*"([^"]+)"[\s\S]*?"name"\s*:\s*"([^"]+)"[\s\S]*?"birthday"\s*:\s*"(\d{4})-(\d{2})-(\d{2})"/g;

  const replacements = [];
  let match;
  while ((match = entryRe.exec(dataText))) {
    const slug = match[1];
    const fullName = match[2];
    const oldDob = `${match[3]}-${match[4]}-${match[5]}`;

    const firstName = String(fullName).trim().split(/\s+/)[0];
    const age = ages[firstName];
    if (!age) continue;

    const month = Number(match[4]);
    const day = Number(match[5]);
    const newDob = computeDobFromAgeKeepingMonthDay(age, month, day);

    if (newDob !== oldDob) {
      replacements.push({ slug, name: fullName, firstName, age, oldDob, newDob });
    }
  }

  replacements.sort((a, b) => a.slug.localeCompare(b.slug));

  console.log(`Found ${Object.keys(ages).length} ages in Matches.html`);
  console.log(`Will update ${replacements.length} girls in girls-data.js`);
  console.log(JSON.stringify(replacements, null, 2));
}

main();
