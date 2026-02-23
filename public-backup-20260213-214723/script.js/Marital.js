import { auth, database } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { ref, set, update } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

let currentUser = null;
onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
});

// DOM Elements
const maritalSelect = document.querySelectorAll("select")[0];
const heightSelect = document.querySelectorAll("select")[1];
const dietSelect = document.querySelectorAll("select")[2];
const continueBtn = document.querySelector(".continue-btn");

continueBtn.addEventListener("click", () => {
  const user = currentUser || auth.currentUser;
  if (!user?.uid) {
    alert("Please log in first!");
    return;
  }

  const maritalStatus = maritalSelect.value;
  const height = heightSelect.value;
  const diet = dietSelect.value;

  if (!maritalStatus || !height || !diet) {
    alert("Please fill all fields!");
    return;
  }

  localStorage.setItem("vivah_marital", maritalStatus);

  Promise.all([
    set(ref(database, "users/" + user.uid + "/maritalInfo"), { maritalStatus, height, diet, updatedAt: new Date().toISOString() }),
    update(ref(database, "editprofile/" + user.uid), { marital: maritalStatus, updatedAt: new Date().toISOString() }),
  ])
    .then(() => {
      window.location.href = "Qualification.html";
    })
    .catch((error) => {
      console.error("Error saving data:", error);
      alert("Failed to save data. Please try again.");
    });
});
