import { auth, database } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { ref, set, update } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

let currentUser = null;
onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
});

/* 🔥 Elements */
const form = document.getElementById("workForm");
const annualIncome = document.getElementById("annualIncome");
const workWith = document.getElementById("workWith");
const workAs = document.getElementById("workAs");
const companyInput = document.querySelector("#companyGroup input");

/* 🔥 Submit Handler */
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const user = currentUser || auth.currentUser;
  if (!user?.uid) {
    alert("User not logged in");
    return;
  }

  const workAsLabel = workAs?.options?.[workAs.selectedIndex]?.text || workAs.value || "";

  const jobData = {
    annualIncome: annualIncome.value,
    workWith: workWith.value,
    workAs: workWith.value === "not_working" ? "not_applicable" : workAsLabel,
    company: workWith.value === "not_working" ? "not_applicable" : (companyInput.value || ""),
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem("vivah_job", jobData.workAs === "not_applicable" ? "" : jobData.workAs);
  localStorage.setItem("vivah_company", jobData.company === "not_applicable" ? "" : jobData.company);

  Promise.all([
    set(ref(database, `users/${user.uid}/jobDetails`), jobData),
    update(ref(database, "editprofile/" + user.uid), {
      job: jobData.workAs === "not_applicable" ? "" : jobData.workAs,
      company: jobData.company === "not_applicable" ? "" : jobData.company,
      updatedAt: new Date().toISOString(),
    }),
  ])
    .then(() => {
      window.location.href = "Upload.html";
    })
    .catch((error) => {
      console.error("Error saving job details:", error);
      alert("Something went wrong. Please try again.");
    });
});
