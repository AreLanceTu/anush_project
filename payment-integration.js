// payment-integration.js (browser compatible)
// Use window.supabaseClient for Supabase
// Use window.Razorpay for Razorpay

// Example: Start Razorpay payment
// successRedirectUrl: where to go after successful payment (default: PartnerSelection.html)
async function startPayment({ amount, plan, name, email, phone, successRedirectUrl }) {
  // IMPORTANT (security): do not store sensitive payment data client-side.
  // We only use Razorpay *prefill* values (name/email) to update the user's Firebase profile.

  // Assumes Razorpay SDK is loaded globally
  const options = {
    key: 'rzp_test_S4X9wjnzOxiIvw', // Replace with your Razorpay Key ID
    amount: amount * 100, // in paise
    currency: 'INR',
    name: 'Vivah Premium Membership',
    description: 'Premium Membership Payment',
    notes: {
      plan: (plan || '').toString(),
      amount: String(amount ?? ''),
    },
    handler: function (response) {
      (async () => {
        // Persist prefill immediately so later pages can sync even if Auth isn't ready yet.
        try {
          const payload = {
            name: (options.prefill?.name || '').toString().trim(),
            email: (options.prefill?.email || '').toString().trim(),
            ts: new Date().toISOString(),
          };
          if (payload.name || payload.email) {
            localStorage.setItem('vivah_paymentPrefill', JSON.stringify(payload));
            localStorage.setItem('vivah_paymentForceProfileSync', '1');
          }
        } catch {
          // ignore
        }

        // Save payment record to Firebase RTDB (best-effort).
        await savePaymentToFirebaseRTDB({
          plan,
          amount,
          currency: 'INR',
          prefill: options.prefill,
          razorpay: {
            paymentId: response?.razorpay_payment_id || '',
            orderId: response?.razorpay_order_id || '',
            signature: response?.razorpay_signature || '',
          },
        });

        // Razorpay response contains IDs (payment_id/order_id/signature).
        // For client-side profile sync, we only use the prefill name/email we sent.
        await syncFirebaseProfileFromRazorpayPrefill(options.prefill);
      })()
        .catch((e) => console.warn('Post-payment actions skipped:', e))
        .finally(() => {
          alert('Payment successful! Payment ID: ' + response.razorpay_payment_id);
          window.location.href = (successRedirectUrl || 'PartnerSelection.html');
        });
    },
    prefill: {
      name: name,
      email: email,
      contact: phone
    },
    theme: {
      color: '#E34450'
    }
  };
  const rzp = new window.Razorpay(options);
  rzp.open();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function savePaymentToFirebaseRTDB({ plan, amount, currency, prefill, razorpay }) {
  const record = {
    plan: (plan || '').toString() || null,
    amount: Number(amount) || 0,
    currency: (currency || 'INR').toString(),
    customer: {
      name: (prefill?.name || '').toString().trim() || null,
      email: (prefill?.email || '').toString().trim() || null,
      phone: (prefill?.contact || '').toString().trim() || null,
    },
    razorpay: {
      paymentId: (razorpay?.paymentId || '').toString(),
      orderId: (razorpay?.orderId || '').toString(),
      signature: (razorpay?.signature || '').toString(),
    },
    status: 'success',
    page: (typeof location !== 'undefined' ? location.href : ''),
    createdAt: new Date().toISOString(),
  };

  // Save pending payload so PartnerSelection can upload if auth isn't ready.
  try {
    localStorage.setItem('vivah_pendingPaymentRecord_v1', JSON.stringify(record));
  } catch {
    // ignore
  }

  // Persist membership plan locally so feature-gated pages can check access.
  // Note: this is client-side convenience only (not secure enforcement).
  try {
    const membership = {
      plan: record.plan,
      amount: record.amount,
      currency: record.currency,
      status: record.status,
      paymentId: record?.razorpay?.paymentId || null,
      createdAt: record.createdAt,
    };
    localStorage.setItem('vivah_membership_v1', JSON.stringify(membership));
    localStorage.setItem('vivah_membership_plan', String(record.plan || ''));
  } catch {
    // ignore
  }

  // Try immediate upload (best-effort) if user is authenticated.
  try {
    const [{ auth, database }, authMod, dbMod] = await Promise.all([
      import('./firebase-config.js'),
      import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js'),
    ]);

    const { onAuthStateChanged } = authMod;
    const { ref, push, set, serverTimestamp } = dbMod;

    const user = await getAuthedUserOrNull(auth, onAuthStateChanged, 1200);
    if (!user?.uid) return;

    const uid = user.uid;
    const paymentId = record.razorpay.paymentId;
    const safeKey = /^[A-Za-z0-9_-]+$/.test(paymentId || '') ? paymentId : '';
    const perUserBase = ref(database, `payments/${uid}`);
    const perUserRef = safeKey ? ref(database, `payments/${uid}/${safeKey}`) : push(perUserBase);

    const bucketBase = ref(database, `paymentBucket`);
    const bucketRef = safeKey ? ref(database, `paymentBucket/${safeKey}`) : push(bucketBase);

    const membershipRef = ref(database, `users/${uid}/membership`);
    const membershipPayload = {
      plan: record.plan,
      amount: record.amount,
      currency: record.currency,
      status: record.status,
      paymentId: record.razorpay.paymentId,
      createdAt: record.createdAt,
      updatedAt: new Date().toISOString(),
      updatedAtServer: serverTimestamp(),
    };

    await Promise.race([
      Promise.all([
        set(perUserRef, { ...record, uid, createdAtServer: serverTimestamp() }),
        set(bucketRef, { ...record, uid, createdAtServer: serverTimestamp() }),
        set(membershipRef, membershipPayload),
      ]),
      sleep(1800),
    ]);

    // Only clear pending marker if we successfully wrote.
    try {
      localStorage.removeItem('vivah_pendingPaymentRecord_v1');
    } catch {
      // ignore
    }
  } catch (e) {
    console.warn('Payment RTDB write failed:', e);
  }
}

// --- Firebase profile sync helpers (FRONTEND) ---
// Runs in the browser after successful payment.
// Backend note: Payment signature verification must be done on your server.

function usernameFromEmail(email) {
  const raw = (email || '').toString().trim();
  if (!raw || !raw.includes('@')) return '';
  const localPart = raw.split('@')[0] || '';
  // Take the first token (john.doe -> john, john_doe -> john)
  const firstToken = (localPart.split(/[._-]+/).filter(Boolean)[0] || localPart).trim();
  const lower = firstToken.toLowerCase();
  // Keep only a-z and 0-9
  let cleaned = lower.replace(/[^a-z0-9]/g, '');
  if (!cleaned) cleaned = 'user';
  // Avoid usernames that start with a number
  if (/^[0-9]/.test(cleaned)) cleaned = `u${cleaned}`;
  return cleaned.slice(0, 20);
}

async function getAuthedUserOrNull(auth, onAuthStateChanged, timeoutMs = 1200) {
  if (auth?.currentUser) return auth.currentUser;
  return await new Promise((resolve) => {
    let done = false;
    const finish = (u) => {
      if (done) return;
      done = true;
      resolve(u || null);
    };

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      try { unsubscribe?.(); } catch {}
      finish(u);
    });

    window.setTimeout(() => {
      try { unsubscribe?.(); } catch {}
      finish(auth?.currentUser || null);
    }, timeoutMs);
  });
}

async function reserveUniqueUsername({ database, ref, runTransaction, uid, base }) {
  const start = (base || '').toString().trim().toLowerCase();
  const safeBase = start.replace(/[^a-z0-9]/g, '') || 'user';
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
    return tx.committed && tx.snapshot.val() === uid ? key : '';
  };

  // Deterministic attempts first: john, john1, john2...
  const MAX_TRIES = 25;
  for (let i = 0; i < MAX_TRIES; i++) {
    const candidate = i === 0 ? baseCandidate : `${baseCandidate}${i}`;
    const ok = await tryCandidate(candidate);
    if (ok) return ok;
  }

  // Random fallback
  for (let i = 0; i < 10; i++) {
    const suffix = Math.floor(Math.random() * 9000) + 1000;
    const ok = await tryCandidate(`${baseCandidate}${suffix}`);
    if (ok) return ok;
  }

  return '';
}

async function syncFirebaseProfileFromRazorpayPrefill(prefill) {
  const fullName = (prefill?.name || '').toString().trim();
  const email = (prefill?.email || '').toString().trim();
  if (!fullName && !email) return;

  // Keep UI consistent (used by navbar dropdown in other pages)
  if (fullName) localStorage.setItem('vivah_name', fullName);

  const baseUsername = usernameFromEmail(email);
  if (baseUsername) localStorage.setItem('vivah_username', baseUsername);

  // Dynamic imports so this file can remain a classic (non-module) script.
  const [{ auth, database }, authMod, dbMod] = await Promise.all([
    import('./firebase-config.js'),
    import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js'),
  ]);

  const { updateProfile, onAuthStateChanged } = authMod;
  const { ref, get, update, runTransaction } = dbMod;

  const user = await getAuthedUserOrNull(auth, onAuthStateChanged);
  if (!user?.uid) return;
  const uid = user.uid;

  // Auth profile: update missing displayName only.
  if (!user.displayName && fullName) {
    await updateProfile(user, { displayName: fullName });
  }

  // RTDB profile: create if missing, update missing fields only.
  const profileRef = ref(database, 'editprofile/' + uid);
  const snap = await get(profileRef);
  const existing = snap.exists() ? (snap.val() || {}) : {};

  const patch = {};
  if (!existing.name && fullName) patch.name = fullName;

  let reservedUsername = '';
  if (!existing.username && baseUsername) {
    reservedUsername = await reserveUniqueUsername({ database, ref, runTransaction, uid, base: baseUsername });
    if (reservedUsername) patch.username = reservedUsername;
  }

  if (!snap.exists()) {
    patch.createdAt = new Date().toISOString();
  }
  if (Object.keys(patch).length) {
    patch.updatedAt = new Date().toISOString();
    await update(profileRef, patch);
  }
}

// Example: Use Supabase client
function fetchProfiles() {
  window.supabaseClient
    .from('profiles')
    .select('*')
    .then(({ data, error }) => {
      if (error) {
        console.error(error);
      } else {
        console.log(data);
      }
    });
}

// Expose functions to window for use in HTML or other scripts
window.startPayment = startPayment;
window.fetchProfiles = fetchProfiles;

// Expose sync for debugging/manual re-run (non-sensitive; uses name/email only)
window.syncFirebaseProfileFromRazorpayPrefill = syncFirebaseProfileFromRazorpayPrefill;


// (Other Supabase-related functions can be added here using window.supabaseClient)
