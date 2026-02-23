// supabase-config.js
// 🔑 Supabase Credentials
const SUPABASE_URL = 'https://mdexyiujzucizilbddlg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kZXh5aXVqenVjaXppbGJkZGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1NTk5NjcsImV4cCI6MjA4NDEzNTk2N30.uj4-q5EYmoarV3n5Kezj2odSfOVvf3rtWAg5UVWtOE8';

// Initialize Supabase client using CDN global
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Example: Authentication

async function loginWithEmail(email, password) {
  const { data, error } = await window.supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });
  return { data, error };
}


async function signupWithEmail(email, password) {
  const { data, error } = await window.supabaseClient.auth.signUp({
    email: email,
    password: password
  });
  return { data, error };
}


async function logout() {
  const { error } = await window.supabaseClient.auth.signOut();
  return { error };
}


async function getCurrentUser() {
  // Prefer local session (no network) to avoid false negatives right after redirect.
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  if (session?.user) return session.user;

  const { data: { user } } = await window.supabaseClient.auth.getUser();
  return user;
}

// Example: Database (Insert data)

async function addProfile(userId, profileData) {
  const { data, error } = await window.supabaseClient
    .from('profiles')
    .insert([{ id: userId, ...profileData }]);
  return { data, error };
}

// Example: Database (Query data)

async function getProfile(userId) {
  const { data, error } = await window.supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId);
  return { data, error };
}

// Attach functions to window for browser use
window.supabaseLoginWithEmail = loginWithEmail;
window.supabaseSignupWithEmail = signupWithEmail;
window.supabaseLogout = logout;
window.supabaseGetCurrentUser = getCurrentUser;
window.supabaseAddProfile = addProfile;
window.supabaseGetProfile = getProfile;
