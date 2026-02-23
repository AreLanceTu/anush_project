import { auth, database } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { ref, set, update } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

let currentUser = null;
onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
});

// 🔹 Wait for DOM
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("aboutForm");
  const aboutText = document.getElementById("aboutText");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const about = aboutText.value.trim();

    if (!about) {
      showPopup("Please write something about yourself.", false); // red popup
      return;
    }

    const user = currentUser || auth.currentUser;
    if (!user?.uid) {
      showPopup("Please log in first.", false);
      return;
    }

    localStorage.setItem("vivah_yourself", about);

    Promise.all([
      set(ref(database, "users/" + user.uid + "/about"), { about, updatedAt: new Date().toISOString() }),
      update(ref(database, "editprofile/" + user.uid), { aboutYourself: about, updatedAt: new Date().toISOString() }),
    ])
      .then(() => {
        showPopup("Your details are saved!", true); // green popup
        setTimeout(() => {
          window.location.href = "Payment.html"; // redirect to Razorpay payment gateway
        }, 800); // short delay to show popup
      })
      .catch((error) => {
        console.error("Error saving data:", error);
        showPopup("Error saving your data. Please try again.", false); // red popup
      });
  });
});

// ============================
// HELPER FUNCTION TO SHOW POPUP
// ============================
function showPopup(message, success = true) {
  const popup = document.createElement("div");
  popup.innerText = message;

  popup.style.position = "fixed";
  popup.style.top = "20px";
  popup.style.right = "20px";
  popup.style.padding = "12px 20px";
  popup.style.backgroundColor = success ? "#4CAF50" : "#FF2D55"; // green for success, red for warning
  popup.style.color = "#fff";
  popup.style.fontSize = "14px";
  popup.style.borderRadius = "6px";
  popup.style.boxShadow = "0 5px 15px rgba(0,0,0,0.3)";
  popup.style.zIndex = 9999;
  popup.style.opacity = "0";
  popup.style.transition = "opacity 0.3s ease";

  document.body.appendChild(popup);

  // Fade in
  requestAnimationFrame(() => {
    popup.style.opacity = "1";
  });

  // Fade out after 1.5 seconds
  setTimeout(() => {
    popup.style.opacity = "0";
    setTimeout(() => {
      popup.remove();
    }, 300);
  }, 1500);
}
