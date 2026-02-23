const fs = require("fs");

const html = fs.readFileSync("Matches.html", "utf8");

// Extracts the avatar alt label (used as the girl's first name in this file)
// and the age number shown in the meta span.
const re = /<img[^>]*\salt="([^"]+)"[^>]*>[\s\S]*?<span class="meta">\s*•\s*(\d+)\s*<\/span>/g;

const map = {};
let match;
while ((match = re.exec(html))) {
  const label = String(match[1] || "").trim();
  const age = Number(match[2]);
  if (!label || label.toLowerCase() === "user") continue;
  if (Number.isFinite(age)) map[label] = age;
}

console.log("count=", Object.keys(map).length);
console.log(JSON.stringify(map, null, 2));
