import { auth, database } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { ref, update } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

let currentUser = null;
onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  if (!currentUser) {
    alert("Login required");
    window.location.href = "signup.html";
  }
});

document.querySelector(".continue-btn")?.addEventListener("click", async () => {
  if (!currentUser?.uid) {
    alert("User not authenticated");
    return;
  }

  const selects = document.querySelectorAll("select");
  const religion = selects?.[0]?.value || "";
  const community = selects?.[1]?.value || "";
  const livingIn = selects?.[2]?.value || "";

  if (!religion || !community || !livingIn) {
    alert("Please fill all fields");
    return;
  }

  localStorage.setItem("vivah_religion", religion);
  localStorage.setItem("livingIn", livingIn);
  localStorage.setItem("vivah_country", livingIn);

  try {
    await update(ref(database, "users/" + currentUser.uid), { religion, community, livingIn, updatedAt: new Date().toISOString() });
    await update(ref(database, "editprofile/" + currentUser.uid), {
      religion,
      community,
      country: livingIn,
      updatedAt: new Date().toISOString(),
    });
    window.location.href = "Otp.html";
  } catch (error) {
    console.error("Firebase error:", error);
    alert(error?.message || "Failed to save. Please try again.");
  }
});
