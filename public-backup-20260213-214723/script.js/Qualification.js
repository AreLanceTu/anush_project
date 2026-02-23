import { auth, database } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { ref, set, update } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

let currentUser = null;
onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
});

// 🔹 Get form elements
const form = document.querySelector("form");
const collegeInput = document.getElementById("college");
const qualificationSelect = document.getElementById("qualification");

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const college = collegeInput.value.trim();
  const qualificationValue = qualificationSelect.value;
  const qualificationLabel = qualificationSelect.options?.[qualificationSelect.selectedIndex]?.text || qualificationValue;

  if (!college || !qualificationValue) {
    alert("Please fill all fields.");
    return;
  }

  const user = currentUser || auth.currentUser;
  if (!user?.uid) {
    alert("Please log in first!");
    return;
  }

  localStorage.setItem("vivah_qualification", qualificationLabel);

  Promise.all([
    set(ref(database, "users/" + user.uid + "/qualification"), { college, qualification: qualificationLabel, updatedAt: new Date().toISOString() }),
    update(ref(database, "editprofile/" + user.uid), { qualification: qualificationLabel, updatedAt: new Date().toISOString() }),
  ])
    .then(() => {
      alert("Your qualification details are saved!");
      window.location.href = "Job.html";
    })
    .catch((error) => {
      console.error("Error saving data:", error);
      alert("There was an error saving your data. Please try again.");
    });
});
