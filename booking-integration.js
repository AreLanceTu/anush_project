// booking-integration.js (browser compatible)
// Uses global window.Razorpay (checkout.js)

async function startBookingPayment({ amount, venue, bookingDate, successRedirectUrl }) {
  const v = venue && typeof venue === 'object' ? venue : {};
  const date = (bookingDate || '').toString().trim();

  const options = {
    key: 'rzp_test_S4X9wjnzOxiIvw',
    amount: Number(amount || 0) * 100,
    currency: 'INR',
    name: 'Vivah Venue Booking',
    description: `Booking for ${(v.name || 'Venue').toString()}`,
    notes: {
      type: 'venue-booking',
      venueId: (v.id || '').toString(),
      venueName: (v.name || '').toString(),
      city: (v.city || '').toString(),
      bookingDate: date,
      amount: String(amount ?? ''),
    },
    handler: function (response) {
      (async () => {
        await saveBookingToFirebaseRTDB({
          venue: v,
          amount,
          bookingDate: date,
          currency: 'INR',
          razorpay: {
            paymentId: response?.razorpay_payment_id || '',
            orderId: response?.razorpay_order_id || '',
            signature: response?.razorpay_signature || '',
          },
        });
      })()
        .catch((e) => console.warn('Booking save failed:', e))
        .finally(() => {
          alert('Booking payment successful! Payment ID: ' + (response?.razorpay_payment_id || ''));
          window.location.href = (successRedirectUrl || 'MyBookings.html');
        });
    },
    theme: { color: '#E34450' },
  };

  const rzp = new window.Razorpay(options);
  rzp.open();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getAuthedUserOrNull(auth, onAuthStateChanged, timeoutMs = 1500) {
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

async function saveBookingToFirebaseRTDB({ venue, amount, bookingDate, currency, razorpay }) {
  const record = {
    venue: {
      id: (venue?.id || '').toString() || null,
      name: (venue?.name || '').toString() || null,
      city: (venue?.city || '').toString() || null,
      image: (venue?.image || '').toString() || null,
    },
    amount: Number(amount) || 0,
    bookingDate: (bookingDate || '').toString() || null,
    currency: (currency || 'INR').toString(),
    razorpay: {
      paymentId: (razorpay?.paymentId || '').toString(),
      orderId: (razorpay?.orderId || '').toString(),
      signature: (razorpay?.signature || '').toString(),
    },
    status: 'success',
    page: (typeof location !== 'undefined' ? location.href : ''),
    createdAt: new Date().toISOString(),
  };

  // If auth isn't ready, keep a pending record so other pages can upload later.
  try {
    localStorage.setItem('vivah_pendingBookingRecord_v1', JSON.stringify(record));
  } catch {
    // ignore
  }

  try {
    const [{ auth, database }, authMod, dbMod] = await Promise.all([
      import('./firebase-config.js'),
      import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js'),
    ]);

    const { onAuthStateChanged } = authMod;
    const { ref, push, set, serverTimestamp } = dbMod;

    const user = await getAuthedUserOrNull(auth, onAuthStateChanged, 1800);
    if (!user?.uid) throw new Error('not-authenticated');

    const uid = user.uid;
    const paymentId = record.razorpay.paymentId;
    const safeKey = /^[A-Za-z0-9_-]+$/.test(paymentId || '') ? paymentId : '';

    const perUserBase = ref(database, `bookings/${uid}`);
    const perUserRef = safeKey ? ref(database, `bookings/${uid}/${safeKey}`) : push(perUserBase);

    const bucketBase = ref(database, `bookingBucket`);
    const bucketRef = safeKey ? ref(database, `bookingBucket/${safeKey}`) : push(bucketBase);

    await Promise.race([
      Promise.all([
        set(perUserRef, { ...record, uid, createdAtServer: serverTimestamp() }),
        set(bucketRef, { ...record, uid, createdAtServer: serverTimestamp() }),
      ]),
      sleep(1800),
    ]);

    try { localStorage.removeItem('vivah_pendingBookingRecord_v1'); } catch {}
  } catch (e) {
    console.warn('Booking RTDB write failed:', e);
    // Keep pending record for later retry.
  }
}

// Expose
window.startBookingPayment = startBookingPayment;
window.saveBookingToFirebaseRTDB = saveBookingToFirebaseRTDB;
