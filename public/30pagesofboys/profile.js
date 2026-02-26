import { getGirlBySlug } from "./girls-data.js";
import { bindLikeButton, listenForLikeChanges } from "../script.js/likes.js";

function slugFromLocation() {
  const file = (location.pathname.split("/").pop() || "").toLowerCase();
  if (file.endsWith(".html")) return file.slice(0, -5);
  return file;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value ?? "—";
}

function zodiacFromDob(dob) {
  if (!dob) return "Zodiac: —";
  const parts = String(dob).split("-");
  if (parts.length !== 3) return "Zodiac: —";
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!month || !day) return "Zodiac: —";

  const zodiac = [
    { name: "Capricorn", emoji: "♑", from: [12, 22], to: [1, 19] },
    { name: "Aquarius", emoji: "♒", from: [1, 20], to: [2, 18] },
    { name: "Pisces", emoji: "♓", from: [2, 19], to: [3, 20] },
    { name: "Aries", emoji: "♈", from: [3, 21], to: [4, 19] },
    { name: "Taurus", emoji: "♉", from: [4, 20], to: [5, 20] },
    { name: "Gemini", emoji: "♊", from: [5, 21], to: [6, 20] },
    { name: "Cancer", emoji: "♋", from: [6, 21], to: [7, 22] },
    { name: "Leo", emoji: "♌", from: [7, 23], to: [8, 22] },
    { name: "Virgo", emoji: "♍", from: [8, 23], to: [9, 22] },
    { name: "Libra", emoji: "♎", from: [9, 23], to: [10, 22] },
    { name: "Scorpio", emoji: "♏", from: [10, 23], to: [11, 21] },
    { name: "Sagittarius", emoji: "♐", from: [11, 22], to: [12, 21] },
  ];

  const isOnOrAfter = (m, d, fm, fd) => m > fm || (m === fm && d >= fd);
  const isOnOrBefore = (m, d, tm, td) => m < tm || (m === tm && d <= td);

  for (const z of zodiac) {
    const [fm, fd] = z.from;
    const [tm, td] = z.to;
    if (fm <= tm) {
      if (isOnOrAfter(month, day, fm, fd) && isOnOrBefore(month, day, tm, td)) return `Zodiac: ${z.name} ${z.emoji}`;
    } else {
      if (isOnOrAfter(month, day, fm, fd) || isOnOrBefore(month, day, tm, td)) return `Zodiac: ${z.name} ${z.emoji}`;
    }
  }

  return "Zodiac: —";
}

function ageFromDob(dob) {
  if (!dob) return null;
  const parts = String(dob).split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return null;

  const now = new Date();
  const birth = new Date(year, month - 1, day);
  if (Number.isNaN(birth.getTime())) return null;

  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  if (age < 0 || age > 120) return null;
  return age;
}

function formatDobWithAge(dob) {
  const raw = String(dob || "").trim();
  if (!raw || raw === "—") return "—";
  const age = ageFromDob(raw);
  if (!Number.isFinite(age)) return raw;
  return `${raw} (${age})`;
}

function countryFlag(country) {
  const c = String(country || "").trim().toLowerCase();
  if (!c) return "🌍";
  if (c === "india") return "🇮🇳";
  return "🌍";
}

function buildDummyUsername(girl, slug) {
  const raw = String(girl?.username || slug || "user").toLowerCase();
  const clean = raw.replace(/[^a-z0-9]+/g, "").trim();
  return `example-${clean || "user"}`;
}

function init() {
  const slug = slugFromLocation();
  const girl = getGirlBySlug(slug);

  if (!girl) {
    document.title = "Profile";
    setText("profileName", "Profile Not Found");
    return;
  }

  const container = document.querySelector(".profile-page") || document.body;
  if (container && container.classList) {
    container.classList.add("app");
  }

  const profileCard = document.getElementById("profileCard");
  if (profileCard && !profileCard.closest(".main")) {
    const main = document.createElement("div");
    main.className = "main";
    profileCard.parentNode?.insertBefore(main, profileCard);
    main.appendChild(profileCard);
  }

  if (container && !container.querySelector(".sidebar")) {
    const sidebar = document.createElement("aside");
    sidebar.className = "sidebar";
    sidebar.innerHTML = `
      <div class="card pad">
        <div class="cardTitle">My Account</div>
        <div class="meRow">
          <div id="avatarBox">
            <img id="avatarImg" alt="Profile photo" />
          </div>
          <div class="meMeta">
            <div class="sidebarLabel" id="sidebarName">—</div>
            <div class="hint" id="sidebarUsername">@user</div>
          </div>
        </div>
        <div class="thumbGrid" id="galleryThumbs">
          <img class="thumbPhoto" id="galleryThumb1" alt="Photo 1" />
          <img class="thumbPhoto" id="galleryThumb2" alt="Photo 2" />
        </div>
      </div>
    `;
    container.prepend(sidebar);
  }

  const rows = document.querySelector(".rows");
  if (rows) {
    const religionRow = document.getElementById("profileReligion")?.closest(".row");
    const maritalRow = document.getElementById("profileMarital")?.closest(".row");
    const companyRow = document.getElementById("profileCompany")?.closest(".row");
    const jobRow = document.getElementById("profileJob")?.closest(".row");
    const qualificationRow = document.getElementById("profileQualification")?.closest(".row");
    const aboutRow = document.querySelector(".aboutRow");
    const likeRow = document.querySelector(".likeRow");

    const lockIcon = `
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
    `;

    const chevronIcon = `
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    `;

    const markRow = (row, type) => {
      if (!row) return;
      row.classList.remove("locked", "editable");
      row.classList.add(type);
      if (!row.querySelector(".icon")) {
        row.insertAdjacentHTML("beforeend", type === "locked" ? lockIcon : chevronIcon);
      }
    };

    markRow(religionRow, "locked");
    markRow(maritalRow, "locked");
    markRow(companyRow, "editable");
    markRow(jobRow, "editable");
    markRow(qualificationRow, "editable");

    [religionRow, maritalRow, companyRow, jobRow, qualificationRow, aboutRow, likeRow]
      .filter(Boolean)
      .forEach((row) => rows.appendChild(row));

    const aboutLabel = aboutRow?.querySelector(".k");
    if (aboutLabel) aboutLabel.textContent = "Yourself / About Me";
  }

  document.title = girl.name;

  const params = new URLSearchParams(window.location.search);
  const passedPhoto = params.get("photo");
  const normalizedPhoto = passedPhoto && /^(GirlsImage|Boysimage)\//i.test(passedPhoto)
    ? `../${passedPhoto}`
    : passedPhoto;
  const mainPhoto = normalizedPhoto || girl.profilePhoto || girl.photo || "";

  const avatar = document.getElementById("profileAvatar");
  if (avatar) {
    avatar.src = mainPhoto;
    avatar.closest(".avatar")?.classList.toggle("has-photo", Boolean(mainPhoto));
  }

  const sidebarAvatar = document.getElementById("avatarImg");
  if (sidebarAvatar) {
    sidebarAvatar.src = mainPhoto;
    sidebarAvatar.closest("#avatarBox")?.classList.toggle("has-photo", Boolean(mainPhoto));
  }

  const gallery = Array.isArray(girl.gallery) ? girl.gallery : [];
  const g1 = document.getElementById("galleryThumb1");
  const g2 = document.getElementById("galleryThumb2");
  const largeIds = ["galleryLarge1", "galleryLarge2", "galleryLarge3"];
  if (g1) {
    if (gallery[0]) {
      g1.src = gallery[0];
      g1.style.display = "block";
    } else {
      g1.style.display = "none";
    }
  }
  if (g2) {
    if (gallery[1]) {
      g2.src = gallery[1];
      g2.style.display = "block";
    } else {
      g2.style.display = "none";
    }
  }
  largeIds.forEach((id, idx) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (gallery[idx]) {
      el.src = gallery[idx];
      el.style.display = "block";
    } else {
      el.style.display = "none";
    }
  });

  setText("profileName", girl.name);
  setText("profileUsername", girl.username ? `@${girl.username}` : "@user");
  setText("sidebarName", girl.name || "—");
  setText("sidebarUsername", girl.username ? `@${girl.username}` : "@user");
  setText("profileGender", girl.gender || "Male");
  setText("profileDob", formatDobWithAge(girl.birthday));
  setText("profileCountryFlag", countryFlag(girl.country));
  setText("profileCountry", girl.country || "—");
  // Dynamically calculate and display Zodiac sign
  setText("profileZodiac", zodiacFromDob(girl.birthday));
  setText("profileReligion", girl.religion || "—");
  setText("profileMarital", girl.maritalStatus || "—");
  setText("profileJob", girl.job || "—");
  setText("profileQualification", girl.qualification || "—");
  setText("profileCompany", girl.company || "—");
  setText("profileHobby", girl.yourself || girl.hobby || "—");

  // Small chat button next to @username
  const nameRow = document.querySelector(".nameLine .name");
  if (nameRow && !nameRow.querySelector(".profileChatBtn")) {
    const chatLink = document.createElement("a");
    chatLink.className = "profileChatBtn";
    const to = buildDummyUsername(girl, slug);
    const chatParams = new URLSearchParams({
      to,
      name: girl.name || to,
    });
    chatLink.href = `../Chat.html?${chatParams.toString()}`;
    chatLink.setAttribute("aria-label", "Open chats");
    chatLink.title = "Chats";
    chatLink.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        <path d="M8 9h8" />
        <path d="M8 13h6" />
      </svg>
    `;
    nameRow.appendChild(chatLink);
  }

  const likeBtn = document.getElementById("likeBtn");
  const likeCount = document.getElementById("likeCount");
  const update = bindLikeButton(likeBtn, likeCount, slug);
  listenForLikeChanges((changed) => {
    if (changed === slug) update();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
