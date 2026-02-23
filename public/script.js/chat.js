// Mirrors public/script.js/chat.js for local preview
import { auth, db } from "../firebase-config.js";
import {
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  serverTimestamp,
  where,
  query,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const USERNAME_KEY = "vivah_chat_username";
const USERNAME_KEY_FALLBACK = "vivah_username";
const DEFAULT_ROOM_ID = "global";

const el = {
  sidebar: document.getElementById("sidebar"),
  toggleSidebarBtn: document.getElementById("toggleSidebarBtn"),
  rooms: document.getElementById("rooms"),
  roomSearch: document.getElementById("roomSearch"),
  activeRoomTitle: document.getElementById("activeRoomTitle"),
  activeRoomSubtitle: document.getElementById("activeRoomSubtitle"),
  messages: document.getElementById("messages"),
  composer: document.getElementById("composer"),
  messageInput: document.getElementById("messageInput"),
  usernameModal: document.getElementById("usernameModal"),
  usernameInput: document.getElementById("usernameInput"),
  saveUsernameBtn: document.getElementById("saveUsernameBtn"),
  changeNameBtn: document.getElementById("changeNameBtn"),
  newRoomBtn: document.getElementById("newRoomBtn"),
};

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(date) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

function getSuggestedUsername() {
  try {
    const stored = localStorage.getItem("firebaseUser");
    if (!stored) return "";
    const u = JSON.parse(stored);
    return (u?.displayName || u?.email || "").toString().split("@")[0] || "";
  } catch {
    return "";
  }
}

function getUsername() {
  const primary = (localStorage.getItem(USERNAME_KEY) || "").trim();
  if (primary) return primary;
  return (localStorage.getItem(USERNAME_KEY_FALLBACK) || "").trim();
}

function setUsername(name) {
  const normalized = (name || "").trim();
  localStorage.setItem(USERNAME_KEY, normalized);
  if (normalized) localStorage.setItem(USERNAME_KEY_FALLBACK, normalized);
}

function openUsernameModal() {
  el.usernameModal.classList.add("open");
  el.usernameInput.value = getUsername() || getSuggestedUsername() || "";
  setTimeout(() => el.usernameInput.focus(), 0);
}

function closeUsernameModal() {
  el.usernameModal.classList.remove("open");
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function safeIdPart(value) {
  const base = normalizeUsername(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_+|_+$)/g, "")
    .slice(0, 40);
  return base || "user";
}

function makeDmRoomId(aNorm, bNorm) {
  const a = safeIdPart(aNorm);
  const b = safeIdPart(bNorm);
  const x = a < b ? a : b;
  const y = a < b ? b : a;
  return `dm_${x}__${y}`;
}

function getDirectTargetFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const to = (params.get("to") || params.get("user") || params.get("username") || "").trim();
  const name = (params.get("name") || "").trim();
  if (!to) return null;
  return { to, name };
}

async function ensureSignedIn() {
  try {
    if (auth?.currentUser) return;
    await signInAnonymously(auth);
  } catch (err) {
    console.warn("Anonymous sign-in failed", err);
  }
}

function friendlyFirebaseError(err) {
  const code = err?.code || "";
  const msg = err?.message || "";
  if (String(code).includes("permission-denied") || String(msg).toLowerCase().includes("insufficient permissions")) {
    return "Message failed: Firestore permissions blocked this write. Update Firestore rules (or enable Auth and allow request.auth != null).";
  }
  if (String(code).includes("failed-precondition") && String(msg).toLowerCase().includes("index")) {
    return "Chat list query needs a Firestore index. Create the suggested composite index in Firebase Console → Firestore → Indexes.";
  }
  if (String(code).includes("unavailable") || String(msg).toLowerCase().includes("offline")) {
    return "Firebase is currently unreachable. Check internet and Firebase project status.";
  }
  return msg || "Failed to send message";
}

function isIndexError(err) {
  const code = String(err?.code || "").toLowerCase();
  const msg = String(err?.message || "").toLowerCase();
  return code.includes("failed-precondition") && msg.includes("index");
}

function toDateSafe(ts, ms) {
  if (ts?.toDate) {
    try {
      return ts.toDate();
    } catch {
      // ignore
    }
  }
  if (typeof ms === "number" && Number.isFinite(ms)) {
    return new Date(ms);
  }
  return null;
}

function toMillisSafe(date, fallback = 0) {
  if (date instanceof Date && !Number.isNaN(date.getTime())) return date.getTime();
  return fallback;
}

async function ensureRoom(roomId, roomName) {
  const roomRef = doc(db, "chatRooms", roomId);
  const snap = await getDoc(roomRef);
  if (snap.exists()) return;

  const nowMs = Date.now();
  await setDoc(roomRef, {
    name: roomName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    lastMessage: "",
    lastSender: "",
  });
}

async function ensureDmRoom(roomId, myDisplay, otherDisplay, myNorm, otherNorm) {
  const roomRef = doc(db, "chatRooms", roomId);
  const snap = await getDoc(roomRef);
  const nowMs = Date.now();

  const base = {
    type: "dm",
    participants: [myNorm, otherNorm],
    participantsDisplay: [myDisplay, otherDisplay],
    updatedAt: serverTimestamp(),
    updatedAtMs: nowMs,
    lastMessage: "",
    lastSender: "",
  };

  if (!snap.exists()) {
    await setDoc(roomRef, {
      ...base,
      createdAt: serverTimestamp(),
      createdAtMs: nowMs,
    });
    return;
  }

  await setDoc(roomRef, base, { merge: true });
}

let activeRoomId = DEFAULT_ROOM_ID;
let unsubscribeMessages = null;
let unsubscribeRooms = null;
let pendingDirectTarget = null;
let roomsFilterWired = false;

function renderRooms(rooms, activeId, searchTerm) {
  const term = (searchTerm || "").trim().toLowerCase();
  const filtered = term
    ? rooms.filter((r) => (r.name || "").toLowerCase().includes(term))
    : rooms;

  if (!filtered.length) {
    el.rooms.innerHTML = `<div style="padding:12px;color:rgba(255,255,255,0.62)">No chats found</div>`;
    return;
  }

  el.rooms.innerHTML = filtered
    .map((r) => {
      const isActive = r.id === activeId;
      const time = r.updatedAtDate ? formatTime(r.updatedAtDate) : "";
      const last = r.lastMessage ? escapeHtml(r.lastMessage) : "Start chatting";
      const name = escapeHtml(r.displayName || r.name || "Chat");
      return `
        <div class="room ${isActive ? "active" : ""}" data-room-id="${escapeHtml(r.id)}" role="button" tabindex="0">
          <div class="room-avatar"><i class="fa-solid fa-user"></i></div>
          <div class="room-meta">
            <div class="room-line1">
              <div class="room-name">${name}</div>
              <div class="room-time">${escapeHtml(time)}</div>
            </div>
            <div class="room-last">${last}</div>
          </div>
        </div>
      `;
    })
    .join("");

  el.rooms.querySelectorAll(".room").forEach((node) => {
    node.addEventListener("click", () => {
      const roomId = node.getAttribute("data-room-id");
      if (roomId) setActiveRoom(roomId);
    });
    node.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const roomId = node.getAttribute("data-room-id");
        if (roomId) setActiveRoom(roomId);
      }
    });
  });
}

function renderMessages(messages, myUsername) {
  if (!messages.length) {
    el.messages.innerHTML = `<div style="margin:auto;color:rgba(255,255,255,0.62);text-align:center;max-width:520px">
      <div style="font-weight:900;font-size:1.05rem;margin-bottom:6px">No messages yet</div>
      <div style="font-size:0.9rem">Say hi — your messages are stored in Firebase.</div>
    </div>`;
    return;
  }

  el.messages.innerHTML = messages
    .map((m) => {
      const isMe = (m.username || "").trim().toLowerCase() === (myUsername || "").trim().toLowerCase();
      const when = m.createdAtDate ? formatTime(m.createdAtDate) : "";
      const text = escapeHtml(m.text || m.message || "");
      const sender = escapeHtml(m.username || "Unknown");
      return `
        <div class="msg-row ${isMe ? "me" : ""}">
          <div class="bubble">
            <div class="meta">
              <div class="sender">${sender}</div>
              <div class="time">${escapeHtml(when)}</div>
            </div>
            <div class="text">${text}</div>
          </div>
        </div>
      `;
    })
    .join("");

  el.messages.scrollTop = el.messages.scrollHeight;
}

function setRoomHeader(roomName, subtitle) {
  el.activeRoomTitle.textContent = roomName || "Chat";
  el.activeRoomSubtitle.textContent = subtitle || "Saved to Firebase";
}

function getDmOtherDisplay(roomData, myNorm) {
  const participants = Array.isArray(roomData?.participants) ? roomData.participants : [];
  const participantsDisplay = Array.isArray(roomData?.participantsDisplay) ? roomData.participantsDisplay : [];

  const idx = participants.findIndex((p) => normalizeUsername(p) === normalizeUsername(myNorm));
  if (idx !== -1 && participantsDisplay.length === participants.length) {
    const otherIdx = idx === 0 ? 1 : 0;
    return participantsDisplay[otherIdx] || participants[otherIdx] || "Chat";
  }

  const otherNorm = participants.find((p) => normalizeUsername(p) !== normalizeUsername(myNorm));
  return otherNorm || "Chat";
}

function listenToMessages(roomId) {
  if (unsubscribeMessages) unsubscribeMessages();

  const messagesRef = collection(db, "chatRooms", roomId, "messages");
  const orderedQuery = query(messagesRef, orderBy("createdAt", "asc"), limit(200));
  const fallbackQuery = query(messagesRef, limit(200));
  let fallbackUsed = false;

  const renderSnapshot = (snapshot) => {
    const myName = getUsername();
    const rows = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const createdAtDate = toDateSafe(data?.createdAt, data?.createdAtMs);
      rows.push({
        id: docSnap.id,
        text: data?.text || data?.message || "",
        username: data?.username || data?.sender || "",
        createdAtDate,
      });
    });

    rows.sort((a, b) => {
      const aMs = toMillisSafe(a.createdAtDate, 0);
      const bMs = toMillisSafe(b.createdAtDate, 0);
      if (aMs !== bMs) return aMs - bMs;
      return a.id.localeCompare(b.id);
    });

    renderMessages(rows, myName);
  };

  unsubscribeMessages = onSnapshot(
    orderedQuery,
    (snapshot) => {
      renderSnapshot(snapshot);
    },
    (err) => {
      console.error("Message listener error:", err);
      if (fallbackUsed) return;
      fallbackUsed = true;
      unsubscribeMessages = onSnapshot(
        fallbackQuery,
        (snapshot) => {
          renderSnapshot(snapshot);
        },
        (fallbackErr) => {
          console.error("Fallback message listener error:", fallbackErr);
          alert(friendlyFirebaseError(fallbackErr));
        }
      );
    }
  );
}

async function setActiveRoom(roomId) {
  activeRoomId = roomId;
  el.messages.innerHTML = "";

  const roomRef = doc(db, "chatRooms", roomId);
  const snap = await getDoc(roomRef);
  const data = snap.exists() ? snap.data() : null;
  const myNorm = normalizeUsername(getUsername());
  const isDm = data?.type === "dm";

  if (isDm) {
    const other = getDmOtherDisplay(data, myNorm);
    setRoomHeader(`Chat with ${other}`, "Direct message • Saved to Firebase");
  } else {
    const roomName = data?.name || "Chat";
    const subtitle = roomId === DEFAULT_ROOM_ID ? "Saved to Firebase – all users (username-based)" : `Room: ${roomId}`;
    setRoomHeader(roomName || "Chat", subtitle);
  }

  listenToMessages(roomId);

  if (window.matchMedia("(max-width: 900px)").matches) {
    el.sidebar.classList.remove("show");
  }
}

async function createRoomFlow() {
  const name = prompt("Enter chat name (room)");
  const roomName = (name || "").trim();
  if (!roomName) return;

  const baseId = roomName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);

  const roomId = baseId || `room-${Date.now()}`;
  await ensureRoom(roomId, roomName);
  await setActiveRoom(roomId);
}

async function openDirectChat(target) {
  const myDisplay = getUsername();
  if (!myDisplay) {
    pendingDirectTarget = target;
    openUsernameModal();
    return;
  }

  const toRaw = (target?.to || "").trim();
  const toDisplay = (target?.name || toRaw).trim() || toRaw;

  if (toDisplay) {
    setRoomHeader(`Chat with ${toDisplay}`, "Direct message • Saved to Firebase");
  }

  const myNorm = normalizeUsername(myDisplay);
  const otherNorm = normalizeUsername(toRaw || toDisplay);
  if (!otherNorm || otherNorm === myNorm) {
    await setActiveRoom(DEFAULT_ROOM_ID);
    return;
  }

  const roomId = makeDmRoomId(myNorm, otherNorm);
  await ensureDmRoom(roomId, myDisplay, toDisplay, myNorm, otherNorm);
  await setActiveRoom(roomId);
}

async function sendMessage(text) {
  const username = getUsername();
  if (!username) {
    openUsernameModal();
    return;
  }

  const messageText = (text || "").trim();
  if (!messageText) return;

  await ensureRoom(activeRoomId, activeRoomId === DEFAULT_ROOM_ID ? "Global Chat" : activeRoomId);
  const nowMs = Date.now();

  const messagesRef = collection(db, "chatRooms", activeRoomId, "messages");
  await addDoc(messagesRef, {
    text: messageText,
    message: messageText,
    username,
    sender: username,
    senderNorm: normalizeUsername(username),
    createdAt: serverTimestamp(),
    createdAtMs: nowMs,
  });

  const roomRef = doc(db, "chatRooms", activeRoomId);
  try {
    await updateDoc(roomRef, {
      updatedAt: serverTimestamp(),
      updatedAtMs: nowMs,
      lastMessage: messageText.slice(0, 160),
      lastSender: username,
    });
  } catch {
    await setDoc(roomRef, {
      name: activeRoomId === DEFAULT_ROOM_ID ? "Global Chat" : activeRoomId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
      lastMessage: messageText.slice(0, 160),
      lastSender: username,
    }, { merge: true });
  }
}

function wireEvents() {
  el.toggleSidebarBtn.addEventListener("click", () => {
    el.sidebar.classList.toggle("show");
  });

  el.saveUsernameBtn.addEventListener("click", () => {
    const name = (el.usernameInput.value || "").trim();
    if (!name) return;
    setUsername(name);
    closeUsernameModal();

    listenToRooms();
    if (pendingDirectTarget) {
      const t = pendingDirectTarget;
      pendingDirectTarget = null;
      openDirectChat(t).catch(console.error);
    }
  });

  el.usernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      el.saveUsernameBtn.click();
    }
  });

  el.changeNameBtn.addEventListener("click", () => {
    openUsernameModal();
  });

  el.newRoomBtn.addEventListener("click", () => {
    createRoomFlow();
  });

  el.roomSearch.addEventListener("input", () => {
    el.rooms.dispatchEvent(new Event("rooms:filter"));
  });

  el.composer.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = el.messageInput.value;
    el.messageInput.value = "";
    el.messageInput.focus();
    try {
      await sendMessage(text);
    } catch (err) {
      console.error(err);
      alert(friendlyFirebaseError(err));
    }
  });
}

function listenToRooms() {
  if (unsubscribeRooms) unsubscribeRooms();

  const myNorm = normalizeUsername(getUsername());
  const roomsRef = collection(db, "chatRooms");
  let cachedRooms = [];
  const rerender = () => renderRooms(cachedRooms, activeRoomId, el.roomSearch.value);

  if (!roomsFilterWired) {
    el.rooms.addEventListener("rooms:filter", rerender);
    roomsFilterWired = true;
  }

  if (!myNorm) {
    cachedRooms = [
      {
        id: DEFAULT_ROOM_ID,
        name: "Global Chat",
        displayName: "Global Chat",
        lastMessage: "",
        updatedAtDate: null,
      },
    ];
    rerender();
    return;
  }

  const indexedQuery = query(roomsRef, where("participants", "array-contains", myNorm), orderBy("updatedAt", "desc"), limit(50));
  const fallbackQuery = query(roomsRef, where("participants", "array-contains", myNorm), limit(100));
  let fallbackUsed = false;

  const hydrateRooms = (snapshot) => {
    const rooms = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const updatedAt = toDateSafe(data?.updatedAt, data?.updatedAtMs);

      let displayName = data?.name || docSnap.id;
      if (data?.type === "dm" && myNorm) {
        displayName = getDmOtherDisplay(data, myNorm);
      }

      rooms.push({
        id: docSnap.id,
        name: data?.name || docSnap.id,
        displayName,
        lastMessage: data?.lastMessage || "",
        updatedAtDate: updatedAt,
      });
    });

    rooms.sort((a, b) => toMillisSafe(b.updatedAtDate, 0) - toMillisSafe(a.updatedAtDate, 0));

    if (!rooms.some((r) => r.id === DEFAULT_ROOM_ID)) {
      rooms.unshift({
        id: DEFAULT_ROOM_ID,
        name: "Global Chat",
        displayName: "Global Chat",
        lastMessage: "",
        updatedAtDate: null,
      });
    }

    cachedRooms = rooms;
    rerender();
  };

  unsubscribeRooms = onSnapshot(
    indexedQuery,
    (snapshot) => {
      hydrateRooms(snapshot);
    },
    (err) => {
      console.error("Rooms listener error:", err);
      if (!isIndexError(err) || fallbackUsed) {
        alert(friendlyFirebaseError(err));
        return;
      }

      fallbackUsed = true;
      unsubscribeRooms = onSnapshot(
        fallbackQuery,
        (snapshot) => {
          hydrateRooms(snapshot);
        },
        (fallbackErr) => {
          console.error("Fallback rooms listener error:", fallbackErr);
          alert(friendlyFirebaseError(fallbackErr));
        }
      );
    }
  );
}

async function init() {
  wireEvents();
  await ensureSignedIn();
  await ensureRoom(DEFAULT_ROOM_ID, "Global Chat");

  const directTarget = getDirectTargetFromUrl();
  if (!getUsername()) {
    if (directTarget) pendingDirectTarget = directTarget;
    openUsernameModal();
  }

  listenToRooms();

  if (directTarget) {
    await openDirectChat(directTarget);
  } else {
    setRoomHeader("Global Chat", "Saved to Firebase – all users (username-based)");
    await setActiveRoom(DEFAULT_ROOM_ID);
  }
}

init().catch((err) => {
  console.error(err);
  alert(friendlyFirebaseError(err) || "Chat failed to load");
});
