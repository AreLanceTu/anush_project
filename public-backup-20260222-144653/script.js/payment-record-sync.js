import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { ref, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getAuthedUserOrNull(auth, timeoutMs = 1200) {
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
      } catch {
        // ignore
      }
      finish(u);
    });

    window.setTimeout(() => {
      try {
        unsubscribe?.();
      } catch {
        // ignore
      }
      finish(auth?.currentUser || null);
    }, timeoutMs);
  });
}

export async function applyPendingPaymentRecordSync({ auth, database }) {
  let raw = "";
  try {
    raw = localStorage.getItem("vivah_pendingPaymentRecord_v1") || "";
  } catch {
    raw = "";
  }
  if (!raw) return;

  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return;
  }
  if (!record || typeof record !== "object") return;

  const user = await getAuthedUserOrNull(auth, 1800);
  if (!user?.uid) return;

  const uid = user.uid;
  const paymentId = String(record?.razorpay?.paymentId || "");
  const safeKey = /^[A-Za-z0-9_-]+$/.test(paymentId) ? paymentId : "";

  const perUserBase = ref(database, `payments/${uid}`);
  const perUserRef = safeKey ? ref(database, `payments/${uid}/${safeKey}`) : push(perUserBase);

  const bucketBase = ref(database, `paymentBucket`);
  const bucketRef = safeKey ? ref(database, `paymentBucket/${safeKey}`) : push(bucketBase);

  await Promise.race([
    Promise.all([
      set(perUserRef, { ...record, uid, createdAtServer: serverTimestamp() }),
      set(bucketRef, { ...record, uid, createdAtServer: serverTimestamp() }),
    ]),
    sleep(1800),
  ]);

  try {
    localStorage.removeItem("vivah_pendingPaymentRecord_v1");
  } catch {
    // ignore
  }
}
