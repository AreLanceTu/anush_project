/*
  Generates missing boy profile pages and dataset entries based on MatchesFemale.html.

  - Reads MatchesFemale cards (name/location/profession/bio/photo/age)
  - Creates 30pagesofboys/<slug>.html if missing (and public mirror)
  - Appends missing entries to 30pagesofboys/girls-data.js (and public mirror)

  Run:
    node tools/generate-missing-boy-profiles.js
*/

const fs = require("fs");
const path = require("path");

function slugifyName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function readFileUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function listExistingProfileSlugs(boysDir) {
  const entries = fs.readdirSync(boysDir, { withFileTypes: true });
  return new Set(
    entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".html"))
      .map((e) => e.name)
      .filter((name) => name !== "MatchesFemale.html")
      .map((name) => name.slice(0, -5).toLowerCase())
  );
}

function normalizePhotoPathForDataset(src) {
  const raw = String(src || "").trim();
  if (!raw) return "../Boysimage/pinterest1.jpeg";
  if (raw.startsWith("../")) return raw;
  if (raw.startsWith("Boysimage/")) return `../${raw}`;
  if (raw.startsWith("GirlsImage/") || raw.startsWith("Gilrlsimage/")) return `../${raw}`;
  return raw;
}

function computeBirthdayFromAge(age) {
  const n = Number(String(age || "").trim());
  if (!Number.isFinite(n) || n < 18 || n > 80) return "";
  const year = new Date().getFullYear() - n;
  const yyyy = String(year).padStart(4, "0");
  return `${yyyy}-06-15`;
}

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function datasetHasSlug(datasetSource, slug) {
  const key = escapeRegExp(String(slug || "").trim().toLowerCase());
  if (!key) return false;
  const re = new RegExp(`\\bslug\\s*:\\s*["']${key}["']`, "i");
  return re.test(datasetSource);
}

function hashString(str) {
  // djb2-ish
  let h = 5381;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return h >>> 0;
}

function pick(list, seed) {
  if (!Array.isArray(list) || list.length === 0) return "";
  const idx = Number(seed) % list.length;
  return list[idx];
}

function pickPhotos(slug, fallbackPhoto) {
  const seed = hashString(slug);
  const base = fallbackPhoto || "../Boysimage/pinterest1.jpeg";
  const pool = Array.from({ length: 20 }, (_, i) => `../Boysimage/pinterest${i + 1}.jpeg`);
  const p1 = base;
  const p2 = pool[(seed + 7) % pool.length];
  const p3 = pool[(seed + 13) % pool.length];
  return [p1, p2, p3];
}

function buildRandomProfileFields(slug, profession, bio) {
  const seed = hashString(`${slug}|${profession}|${bio}`);
  const companies = [
    "Infosys",
    "TCS",
    "Wipro",
    "Deloitte",
    "KPMG",
    "Accenture",
    "HDFC Bank",
    "ICICI Bank",
    "Apollo Hospitals",
    "Reliance",
    "Mahindra",
    "Startup",
  ];
  const qualifications = [
    "B.Tech",
    "B.E.",
    "BBA",
    "MBA",
    "B.Com",
    "M.Com",
    "B.Sc",
    "M.Sc",
    "B.Des",
    "B.Arch",
    "LLB",
    "MBBS",
  ];
  const hobbies = [
    "cycling",
    "gym",
    "reading",
    "music",
    "travel",
    "cricket",
    "badminton",
    "photography",
    "trekking",
    "cooking",
  ];

  const company = pick(companies, seed);
  const qualification = pick(qualifications, seed >>> 1);
  const hobby = pick(hobbies, seed >>> 2);

  const baseBio = String(bio || "").trim();
  const yourself = baseBio
    ? `${baseBio} Also enjoys ${hobby}.`
    : `Friendly and family-oriented. Also enjoys ${hobby}.`;

  const intro = baseBio || (profession ? `Works as a ${profession}.` : `Friendly and family-oriented.`);

  return { company, qualification, yourself, intro };
}

function parseMatchesFemaleCards(html) {
  const cards = [];
  const cardRegex = /<article\b[^>]*class=["'][^"']*\bcard\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi;

  let match;
  while ((match = cardRegex.exec(html))) {
    const segment = match[1] || "";

    const nameBlockMatch = segment.match(/<div\s+class=["']name["'][^>]*>([\s\S]*?)<\/div>/i);
    const nameBlock = nameBlockMatch ? nameBlockMatch[1] : "";
    const nameOnly = stripTags(nameBlock.split("<span")[0] || "");
    const slug = slugifyName(nameOnly);
    if (!nameOnly || !slug) continue;

    const ageMatch = segment.match(/<span\s+class=["']meta["'][^>]*>\s*•\s*(\d{1,2})\s*<\/span>/i);
    const age = ageMatch ? ageMatch[1] : "";

    const locMatch = segment.match(/<div\s+class=["']location["'][^>]*>([\s\S]*?)<\/div>/i);
    const location = stripTags(locMatch ? locMatch[1] : "");

    const profMatch = segment.match(/<div\s+class=["']profession["'][^>]*>([\s\S]*?)<\/div>/i);
    const profession = stripTags(profMatch ? profMatch[1] : "");

    const bioMatch = segment.match(/<p\s+class=["']bio["'][^>]*>([\s\S]*?)<\/p>/i);
    const bio = stripTags(bioMatch ? bioMatch[1] : "");

    const imgMatch = segment.match(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/i);
    const photoRaw = imgMatch ? imgMatch[1] : "";

    cards.push({
      slug,
      name: nameOnly,
      age,
      location,
      profession,
      bio,
      photoRaw,
    });
  }

  // De-dupe by slug (keep first)
  const bySlug = new Map();
  for (const c of cards) {
    if (!bySlug.has(c.slug)) bySlug.set(c.slug, c);
  }
  return Array.from(bySlug.values());
}

function buildProfileHtml({ name, username, photo1, photo2, photo3 }) {
  const safeName = name || "Profile";
  const safeUsername = username ? `@${username}` : "@user";
  const p1 = photo1 || "../Boysimage/pinterest1.jpeg";
  const p2 = photo2 || p1;
  const p3 = photo3 || p1;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Profile</title>
    <link rel="stylesheet" href="./profile.css" />
  </head>
  <body>
    <main class="profile-page">
      <section class="profile-card" id="profileCard">
        <div class="topbar">
          <div>
            <div class="ttl">Profile</div>
            <div class="subttl">Profile details</div>
          </div>
        </div>
        <div class="divider"></div>
        <div class="header">
          <div class="avatar"><img id="profileAvatar" src="${p1}" alt="Profile photo" /></div>
          <div class="nameLine">
            <div class="name">
              <span id="profileName">${safeName}</span>
              <span class="username" id="profileUsername">${safeUsername}</span>
            </div>
            <div class="subRow">
              <span>Gender:&nbsp; <b id="profileGender">Male</b></span>
              <span>Birthday:&nbsp; <b id="profileDob">—</b></span>
              <span style="display:inline-flex;align-items:center;gap:10px;">
                <span class="flag" id="profileCountryFlag" aria-hidden="true">🇮🇳</span>
                <b id="profileCountry">India</b>
              </span>
            </div>
            <div class="zodiacRow" id="profileZodiac">Zodiac: —</div>
          </div>
        </div>
        <div class="profile-gallery">
          <div class="gallery-title">Photo Gallery</div>
          <div class="gallery-grid">
            <div class="gallery-card">
              <img id="galleryLarge1" src="${p1}" alt="Gallery photo 1" />
            </div>
            <div class="gallery-card">
              <img id="galleryLarge2" src="${p2}" alt="Gallery photo 2" />
            </div>
            <div class="gallery-card">
              <img id="galleryLarge3" src="${p3}" alt="Gallery photo 3" />
            </div>
          </div>
        </div>
        <div class="rows">
          <div class="row locked">
            <div class="l">
              <div class="k">Religion</div>
              <div class="v" id="profileReligion">—</div>
            </div>
          </div>
          <div class="row locked">
            <div class="l">
              <div class="k">Marital Status</div>
              <div class="v" id="profileMarital">—</div>
            </div>
          </div>
          <div class="row">
            <div class="l">
              <div class="k">Company</div>
              <div class="v" id="profileCompany">—</div>
            </div>
          </div>
          <div class="row">
            <div class="l">
              <div class="k">Job / Profession</div>
              <div class="v" id="profileJob">—</div>
            </div>
          </div>
          <div class="row">
            <div class="l">
              <div class="k">Qualification</div>
              <div class="v" id="profileQualification">—</div>
            </div>
          </div>
          <div class="row likeRow">
            <div class="l">
              <div class="k">Popularity</div>
              <div class="v"><span class="likeCount" id="likeCount">0</span> Likes</div>
            </div>
            <button class="likeBtn" id="likeBtn" type="button" aria-label="Like profile">❤️ Like</button>
          </div>
          <div class="aboutRow">
            <div class="k">Hobby</div>
            <div class="v" id="profileHobby">—</div>
          </div>
        </div>
      </section>
    </main>
    <script type="module" src="./profile.js"></script>
  </body>
</html>
`;
}

function appendProfilesToDataset(datasetPath, newProfiles) {
  if (!newProfiles.length) return { added: 0 };
  const src = readFileUtf8(datasetPath);

  const exportIndex = src.indexOf("export const GIRLS");
  if (exportIndex === -1) {
    throw new Error(`Unable to find export marker in ${datasetPath}`);
  }

  const closeIndex = src.lastIndexOf("];", exportIndex);
  if (closeIndex === -1) {
    throw new Error(`Unable to find closing array marker before export in ${datasetPath}`);
  }

  const already = new Set();
  for (const p of newProfiles) {
    if (src.includes(`slug: "${p.slug}"`) || src.includes(`slug: '${p.slug}'`)) {
      already.add(p.slug);
    }
  }

  const toAdd = newProfiles.filter((p) => !already.has(p.slug));
  if (!toAdd.length) return { added: 0 };

  const blocks = toAdd
    .map((p) => {
      const birthday = computeBirthdayFromAge(p.age);
      const photo = normalizePhotoPathForDataset(p.photoRaw);
      const { company, qualification, yourself, intro } = buildRandomProfileFields(p.slug, p.profession, p.bio);
      const gallery = pickPhotos(p.slug, photo);

      return `  {\n` +
        `    slug: "${p.slug}",\n` +
        `    name: "${p.name.replace(/\"/g, "\\\"")}",\n` +
        `    username: "${p.slug}",\n` +
        `    intro: "${intro.replace(/\"/g, "\\\"")}",\n` +
        `    gender: "Male",\n` +
        (birthday ? `    birthday: "${birthday}",\n` : `    birthday: "",\n`) +
        `    country: "India",\n` +
        `    religion: "Hindu",\n` +
        `    maritalStatus: "Unmarried",\n` +
        `    company: "${String(company || "").replace(/\"/g, "\\\"")}",\n` +
        `    job: "${(p.profession || "").replace(/\"/g, "\\\"")}",\n` +
        `    qualification: "${String(qualification || "").replace(/\"/g, "\\\"")}",\n` +
        `    yourself: "${String(yourself || "").replace(/\"/g, "\\\"")}",\n` +
        `    photo: "${photo}",\n` +
        `    gallery: [\n` +
        gallery.map((g) => `      "${g}",\n`).join("") +
        `    ],\n` +
        `  },\n`;
    })
    .join("");

  const needsLeadingNewline = closeIndex > 0 && src[closeIndex - 1] !== "\n" && src[closeIndex - 1] !== "\r";
  const blocksOut = needsLeadingNewline ? `\n${blocks}` : blocks;
  const out = `${src.slice(0, closeIndex)}${blocksOut}${src.slice(closeIndex)}`;
  fs.writeFileSync(datasetPath, out, "utf8");
  return { added: toAdd.length };
}

function main() {
  const repoRoot = process.cwd();

  const matchesPath = path.join(repoRoot, "MatchesFemale.html");
  const boysDir = path.join(repoRoot, "30pagesofboys");
  const publicBoysDir = path.join(repoRoot, "public", "30pagesofboys");

  const datasetPath = path.join(repoRoot, "30pagesofboys", "girls-data.js");
  const publicDatasetPath = path.join(repoRoot, "public", "30pagesofboys", "girls-data.js");

  if (!fileExists(matchesPath)) throw new Error(`Missing ${matchesPath}`);
  if (!fileExists(boysDir)) throw new Error(`Missing ${boysDir}`);
  if (!fileExists(publicBoysDir)) throw new Error(`Missing ${publicBoysDir}`);
  if (!fileExists(datasetPath)) throw new Error(`Missing ${datasetPath}`);
  if (!fileExists(publicDatasetPath)) throw new Error(`Missing ${publicDatasetPath}`);

  const html = readFileUtf8(matchesPath);
  const cards = parseMatchesFemaleCards(html);

  const existing = listExistingProfileSlugs(boysDir);
  const missingPages = cards.filter((c) => !existing.has(c.slug));

  const rootDatasetSrc = readFileUtf8(datasetPath);
  const publicDatasetSrc = readFileUtf8(publicDatasetPath);
  const missingRootDataset = cards.filter((c) => !datasetHasSlug(rootDatasetSrc, c.slug));
  const missingPublicDataset = cards.filter((c) => !datasetHasSlug(publicDatasetSrc, c.slug));

  let created = 0;
  for (const c of missingPages) {
    const photo = normalizePhotoPathForDataset(c.photoRaw);
    const htmlOut = buildProfileHtml({
      name: c.name,
      username: c.slug,
      photo1: photo,
      photo2: photo,
      photo3: photo,
    });

    const outPath = path.join(boysDir, `${c.slug}.html`);
    const outPublicPath = path.join(publicBoysDir, `${c.slug}.html`);

    if (!fileExists(outPath)) {
      fs.writeFileSync(outPath, htmlOut, "utf8");
      created++;
    }
    if (!fileExists(outPublicPath)) {
      fs.writeFileSync(outPublicPath, htmlOut, "utf8");
    }
  }

  const added1 = appendProfilesToDataset(datasetPath, missingRootDataset).added;
  const added2 = appendProfilesToDataset(publicDatasetPath, missingPublicDataset).added;

  console.log(JSON.stringify({
    cardsFound: cards.length,
    existingProfiles: existing.size,
    missingProfiles: missingPages.length,
    profilePagesCreated: created,
    datasetEntriesAdded: { root: added1, public: added2 },
  }, null, 2));
}

main();
