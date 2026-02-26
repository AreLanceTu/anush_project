const fs = require("fs");
const path = require("path");

function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseMatchesFemaleSlugs(html) {
  const cards = [...html.matchAll(/<article\b[^>]*class="[^"]*\bcard\b[^"]*"[\s\S]*?<\/article>/gi)].map((m) => m[0]);
  const names = cards
    .map((card) => {
      const m = card.match(/<div\s+class="name">([\s\S]*?)<\/div>/i);
      const raw = stripTags(m ? m[1] : "");
      // MatchesFemale formats: "Name • 29" -> keep just the name
      return raw.split("•")[0].trim();
    })
    .filter(Boolean);

  return {
    cardCount: cards.length,
    names,
    slugs: new Set(names.map(slugify)),
  };
}

function listProfileSlugs(boysDir) {
  return fs
    .readdirSync(boysDir)
    .filter((f) => f.toLowerCase().endsWith(".html"))
    .filter((f) => f !== "MatchesFemale.html")
    .map((f) => f.replace(/\.html$/i, ""));
}

function main() {
  const repoRoot = process.cwd();
  const matchesPath = path.join(repoRoot, "MatchesFemale.html");
  const boysDir = path.join(repoRoot, "30pagesofboys");

  const html = fs.readFileSync(matchesPath, "utf8");
  const { cardCount, names, slugs } = parseMatchesFemaleSlugs(html);
  const profiles = listProfileSlugs(boysDir);

  const profilesNotInMatchesFemale = profiles.filter((s) => !slugs.has(s)).sort();

  console.log(
    JSON.stringify(
      {
        cardsFound: cardCount,
        cardNamesParsed: names.length,
        profilesFound: profiles.length,
        profilesNotInMatchesFemale,
        count: profilesNotInMatchesFemale.length,
      },
      null,
      2
    )
  );
}

main();
