import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const IDENTITY_KEY = "vivah_chat_identity";
const GLOBAL_ROOM_ID = "global";

const el = {
  chatTitle: document.getElementById("chatTitle"),
  chatSubtitle: document.getElementById("chatSubtitle"),
  errorBanner: document.getElementById("errorBanner"),
  messages: document.getElementById("messages"),
  composer: document.getElementById("composer"),
  messageInput: document.getElementById("messageInput"),
  sendBtn: document.getElementById("sendBtn"),
  loginOverlay: document.getElementById("loginOverlay"),
  identityInput: document.getElementById("identityInput"),
  saveIdentityBtn: document.getElementById("saveIdentityBtn"),
};

let activeRoomId = GLOBAL_ROOM_ID;
let unsubscribeMessages = null;

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getIdentity() {
  const fromLocal = (localStorage.getItem(IDENTITY_KEY) || "").trim();
  if (fromLocal) return fromLocal;

  try {
    const stored = localStorage.getItem("firebaseUser");
    if (!stored) return "";
    const user = JSON.parse(stored);
    return (user?.displayName || user?.email || "").trim();
  } catch {
    return "";
  }
}

function setIdentity(value) {
  localStorage.setItem(IDENTITY_KEY, String(value || "").trim());
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function safeId(value) {
  const out = normalize(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_+|_+$)/g, "")
    .slice(0, 32);
  return out || "user";
}

function formatTime(date) {
  if (!(date instanceof Date)) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

function toDateSafe(createdAt, createdAtMs) {
  if (createdAt?.toDate) {
    try {
      return createdAt.toDate();
    } catch {
      // ignore
    }
  }

  if (typeof createdAtMs === "number" && Number.isFinite(createdAtMs)) {
    return new Date(createdAtMs);
  }

  return null;
}

function getTargetFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const to = (params.get("to") || params.get("user") || params.get("username") || "").trim();
  const name = (params.get("name") || "").trim();

  if (!to) return null;
  return { to, name: name || to };
}

function makeDirectRoomId(a, b) {
  const first = safeId(a);
  const second = safeId(b);
  const x = first < second ? first : second;
  const y = first < second ? second : first;
  return `dm_${x}__${y}`;
}

function showError(message = "") {
  if (!message) {
    el.errorBanner.style.display = "none";
    el.errorBanner.textContent = "";
    return;
  }

  el.errorBanner.textContent = message;
  el.errorBanner.style.display = "block";
}

function firebaseErrorMessage(err) {
  const code = String(err?.code || "").toLowerCase();
  const message = String(err?.message || "").toLowerCase();

  if (message.includes("admin_only_operation")) {
    return "Firebase Auth blocked sign-up (ADMIN_ONLY_OPERATION). Either enable Anonymous sign-in in Firebase Auth, or keep chat using open Firestore rules without auth.";
  }

  if (code.includes("permission-denied") || message.includes("insufficient permissions")) {
    return "Permission denied by Firestore rules. Please check your Firebase rules.";
  }

  if (code.includes("unavailable") || message.includes("offline")) {
    return "Network issue: Firebase is currently unavailable.";
  }

  return err?.message || "Something went wrong.";
}

function setHeader(target) {
  if (target?.name) {
    el.chatTitle.textContent = `Chat with ${target.name}`;
    el.chatSubtitle.textContent = "Direct message • Real-time via Firebase";
    return;
  }

  el.chatTitle.textContent = "Global Chat";
  el.chatSubtitle.textContent = "Public room • Real-time via Firebase";
}

function renderMessages(items, myIdentity) {
  if (!items.length) {
    el.messages.innerHTML = `<div class="empty-state">No messages yet. Start the conversation 👋</div>`;
    return;
  }

  const mine = normalize(myIdentity);

  el.messages.innerHTML = items
    .map((item) => {
      const sender = item.sender || "Unknown";
      const text = item.text || "";
      const isMe = normalize(sender) === mine;
      const time = formatTime(item.createdAtDate);

      return `
        <div class="msg-row ${isMe ? "me" : ""}">
          <article class="bubble">
            <div class="meta">
              <span>${escapeHtml(sender)}</span>
              <span>${escapeHtml(time)}</span>
            </div>
            <div class="text">${escapeHtml(text)}</div>
          </article>
        </div>
      `;
    })
    .join("");

  el.messages.scrollTop = el.messages.scrollHeight;
}

async function ensureRoom(roomId, roomName, participants = []) {
  const roomRef = doc(db, "chatRooms", roomId);
  const now = Date.now();
  await setDoc(
    roomRef,
    {
      name: roomName,
      type: participants.length === 2 ? "dm" : "group",
      participants,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAtMs: now,
      updatedAtMs: now,
    },
    { merge: true }
  );
}

function listenToMessages(roomId) {
  if (unsubscribeMessages) unsubscribeMessages();

  const messagesRef = collection(db, "chatRooms", roomId, "messages");
  const q = query(messagesRef, orderBy("createdAt", "asc"), limit(200));

  unsubscribeMessages = onSnapshot(
    q,
    (snapshot) => {
      const rows = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        rows.push({
          id: docSnap.id,
          sender: data?.sender || data?.username || "",
          text: data?.text || data?.message || "",
          createdAtDate: toDateSafe(data?.createdAt, data?.createdAtMs),
        });
      });

      renderMessages(rows, getIdentity());
      showError("");
    },
    (err) => {
      console.error("onSnapshot error:", err);
      showError(firebaseErrorMessage(err));
    }
  );
}

async function sendMessage() {
  const text = (el.messageInput.value || "").trim();
  const identity = getIdentity();

  if (!identity) {
    openLoginOverlay();
    return;
  }

  if (!text) {
    showError("Please type a message before sending.");
    return;
  }

  el.sendBtn.disabled = true;
  const now = Date.now();

  try {
    const target = getTargetFromUrl();
    const roomName = target?.name ? `Chat with ${target.name}` : "Global Chat";
    await ensureRoom(activeRoomId, roomName);

    const messagesRef = collection(db, "chatRooms", activeRoomId, "messages");
    await addDoc(messagesRef, {
      text,
      message: text,
      sender: identity,
      username: identity,
      senderNorm: normalize(identity),
      createdAt: serverTimestamp(),
      createdAtMs: now,
    });

    const roomRef = doc(db, "chatRooms", activeRoomId);
    try {
      await updateDoc(roomRef, {
        updatedAt: serverTimestamp(),
        updatedAtMs: now,
        lastMessage: text.slice(0, 180),
        lastSender: identity,
      });
    } catch {
      await setDoc(
        roomRef,
        {
          name: roomName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdAtMs: now,
          updatedAtMs: now,
          lastMessage: text.slice(0, 180),
          lastSender: identity,
        },
        { merge: true }
      );
    }

    el.messageInput.value = "";
    el.messageInput.focus();
    showError("");
  } catch (err) {
    console.error("Send error:", err);
    showError(firebaseErrorMessage(err));
  } finally {
    el.sendBtn.disabled = false;
  }
}

function openLoginOverlay() {
  el.loginOverlay.style.display = "flex";
  el.identityInput.value = getIdentity();
  setTimeout(() => el.identityInput.focus(), 0);
}

function closeLoginOverlay() {
  el.loginOverlay.style.display = "none";
}

function wireEvents() {
  el.composer.addEventListener("submit", async (event) => {
    event.preventDefault();
    await sendMessage();
  });

  el.saveIdentityBtn.addEventListener("click", async () => {
    const value = (el.identityInput.value || "").trim();
    if (!value) {
      showError("Username/email cannot be empty.");
      return;
    }

    setIdentity(value);
    closeLoginOverlay();
    showError("");

    const target = getTargetFromUrl();
    await setupRoom(target);
  });

  el.identityInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    el.saveIdentityBtn.click();
  });
}

async function setupRoom(target) {
  const myIdentity = getIdentity();

  if (!myIdentity) {
    openLoginOverlay();
    return;
  }

  if (!target) {
    activeRoomId = GLOBAL_ROOM_ID;
    setHeader(null);
    await ensureRoom(GLOBAL_ROOM_ID, "Global Chat");
    listenToMessages(activeRoomId);
    return;
  }

  const myNorm = normalize(myIdentity);
  const toNorm = normalize(target.to);

  if (!toNorm || toNorm === myNorm) {
    activeRoomId = GLOBAL_ROOM_ID;
    setHeader(null);
    await ensureRoom(GLOBAL_ROOM_ID, "Global Chat");
    listenToMessages(activeRoomId);
    return;
  }

  activeRoomId = makeDirectRoomId(myNorm, toNorm);
  setHeader(target);
  await ensureRoom(activeRoomId, `Chat with ${target.name}`, [myNorm, toNorm]);
  listenToMessages(activeRoomId);
}

async function init() {
  wireEvents();

  const target = getTargetFromUrl();
  if (!getIdentity()) {
    setHeader(target);
    openLoginOverlay();
    return;
  }

  await setupRoom(target);
}

init().catch((err) => {
  console.error(err);
  showError(firebaseErrorMessage(err));
});
