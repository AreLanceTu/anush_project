// google.js (Firebase v12.6.0 – Modular)

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCK9QDme74xdviLRMFYRQQdGbHbwbKrRiI",
  authDomain: "vivahh-e07a7.firebaseapp.com",
  projectId: "vivahh-e07a7",
  storageBucket: "vivahh-e07a7.firebasestorage.app",
  messagingSenderId: "738044051636",
  appId: "1:738044051636:web:4f6a7ba80c104f8dd457e1",
  measurementId: "G-W2RRB8Y383"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Auth
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Google Sign-Up / Login Button Click
const googleBtn = document.getElementById("googleSignup");
if (googleBtn) {
  googleBtn.addEventListener("click", () => {
    signInWithPopup(auth, provider)
      .then((result) => {
        const user = result.user;

        console.log("User signed in:", user);
        alert("Welcome to Vivah, " + (user?.displayName || user?.email || "User"));

        window.location.href = "Religion.html";
      })
      .catch((error) => {
        console.error("Google Sign-in Error:", error);
        alert(error?.message || "Google sign-in failed");
      });
  });
}

// Optional: Detect already logged-in user
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("User already logged in:", user.email);
  }
});

