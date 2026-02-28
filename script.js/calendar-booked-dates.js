// calendar-booked-dates.js
// Highlights booked dates in the VenueDetails.html calendar input

import { auth, database } from '../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { ref, get } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

/**
 * Fetch all booked dates for a venue from the bookingBucket in Firebase RTDB
 * @param {string} venueId
 * @returns {Promise<Set<string>>} Set of booked date strings (YYYY-MM-DD)
 */
export async function fetchBookedDatesForVenue(venueId) {
  const bookedDates = new Set();
  if (!venueId) return bookedDates;
  try {
    const snap = await get(ref(database, 'bookingBucket'));
    if (snap.exists()) {
      const all = snap.val() || {};
      Object.values(all).forEach((rec) => {
        if (rec?.venue?.id === venueId && rec?.bookingDate) {
          bookedDates.add(rec.bookingDate);
        }
      });
    }
  } catch (e) {
    console.warn('Failed to fetch booked dates:', e);
  }
  return bookedDates;
}

/**
 * Mark booked dates in the calendar input as red (disabled)
 * @param {HTMLInputElement} inputEl
 * @param {Set<string>} bookedDates
 */
export function markBookedDates(inputEl, bookedDates) {
  if (!inputEl || !bookedDates || bookedDates.size === 0) return;
  // Native <input type="date"> does not support per-date styling, so show a warning and block selection
  inputEl.addEventListener('input', function () {
    if (bookedDates.has(inputEl.value)) {
      inputEl.setCustomValidity('This date is already booked.');
      inputEl.reportValidity();
      inputEl.value = '';
    } else {
      inputEl.setCustomValidity('');
    }
  });
}
