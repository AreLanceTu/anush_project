// Account photo system
// - Uploads DP and gallery photos to Cloudinary
// - Saves Cloudinary URLs to localStorage
// - Loads saved URLs on refresh and displays them

import { auth, database } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { ref, update, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { applyPendingPaymentProfileSync } from "./profile-sync.js";

const CLOUD_NAME = "dtd2miwrk";
const UPLOAD_PRESET = "vivahmatrimonial";

const STORAGE_KEYS = {
  dp: "dpUrl",
  gallery1: "photo1Url",
  gallery2: "photo2Url",
};

const PROFILE_KEYS = {
  firebaseUser: "firebaseUser",
  username: "vivah_username",
  name: "vivah_name",
  dob: "vivah_dob",
  country: "vivah_country",
  religion: "vivah_religion",
  marital: "vivah_marital",
  company: "vivah_company",
  job: "vivah_job",
  qualification: "vivah_qualification",
  gender: "vivah_gender",
  yourself: "vivah_yourself",
};

const els = {
  avatarBox: document.getElementById("avatarBox"),
  avatarImg: document.getElementById("avatarImg"),
  dpBtn: document.getElementById("dpBtn"),
  dpInput: document.getElementById("dpInput"),
  accPhoto1: document.getElementById("accPhoto1"),
  accPhoto2: document.getElementById("accPhoto2"),
  gallery1Input: document.getElementById("gallery1Input"),
  gallery2Input: document.getElementById("gallery2Input"),

  // Profile UI (merged from dummy.html)
  profileCard: document.getElementById("profileCard"),
  cancelBtn: document.getElementById("cancelBtn"),
  editBtn: document.getElementById("editBtn"),
  mainAvatar: document.getElementById("mainAvatar"),
  mainAvatarImg: document.getElementById("mainAvatarImg"),
  mainAvatarIcon: document.getElementById("mainAvatarIcon"),
  nameInput: document.getElementById("nameInput"),
  usernameInput: document.getElementById("usernameInput"),
  genderText: document.getElementById("genderText"),
  dobText: document.getElementById("dobText"),
  dobInput: document.getElementById("dobInput"),
  countryFlag: document.getElementById("countryFlag"),
  countryText: document.getElementById("countryText"),
  zodiacText: document.getElementById("zodiacText"),
  religionText: document.getElementById("religionText"),
  maritalText: document.getElementById("maritalText"),
  companyInput: document.getElementById("companyInput"),
  jobInput: document.getElementById("jobInput"),
  qualificationText: document.getElementById("qualificationText"),
  yourselfText: document.getElementById("yourselfText"),
  thumb1Box: document.getElementById("thumb1Box"),
  thumb1Img: document.getElementById("thumb1Img"),
  thumb2Box: document.getElementById("thumb2Box"),
  thumb2Img: document.getElementById("thumb2Img"),

  // Top-right dropdown (optional on this page, but required by spec)
  profileDropdown: document.getElementById("profileDropdown"),
  dropdownToggle: document.getElementById("dropdownToggle"),
  dropdownMenu: document.getElementById("dropdownMenu"),
  navbarProfileImg: document.getElementById("navbarProfileImg"),
  navbarProfileFallback: document.getElementById("navbarProfileFallback"),
  menuUserAvatar: document.getElementById("menuUserAvatar"),
  menuUserFallback: document.getElementById("menuUserFallback"),
  menuDisplayName: document.getElementById("menuDisplayName"),
  menuHandle: document.getElementById("menuHandle"),
};

let currentUser = null;

// Apply immediately (updates localStorage even if auth isn't ready yet).
applyPendingPaymentProfileSync({ auth, database }).catch(() => {});

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  if (currentUser?.uid) {
    applyPendingPaymentProfileSync({ auth, database, user: currentUser }).catch(() => {});
    fetchEditProfileFromFirebase();
  }
});

function setDp(url) {
  if (!els.avatarImg || !els.avatarBox) return;
  els.avatarImg.src = url;
  els.avatarBox.classList.add("has-photo");
}

function normalizeHandle(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  return v.startsWith("@") ? v : "@" + v;
}

function updateDropdownUI({ name, username, dpUrl }) {
  const displayName = String(name || "User").trim() || "User";
  const handle = normalizeHandle(username) || "@user";

  if (els.menuDisplayName) els.menuDisplayName.textContent = displayName;
  if (els.menuHandle) els.menuHandle.textContent = handle;

  const initial = (displayName || "U").trim().charAt(0).toUpperCase() || "U";
  if (els.menuUserFallback) els.menuUserFallback.textContent = initial;
  if (els.navbarProfileFallback) els.navbarProfileFallback.textContent = initial;

  if (dpUrl) {
    if (els.menuUserAvatar) {
      els.menuUserAvatar.src = dpUrl;
      els.menuUserAvatar.classList.add("show");
    }
    if (els.navbarProfileImg) {
      els.navbarProfileImg.src = dpUrl;
      els.navbarProfileImg.classList.add("show");
    }
    if (els.menuUserFallback) els.menuUserFallback.style.display = "none";
    if (els.navbarProfileFallback) els.navbarProfileFallback.style.display = "none";
  } else {
    if (els.menuUserAvatar) {
      els.menuUserAvatar.removeAttribute("src");
      els.menuUserAvatar.classList.remove("show");
    }
    if (els.navbarProfileImg) {
      els.navbarProfileImg.removeAttribute("src");
      els.navbarProfileImg.classList.remove("show");
    }
    if (els.menuUserFallback) els.menuUserFallback.style.display = "grid";
    if (els.navbarProfileFallback) els.navbarProfileFallback.style.display = "grid";
  }
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getDisplayName() {
  const fromLs = localStorage.getItem(PROFILE_KEYS.name);
  if (fromLs) return fromLs;
  const fb = safeJsonParse(localStorage.getItem(PROFILE_KEYS.firebaseUser));
  return fb?.displayName || "";
}

function getUsername() {
  const u = localStorage.getItem(PROFILE_KEYS.username);
  if (u) return "@" + u.replace(/^@+/, "");
  const fb = safeJsonParse(localStorage.getItem(PROFILE_KEYS.firebaseUser));
  const email = fb?.email || "";
  if (email.includes("@")) return "@" + email.split("@")[0];
  return "";
}

function setAvatar(container, imgEl, fallbackEl, url) {
  if (!container || !imgEl || !fallbackEl) return;
  if (url) {
    imgEl.src = url;
    container.classList.add("has-photo");
    fallbackEl.style.display = "none";
  } else {
    imgEl.removeAttribute("src");
    container.classList.remove("has-photo");
    fallbackEl.style.display = "block";
  }
}

function setThumb(boxEl, imgEl, url) {
  if (!boxEl || !imgEl) return;
  if (url) {
    imgEl.src = url;
    boxEl.style.display = "block";
  } else {
    imgEl.removeAttribute("src");
    boxEl.style.display = "none";
  }
}

function toFlagEmoji(iso2) {
  if (!iso2 || typeof iso2 !== "string" || iso2.length !== 2) return "🌍";
  const code = iso2.toUpperCase();
  const a = 0x1f1e6;
  const first = code.charCodeAt(0) - 65 + a;
  const second = code.charCodeAt(1) - 65 + a;
  return String.fromCodePoint(first, second);
}

async function resolveCountryFlag(countryName) {
  const name = (countryName || "").trim();
  if (!name) return "🌍";

  const cacheKey = "vivah_countryCodeCache_v2";
  const cache = safeJsonParse(localStorage.getItem(cacheKey)) || {};
  if (cache[name]) return toFlagEmoji(cache[name]);

  try {
    let res = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fullText=true`);
    if (!res.ok) res = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error("country lookup failed");
    const data = await res.json();
    const code = data?.[0]?.cca2;
    if (code && typeof code === "string") {
      cache[name] = code.toUpperCase();
      localStorage.setItem(cacheKey, JSON.stringify(cache));
      return toFlagEmoji(code);
    }
  } catch {
    // ignore
  }
  return "🌍";
}

function zodiacFromDob(dobValue) {
  if (!dobValue || typeof dobValue !== "string") return "";
  const parts = dobValue.split("-");
  if (parts.length !== 3) return "";
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!month || !day) return "";

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

  function isOnOrAfter(m, d, fm, fd) {
    return m > fm || (m === fm && d >= fd);
  }
  function isOnOrBefore(m, d, tm, td) {
    return m < tm || (m === tm && d <= td);
  }

  for (const z of zodiac) {
    const [fm, fd] = z.from;
    const [tm, td] = z.to;
    if (fm <= tm) {
      if (isOnOrAfter(month, day, fm, fd) && isOnOrBefore(month, day, tm, td)) return `${z.name} ${z.emoji}`;
    } else {
      if (isOnOrAfter(month, day, fm, fd) || isOnOrBefore(month, day, tm, td)) return `${z.name} ${z.emoji}`;
    }
  }
  return "";
}

function setZodiacFromDob(dob) {
  if (!els.zodiacText) return;
  const z = zodiacFromDob(dob);
  els.zodiacText.textContent = z ? `Zodiac: ${z}` : "Zodiac: —";
}

function loadProfileUi() {
  if (!els.profileCard) return;

  const dp = localStorage.getItem(STORAGE_KEYS.dp);
  const p1 = localStorage.getItem(STORAGE_KEYS.gallery1);
  const p2 = localStorage.getItem(STORAGE_KEYS.gallery2);

  // Thumbnails in sidebar
  setThumb(els.thumb1Box, els.thumb1Img, p1);
  setThumb(els.thumb2Box, els.thumb2Img, p2);

  // Main avatar mirrors DP
  if (els.mainAvatar && els.mainAvatarImg && els.mainAvatarIcon) {
    setAvatar(els.mainAvatar, els.mainAvatarImg, els.mainAvatarIcon, dp);
  }

  const currentName = getDisplayName();
  const currentUsername = getUsername();

  if (els.nameInput) els.nameInput.value = currentName;
  if (els.usernameInput) els.usernameInput.value = currentUsername;

  if (els.genderText) els.genderText.textContent = localStorage.getItem(PROFILE_KEYS.gender) || "—";

  const dob = localStorage.getItem(PROFILE_KEYS.dob) || "";
  if (els.dobText) els.dobText.textContent = dob || "—";
  if (els.dobInput) {
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(dob);
    els.dobInput.value = ok ? dob : "";
  }
  setZodiacFromDob(dob);

  const country = localStorage.getItem(PROFILE_KEYS.country) || localStorage.getItem("livingIn") || "";
  if (els.countryText) els.countryText.textContent = country || "—";
  if (els.countryFlag) {
    resolveCountryFlag(country)
      .then((flag) => {
        els.countryFlag.textContent = flag;
      })
      .catch(() => {
        els.countryFlag.textContent = "🌍";
      });
  }

  if (els.religionText) els.religionText.textContent = localStorage.getItem(PROFILE_KEYS.religion) || "—";
  if (els.maritalText) els.maritalText.textContent = localStorage.getItem(PROFILE_KEYS.marital) || "—";
  if (els.companyInput) els.companyInput.value = localStorage.getItem(PROFILE_KEYS.company) || "";
  if (els.jobInput) els.jobInput.value = localStorage.getItem(PROFILE_KEYS.job) || "";
  if (els.qualificationText) els.qualificationText.textContent = localStorage.getItem(PROFILE_KEYS.qualification) || "—";
  if (els.yourselfText) els.yourselfText.value = localStorage.getItem(PROFILE_KEYS.yourself) || "";

  updateDropdownUI({
    name: currentName,
    username: currentUsername,
    dpUrl: dp,
  });
}

let editing = false;
let snapshot = { name: "", username: "", company: "", job: "", yourself: "", dob: "" };

function setUploadAccess({ dpEnabled, galleryEnabled }) {
  const allowDp = Boolean(dpEnabled);
  const allowGallery = Boolean(galleryEnabled);

  if (els.dpBtn) els.dpBtn.disabled = !allowDp;
  if (els.dpInput) els.dpInput.disabled = !allowDp;
  if (els.avatarBox) els.avatarBox.classList.toggle("uploadLocked", !allowDp);

  if (els.accPhoto1) els.accPhoto1.classList.toggle("uploadLocked", !allowGallery);
  if (els.accPhoto2) els.accPhoto2.classList.toggle("uploadLocked", !allowGallery);
  if (els.gallery1Input) els.gallery1Input.disabled = !allowGallery;
  if (els.gallery2Input) els.gallery2Input.disabled = !allowGallery;
}

function setEditing(next) {
  editing = Boolean(next);
  if (els.profileCard) els.profileCard.classList.toggle("isEditing", editing);
  if (els.cancelBtn) els.cancelBtn.style.display = editing ? "inline-flex" : "none";
  if (els.editBtn) {
    els.editBtn.textContent = editing ? "Save Changes" : "Edit Profile";
    els.editBtn.classList.toggle("is-saving", editing);
  }

  // Allow uploads only during edit mode
  setUploadAccess({ dpEnabled: editing, galleryEnabled: editing });

  if (els.nameInput) els.nameInput.readOnly = !editing;
  if (els.usernameInput) els.usernameInput.readOnly = !editing;
  if (els.companyInput) els.companyInput.readOnly = !editing;
  if (els.jobInput) els.jobInput.readOnly = !editing;
  if (els.yourselfText) els.yourselfText.readOnly = !editing;

  if (els.dobInput) {
    els.dobInput.disabled = !editing;
    els.dobInput.style.display = editing ? "inline-block" : "none";
  }
  if (els.dobText) {
    els.dobText.style.display = editing ? "none" : "inline";
  }

  if (editing && els.nameInput) {
    els.nameInput.focus();
    els.nameInput.select();
  }
}

function beginEdit() {
  snapshot = {
    name: els.nameInput?.value || "",
    username: els.usernameInput?.value || "",
    company: els.companyInput?.value || "",
    job: els.jobInput?.value || "",
    yourself: els.yourselfText?.value || "",
    dob: els.dobInput?.value || localStorage.getItem(PROFILE_KEYS.dob) || "",
  };
  setEditing(true);
}

function cancelEdit() {
  if (els.nameInput) els.nameInput.value = snapshot.name;
  if (els.usernameInput) els.usernameInput.value = snapshot.username;
  if (els.companyInput) els.companyInput.value = snapshot.company;
  if (els.jobInput) els.jobInput.value = snapshot.job;
  if (els.yourselfText) els.yourselfText.value = snapshot.yourself;
  if (els.dobInput) els.dobInput.value = snapshot.dob;
  setEditing(false);
  setZodiacFromDob(snapshot.dob);
  updateDropdownUI({
    name: snapshot.name,
    username: snapshot.username,
    dpUrl: localStorage.getItem(STORAGE_KEYS.dp),
  });
}

async function saveProfileToFirebase(payload) {
  if (!currentUser?.uid) return;
  await update(ref(database, "editprofile/" + currentUser.uid), payload);
}

async function fetchEditProfileFromFirebase() {
  if (!currentUser?.uid) return;
  try {
    const snap = await get(ref(database, "editprofile/" + currentUser.uid));
    if (!snap.exists()) return;
    if (editing) return;

    const data = snap.val() || {};
    const name = typeof data.name === "string" ? data.name : "";
    const username = typeof data.username === "string" ? data.username : "";
    const dob = typeof data.dob === "string" ? data.dob : "";
    const country = typeof data.country === "string" ? data.country : "";
    const religion = typeof data.religion === "string" ? data.religion : "";
    const marital = typeof data.marital === "string" ? data.marital : "";
    const qualification = typeof data.qualification === "string" ? data.qualification : "";
    const genderRaw = typeof data.gender === "string" ? data.gender : "";
    const company = typeof data.company === "string" ? data.company : "";
    const job = typeof data.job === "string" ? data.job : "";
    const aboutYourself = typeof data.aboutYourself === "string" ? data.aboutYourself : "";

    const gender = String(genderRaw || "").trim().toLowerCase() === "male" ? "Men" : String(genderRaw || "").trim().toLowerCase() === "female" ? "Women" : String(genderRaw || "").trim();

    if (typeof name === "string") localStorage.setItem(PROFILE_KEYS.name, name);
    if (typeof username === "string") localStorage.setItem(PROFILE_KEYS.username, username.replace(/^@+/, ""));
    if (typeof dob === "string") localStorage.setItem(PROFILE_KEYS.dob, dob);
    if (typeof country === "string") {
      localStorage.setItem(PROFILE_KEYS.country, country);
      localStorage.setItem("livingIn", country);
    }
    if (typeof religion === "string") localStorage.setItem(PROFILE_KEYS.religion, religion);
    if (typeof marital === "string") localStorage.setItem(PROFILE_KEYS.marital, marital);
    if (typeof qualification === "string") localStorage.setItem(PROFILE_KEYS.qualification, qualification);
    if (gender) localStorage.setItem(PROFILE_KEYS.gender, gender);
    if (typeof company === "string") localStorage.setItem(PROFILE_KEYS.company, company);
    if (typeof job === "string") localStorage.setItem(PROFILE_KEYS.job, job);
    if (typeof aboutYourself === "string") localStorage.setItem(PROFILE_KEYS.yourself, aboutYourself);

    loadProfileUi();
  } catch (e) {
    console.error(e);
  }
}

async function saveEdit() {
  const nextName = (els.nameInput?.value || "").trim();
  const nextUsername = (els.usernameInput?.value || "").trim();
  if (!nextName || !nextUsername) {
    alert("Name and Username cannot be empty");
    return;
  }

  localStorage.setItem(PROFILE_KEYS.name, nextName);
  localStorage.setItem(PROFILE_KEYS.username, nextUsername.replace(/^@+/, ""));

  const nextCompany = (els.companyInput?.value || "").trim();
  localStorage.setItem(PROFILE_KEYS.company, nextCompany);

  const nextJob = (els.jobInput?.value || "").trim();
  localStorage.setItem(PROFILE_KEYS.job, nextJob);

  const nextYourself = (els.yourselfText?.value || "").trim();
  localStorage.setItem(PROFILE_KEYS.yourself, nextYourself);

  const nextDob = (els.dobInput?.value || "").trim();
  if (nextDob) localStorage.setItem(PROFILE_KEYS.dob, nextDob);

  const firebasePayload = {
    name: nextName,
    username: nextUsername.replace(/^@+/, ""),
    dob: nextDob || "",
    company: nextCompany,
    job: nextJob,
    aboutYourself: nextYourself,
    updatedAt: new Date().toISOString(),
  };

  try {
    await saveProfileToFirebase(firebasePayload);
  } catch (e) {
    console.error(e);
    alert("Saved locally, but Firebase save failed");
  }

  setEditing(false);
  loadProfileUi();

  // Immediate dropdown update (no refresh)
  updateDropdownUI({
    name: nextName,
    username: nextUsername,
    dpUrl: localStorage.getItem(STORAGE_KEYS.dp),
  });
}

function wireProfileUi() {
  if (!els.profileCard || !els.editBtn) return;

  els.editBtn.addEventListener("click", () => {
    if (!editing) beginEdit();
    else saveEdit();
  });
  els.cancelBtn?.addEventListener("click", cancelEdit);

  document.addEventListener("keydown", (e) => {
    if (!editing) return;
    if (e.key === "Escape") cancelEdit();
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveEdit();
      return;
    }
    if (e.key === "Enter") {
      const target = e.target;
      const tag = (target?.tagName || "").toLowerCase();
      const type = (target?.getAttribute?.("type") || "").toLowerCase();
      if (tag === "textarea") return;
      if (tag === "input" && type === "date") return;
      e.preventDefault();
      saveEdit();
    }
  });

  els.dobInput?.addEventListener("change", () => {
    if (!editing) return;
    setZodiacFromDob(els.dobInput.value);
  });

  // Live dropdown preview while editing name/username
  els.nameInput?.addEventListener("input", () => {
    if (!editing) return;
    updateDropdownUI({
      name: els.nameInput.value,
      username: els.usernameInput?.value,
      dpUrl: localStorage.getItem(STORAGE_KEYS.dp),
    });
  });
  els.usernameInput?.addEventListener("input", () => {
    if (!editing) return;
    updateDropdownUI({
      name: els.nameInput?.value,
      username: els.usernameInput.value,
      dpUrl: localStorage.getItem(STORAGE_KEYS.dp),
    });
  });

  // Dropdown open/close
  if (els.profileDropdown && els.dropdownToggle && els.dropdownMenu) {
    els.dropdownToggle.addEventListener("click", () => {
      const isOpen = els.profileDropdown.classList.toggle("open");
      els.dropdownToggle.setAttribute("aria-expanded", String(isOpen));
    });

    document.addEventListener("click", (e) => {
      if (!els.profileDropdown.classList.contains("open")) return;
      if (els.profileDropdown.contains(e.target)) return;
      els.profileDropdown.classList.remove("open");
      els.dropdownToggle.setAttribute("aria-expanded", "false");
    });
  }
}

function setGallery(imgEl, url) {
  if (!imgEl) return;
  imgEl.src = url;
}

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok || !data?.secure_url) {
    throw new Error(data?.error?.message || "Cloudinary upload failed");
  }

  return data.secure_url;
}

function pickFile(inputEl) {
  if (!inputEl || inputEl.disabled) return;
  inputEl.click();
}

function wireUpload({ inputEl, storageKey, onUrl }) {
  if (!inputEl) return;

  inputEl.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadToCloudinary(file);
      localStorage.setItem(storageKey, url);
      onUrl(url);
    } catch (err) {
      console.error(err);
      alert("Upload Failed");
    } finally {
      // allow choosing the same file again
      inputEl.value = "";
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  // Load saved URLs on refresh
  const savedDp = localStorage.getItem(STORAGE_KEYS.dp);
  if (savedDp) setDp(savedDp);
  else if (els.avatarImg) els.avatarImg.src = "images/userlogo1.jpeg";

  const saved1 = localStorage.getItem(STORAGE_KEYS.gallery1);
  if (saved1) setGallery(els.accPhoto1, saved1);

  const saved2 = localStorage.getItem(STORAGE_KEYS.gallery2);
  if (saved2) setGallery(els.accPhoto2, saved2);

  // Click handlers
  if (els.dpBtn) els.dpBtn.addEventListener("click", () => pickFile(els.dpInput));
  if (els.avatarBox) els.avatarBox.addEventListener("click", () => pickFile(els.dpInput));
  if (els.accPhoto1) els.accPhoto1.addEventListener("click", () => pickFile(els.gallery1Input));
  if (els.accPhoto2) els.accPhoto2.addEventListener("click", () => pickFile(els.gallery2Input));

  // Upload wiring (kept separate)
  wireUpload({
    inputEl: els.dpInput,
    storageKey: STORAGE_KEYS.dp,
    onUrl: (url) => setDp(url),
  });

  wireUpload({
    inputEl: els.gallery1Input,
    storageKey: STORAGE_KEYS.gallery1,
    onUrl: (url) => setGallery(els.accPhoto1, url),
  });

  wireUpload({
    inputEl: els.gallery2Input,
    storageKey: STORAGE_KEYS.gallery2,
    onUrl: (url) => setGallery(els.accPhoto2, url),
  });

  loadProfileUi();
  wireProfileUi();

  // Locked until user clicks Edit Profile
  setUploadAccess({ dpEnabled: false, galleryEnabled: false });
});
