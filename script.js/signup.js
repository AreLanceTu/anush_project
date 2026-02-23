// signup.js (Supabase auth)
(function () {
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCK9QDme74xdviLRMFYRQQdGbHbwbKrRiI",
    authDomain: "vivahh-e07a7.firebaseapp.com",
    databaseURL: "https://vivahh-e07a7-default-rtdb.firebaseio.com",
    projectId: "vivahh-e07a7",
    storageBucket: "vivahh-e07a7.firebasestorage.app",
    messagingSenderId: "738044051636",
    appId: "1:738044051636:web:4f6a7ba80c104f8dd457e1",
    measurementId: "G-W2RRB8Y383",
  };

  function isSupabaseReady() {
    return !!(window.supabaseClient && window.supabaseSignupWithEmail && window.supabaseGetCurrentUser);
  }

  function redirectToLogin(next = 'Upload.html') {
    const encoded = encodeURIComponent(next);
    window.location.href = `login.html?redirect=${encoded}`;
  }

  function ensureFirebaseAuth() {
    if (!window.firebase) {
      alert('Firebase SDK is not loaded.');
      return null;
    }

    if (!window.firebase.apps || window.firebase.apps.length === 0) {
      window.firebase.initializeApp(FIREBASE_CONFIG);
    }

    return window.firebase.auth();
  }

  function ensureFirebaseDatabase() {
    if (!window.firebase) return null;
    if (!window.firebase.database) return null;
    return window.firebase.database();
  }

  async function checkUserExistsInDb(uid) {
    const db = ensureFirebaseDatabase();
    if (!db) return false;

    try {
      const [usersSnap, editSnap] = await Promise.all([
        db.ref('users/' + uid).once('value'),
        db.ref('editprofile/' + uid).once('value'),
      ]);
      return !!(usersSnap?.exists?.() || editSnap?.exists?.());
    } catch (e) {
      console.warn('DB check failed', e);
      return false;
    }
  }

  async function routeAfterFirebaseLogin(uid) {
    const isExisting = await checkUserExistsInDb(uid);
    if (isExisting) {
      window.location.replace('Matches.html');
      return;
    }
    window.location.replace('Registration.html');
  }

  async function handleEmailSignup(e) {
    e.preventDefault();

    const name = (document.getElementById('name')?.value || '').trim();
    const email = (document.getElementById('email')?.value || '').trim();
    const password = document.getElementById('password')?.value || '';

    if (!email || !password) {
      alert('Email and password are required');
      return;
    }

    if (!isSupabaseReady()) {
      alert('Supabase is not initialized on this page.');
      return;
    }

    const { data, error } = await window.supabaseSignupWithEmail(email, password);
    if (error) {
      alert(error.message || 'Sign up failed');
      return;
    }

    const user = await window.supabaseGetCurrentUser();
    if (user) {
      window.location.href = 'Upload.html';
      return;
    }

    alert('Account created. Please check your email to confirm, then log in.');
    redirectToLogin('Upload.html');
  }

  async function handleGoogleSignup() {
    const auth = ensureFirebaseAuth();
    if (!auth) return;

    try {
      const provider = new window.firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      const user = result?.user;

      if (user) {
        localStorage.setItem(
          'firebaseUser',
          JSON.stringify({
            uid: user.uid,
            email: user.email || null,
            displayName: user.displayName || null,
            photoURL: user.photoURL || null,
          })
        );
      }

      localStorage.setItem('authProvider', 'firebase');

      if (user?.uid) {
        await routeAfterFirebaseLogin(user.uid);
      } else {
        window.location.href = 'Registration.html';
      }
    } catch (error) {
      console.error('Google Sign-in Error:', error);
      alert(error?.message || 'Google sign up failed');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    if (signupForm) signupForm.addEventListener('submit', handleEmailSignup);

    const googleBtn = document.getElementById('googleSignup');
    if (googleBtn) googleBtn.addEventListener('click', handleGoogleSignup);
  });
})();
