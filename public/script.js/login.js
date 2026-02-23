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

  function getRedirectTarget() {
    try {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      if (!redirect) return 'Matches.html';

      // Basic safety: allow only same-origin relative paths
      if (redirect.includes('://') || redirect.startsWith('//')) return 'Matches.html';
      return redirect;
    } catch {
      return 'Matches.html';
    }
  }

  async function maybeRedirectIfAlreadyLoggedIn() {
    const target = getRedirectTarget();

    // If the user already has a Supabase session, skip login page.
    try {
      const sessionResult = await window.supabaseClient?.auth?.getSession?.();
      if (sessionResult?.data?.session?.user) {
        window.location.replace(target);
        return;
      }
    } catch (e) {
      console.warn('Supabase session check failed', e);
    }

    // If the user already signed in with Firebase earlier (Google flow), skip login page.
    try {
      const provider = localStorage.getItem('authProvider');
      const fbUser = localStorage.getItem('firebaseUser');
      if (provider === 'firebase' && fbUser) {
        const parsed = JSON.parse(fbUser || 'null');
        const uid = parsed?.uid;
        if (uid) {
          await routeAfterFirebaseLogin(uid, target);
          return;
        }

        window.location.replace(target);
        return;
      }
    } catch {}

    // Best-effort: check live Firebase auth state (compat SDK).
    try {
      const auth = ensureFirebaseAuth();
      if (auth?.currentUser) {
        await routeAfterFirebaseLogin(auth.currentUser.uid, target);
        return;
      }
      if (auth?.onAuthStateChanged) {
        auth.onAuthStateChanged(async (user) => {
          if (user) await routeAfterFirebaseLogin(user.uid, target);
        });
      }
    } catch {}
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

  async function routeAfterFirebaseLogin(uid, existingTarget) {
    const isExisting = await checkUserExistsInDb(uid);

    if (isExisting) {
      window.location.replace(existingTarget || 'Matches.html');
      return;
    }

    // New Google user: start the full signup flow.
    window.location.replace('Registration.html');
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

  async function handleLogin(e) {
    e.preventDefault();

    const emailEl = document.getElementById('email');
    const passwordEl = document.getElementById('password');

    const email = (emailEl?.value || '').trim();
    const password = passwordEl?.value || '';

    if (!email || !password) {
      alert('Please enter email and password');
      return;
    }

    if (!window.supabaseLoginWithEmail) {
      alert('Supabase is not initialized on this page.');
      return;
    }

    const { data, error } = await window.supabaseLoginWithEmail(email, password);
    if (error) {
      alert(error.message || 'Login failed');
      return;
    }

    // If user is present, session is set.
    if (!data?.user) {
      alert('Login did not return a user.');
      return;
    }

    window.location.href = getRedirectTarget();
  }

  async function handleGoogleLogin() {
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
        await routeAfterFirebaseLogin(user.uid, getRedirectTarget());
      } else {
        window.location.href = getRedirectTarget();
      }
    } catch (error) {
      console.error('Google Sign-in Error:', error);
      alert(error?.message || 'Google sign-in failed');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // If the user is already logged in, don't show login page.
    maybeRedirectIfAlreadyLoggedIn();

    const form = document.getElementById('loginForm');
    if (form) form.addEventListener('submit', handleLogin);

    const googleBtn = document.getElementById('googleSignup');
    if (googleBtn) googleBtn.addEventListener('click', handleGoogleLogin);
  });
})();
