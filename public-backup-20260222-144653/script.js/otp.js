import { auth, database } from "../firebase-config.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Elements
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("phone");
const sendButton = document.getElementById("sendButton");
const errorMessage = document.getElementById("errorMessage");

// 🔹 Email link configuration
const actionCodeSettings = {
  // When user clicks the email link, bring them back to this OTP page.
  // This page will verify the link and then redirect to Marital.html.
  url: window.location.origin + '/Otp.html',
  handleCodeInApp: true
};

// 🔹 On page load, check if user came from email link
window.addEventListener("load", async () => {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
      email = prompt("Please provide your email for confirmation");
    }

    try {
      await signInWithEmailLink(auth, email, window.location.href);
      // Signed in successfully, redirect
      window.location.replace("Marital.html");
    } catch (err) {
      errorMessage.textContent = err.message;
    }
  }
});

// 🔹 Send email link & store data in Firebase
sendButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const phone = phoneInput.value.trim();

  if (!email || !phone) {
    errorMessage.textContent = "Please enter both email and phone number!";
    return;
  }

  try {
    // Store in Firebase DB
    await set(ref(database, 'users/' + phone), {
      email: email,
      phone: phone
    });

    // Send magic link
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);

    alert("Your verification link has been sent to your email!");
  } catch (err) {
    errorMessage.textContent = err.message;
  }
});
