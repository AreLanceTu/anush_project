// script.js/profile-sync.js
// Frontend helper: sync Firebase profile fields (name/username) from payment prefill data.
// Security note: do NOT store sensitive payment data here; only name/email is persisted.

import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { ref, get, update, runTransaction } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const PENDING_KEY = "vivah_paymentPrefill";
const FORCE_KEY = "vivah_paymentForceProfileSync";

export function setPendingPaymentPrefill({ name, email } = {}) {
  const fullName = (name || "").toString().trim();
  const emailStr = (email || "").toString().trim();
  if (!fullName && !emailStr) return false;

  const payload = {
    name: fullName,
    email: emailStr,
    ts: new Date().toISOString(),
  };

  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
  } catch {
    return false;
  }
  return true;
}

export function getPendingPaymentPrefill() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const name = (parsed?.name || "").toString().trim();
    const email = (parsed?.email || "").toString().trim();
    if (!name && !email) return null;
    return { name, email, ts: parsed?.ts };
  } catch {
    return null;
  }
}

export function clearPendingPaymentPrefill() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {}
}

export function usernameFromEmail(email) {
  const raw = (email || "").toString().trim();
  if (!raw || !raw.includes("@")) return "";
  const localPart = raw.split("@")[0] || "";
  const firstToken = (localPart.split(/[._-]+/).filter(Boolean)[0] || localPart).trim();
  const lower = firstToken.toLowerCase();

  let cleaned = lower.replace(/[^a-z0-9]/g, "");
  if (!cleaned) cleaned = "user";
  if (/^[0-9]/.test(cleaned)) cleaned = `u${cleaned}`;
  return cleaned.slice(0, 20);
}

async function getAuthedUserOrNull(auth, timeoutMs = 1500) {
  if (auth?.currentUser) return auth.currentUser;

  return await new Promise((resolve) => {
    let done = false;
    const finish = (u) => {
      if (done) return;
      done = true;
      resolve(u || null);
    };

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      try {
        unsubscribe?.();
      } catch {}
      finish(u);
    });

    window.setTimeout(() => {
      try {
        unsubscribe?.();
      } catch {}
      finish(auth?.currentUser || null);
    }, timeoutMs);
  });
}

async function reserveUniqueUsername(database, uid, base) {
  const start = (base || "").toString().trim().toLowerCase();
  const safeBase = start.replace(/[^a-z0-9]/g, "") || "user";
  const baseCandidate = (/^[0-9]/.test(safeBase) ? `u${safeBase}` : safeBase).slice(0, 20);

  const tryCandidate = async (candidate) => {
    const key = candidate.slice(0, 20);
    const usernameRef = ref(database, `usernames/${key}`);

    const tx = await runTransaction(
      usernameRef,
      (current) => {
        if (current === null || current === uid) return uid;
        return; // abort if taken
      },
      { applyLocally: false }
    );

    return tx.committed && tx.snapshot.val() === uid ? key : "";
  };

  for (let i = 0; i < 25; i++) {
    const candidate = i === 0 ? baseCandidate : `${baseCandidate}${i}`;
    const ok = await tryCandidate(candidate);
    if (ok) return ok;
  }

  for (let i = 0; i < 10; i++) {
    const suffix = Math.floor(Math.random() * 9000) + 1000;
    const ok = await tryCandidate(`${baseCandidate}${suffix}`);
    if (ok) return ok;
  }

  return "";
}

export async function applyPendingPaymentProfileSync({ auth, database, user = null } = {}) {
  const pending = getPendingPaymentPrefill();
  if (!pending) return { applied: false, reason: "no-pending" };

  const fullName = (pending.name || "").toString().trim();
  const email = (pending.email || "").toString().trim();

  const force = localStorage.getItem(FORCE_KEY) === "1";
  const previousName = localStorage.getItem("vivah_name") || "";
  const previousUsername = (localStorage.getItem("vivah_username") || "").replace(/^@+/, "");

  // Always set localStorage fields so UI can show something immediately.
  if (fullName) {
    try {
      localStorage.setItem("vivah_name", fullName);
    } catch {}
  }
  const baseUsername = usernameFromEmail(email);
  if (baseUsername) {
    try {
      localStorage.setItem("vivah_username", baseUsername);
    } catch {}
  }

  const authedUser = user || (await getAuthedUserOrNull(auth));
  if (!authedUser?.uid) {
    return { applied: false, reason: "no-auth" };
  }

  const uid = authedUser.uid;

  // Update Firebase Auth displayName (missing only).
  if (!authedUser.displayName && fullName) {
    await updateProfile(authedUser, { displayName: fullName });
  }

  // Update RTDB editprofile/{uid} (missing only).
  const profileRef = ref(database, "editprofile/" + uid);
  const snap = await get(profileRef);
  const existing = snap.exists() ? snap.val() || {} : {};

  const patch = {};
  if (fullName) {
    if (!existing.name) {
      patch.name = fullName;
    } else if (force && (!previousName || String(existing.name).trim() === String(previousName).trim())) {
      patch.name = fullName;
    }
  }

  if (baseUsername) {
    if (!existing.username) {
      const reserved = await reserveUniqueUsername(database, uid, baseUsername);
      if (reserved) patch.username = reserved;
    } else if (
      force &&
      (!previousUsername || String(existing.username).replace(/^@+/, "") === String(previousUsername).replace(/^@+/, ""))
    ) {
      const reserved = await reserveUniqueUsername(database, uid, baseUsername);
      if (reserved) patch.username = reserved;
    }
  }

  if (!snap.exists()) patch.createdAt = new Date().toISOString();

  if (Object.keys(patch).length) {
    patch.updatedAt = new Date().toISOString();
    await update(profileRef, patch);
  }

  // Only clear pending once we have an authenticated user and we attempted the write path.
  clearPendingPaymentPrefill();
  try {
    localStorage.removeItem(FORCE_KEY);
  } catch {}

  return { applied: true, patch };
}
