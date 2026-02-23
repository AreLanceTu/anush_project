// firebase-config.js (Firebase v12.6.0 – Modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCK9QDme74xdviLRMFYRQQdGbHbwbKrRiI",
  authDomain: "vivahh-e07a7.firebaseapp.com",
  databaseURL: "https://vivahh-e07a7-default-rtdb.firebaseio.com",
  projectId: "vivahh-e07a7",
  storageBucket: "vivahh-e07a7.firebasestorage.app",
  messagingSenderId: "738044051636",
  appId: "1:738044051636:web:4f6a7ba80c104f8dd457e1",
  measurementId: "G-W2RRB8Y383"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
