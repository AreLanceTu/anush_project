// payment-integration.js (browser compatible)
// Use window.supabaseClient for Supabase
// Use window.Razorpay for Razorpay

// Example: Start Razorpay payment
async function startPayment({ amount, name, email, phone }) {
  // IMPORTANT (security): do not store sensitive payment data client-side.
  // We only use Razorpay *prefill* values (name/email) to update the user's Firebase profile.

  // Assumes Razorpay SDK is loaded globally
  const options = {
    key: 'rzp_test_S4X9wjnzOxiIvw', // Replace with your Razorpay Key ID
    amount: amount * 100, // in paise
    currency: 'INR',
    name: 'Vivah Premium Membership',
    description: 'Premium Membership Payment',
    handler: function (response) {
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

      // Razorpay response contains IDs (payment_id/order_id/signature).
      // For client-side profile sync, we only use the prefill name/email we sent.
      syncFirebaseProfileFromRazorpayPrefill(options.prefill)
        .catch((e) => console.warn('Profile sync skipped:', e))
        .finally(() => {
          alert('Payment successful! Payment ID: ' + response.razorpay_payment_id);
          window.location.href = 'PartnerSelection.html';
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
