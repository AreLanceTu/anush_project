// Import Firebase modules from CDN (ES Modules)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCK9QDme74xdviLRMFYRQQdGbHbwbKrRiI",
  authDomain: "vivahh-e07a7.firebaseapp.com",
  databaseURL: "https://vivahh-e07a7-default-rtdb.firebaseio.com",
  projectId: "vivahh-e07a7",
  storageBucket: "vivahh-e07a7.appspot.com",
  messagingSenderId: "738044051636",
  appId: "1:738044051636:web:4f6a7ba80c104f8dd457e1",
  measurementId: "G-W2RRB8Y383"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUser = null;

// Wait for auth state
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    console.log("Logged in:", user.uid);
    document.getElementById("continueBtn").disabled = false;
  } else {
    alert("Login required");
    window.location.href = "signup.html";
  }
});

// Function to save data and go next
function goNext() {
  const fname = document.getElementById("firstName").value.trim();
  const lname = document.getElementById("lastName").value.trim();
  const dob = document.getElementById("dob").value;

  if (!fname || !lname || !dob) {
    alert("Please fill all fields");
    return;
  }

  if (!currentUser) {
    alert("User not authenticated");
    return;
  }

  // Save data to Realtime Database
  set(ref(db, "users/" + currentUser.uid), {
    firstName: fname,
    lastName: lname,
    dob: dob,
    email: currentUser.email,
    createdAt: new Date().toISOString()
  })
    .then(() => {
      console.log("Data saved successfully");
      window.location.href = "Religion.html"; // Redirect
    })
    .catch((error) => {
      console.error("Firebase error:", error);
      alert(error.message);
    });
}

// Attach click listener
document.getElementById("continueBtn").addEventListener("click", goNext);
