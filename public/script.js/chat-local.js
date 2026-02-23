import { database } from "../firebase-config.js";
import { listGirls } from "../30pagesofgirls/girls-data.js";
import { listGirls as listBoys } from "../30pagesofboys/girls-data.js";
import {
  equalTo,
  get,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  set,
  update,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";

const IDENTITY_KEY = "vivah_chat_identity";
const RECENTS_KEY = "vivah_chat_recents_v1";
const MAX_RECENTS = 25;
const GLOBAL_ROOM_ID = "global";

const el = {
  chatTitle: document.getElementById("chatTitle"),
  chatSubtitle: document.getElementById("chatSubtitle"),
  chatAvatarImg: document.getElementById("chatAvatarImg"),
  chatAvatarFallback: document.getElementById("chatAvatarFallback"),
  errorBanner: document.getElementById("errorBanner"),
  messages: document.getElementById("messages"),
  composer: document.getElementById("composer"),
  messageInput: document.getElementById("messageInput"),
  sendBtn: document.getElementById("sendBtn"),
  deleteChatBtn: document.getElementById("deleteChatBtn"),
  loginOverlay: document.getElementById("loginOverlay"),
  identityInput: document.getElementById("identityInput"),
  saveIdentityBtn: document.getElementById("saveIdentityBtn"),
  chatList: document.getElementById("chatList"),
};

const FEMALE_CONTACTS = listGirls();
const MALE_CONTACTS = listBoys();
const CONTACTS = [
  ...FEMALE_CONTACTS.map((c) => ({ ...c, _gender: "female" })),
  ...MALE_CONTACTS.map((c) => ({ ...c, _gender: "male" })),
];

let activeRoomId = GLOBAL_ROOM_ID;
let activeRoomName = "Global Chat";
let activeReceiverName = "Global";
let activeReceiverGender = "male";
let activeTarget = null;
let unsubscribeMessages = null;
let lastAutoReply = "";

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function safeId(value) {
  const out = normalize(value).replace(/[^a-z0-9]+/g, "_").replace(/(^_+|_+$)/g, "").slice(0, 40);
  return out || "user";
}

function keyify(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function readRecents() {
  const raw = localStorage.getItem(RECENTS_KEY);
  const parsed = safeJsonParse(raw || "[]", []);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => ({
      to: String(item?.to || "").trim(),
      name: String(item?.name || "").trim(),
      gender: String(item?.gender || "").trim().toLowerCase(),
      preview: String(item?.preview || "").trim(),
      updatedAt: Number(item?.updatedAt || 0) || 0,
    }))
    .filter((item) => item.to || item.name)
    .slice(0, MAX_RECENTS);
}

function writeRecents(items) {
  const safe = Array.isArray(items) ? items.slice(0, MAX_RECENTS) : [];
  localStorage.setItem(RECENTS_KEY, JSON.stringify(safe));
}

function recentKey(item) {
  return keyify(item?.to || item?.name);
}

function upsertRecent(target, patch = {}) {
  if (!target) return;
  const base = {
    to: String(target.to || "").trim(),
    name: String(target.name || target.to || "").trim(),
    gender: String(target.gender || "").trim().toLowerCase(),
  };
  if (!base.to && !base.name) return;

  const items = readRecents();
  const key = recentKey(base);
  const next = items.filter((x) => recentKey(x) !== key);
  next.unshift({
    ...base,
    ...patch,
    updatedAt: Number(patch.updatedAt || Date.now()) || Date.now(),
  });
  writeRecents(next);
}

function updateUrlForTarget(target) {
  const params = new URLSearchParams(window.location.search);
  if (target?.to) params.set("to", target.to);
  if (target?.name) params.set("name", target.name);
  if (target?.gender) params.set("gender", target.gender);
  window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
}

function avatarLetter(name) {
  return (String(name || "?") || "?").trim().charAt(0).toUpperCase() || "?";
}

function renderChatList() {
  if (!el.chatList) return;

  const items = readRecents();
  const activeKey = activeTarget ? recentKey(activeTarget) : "";

  el.chatList.innerHTML = items
    .map((c) => {
      const name = c.name || c.to || "Unknown";
      const photo = findContactPhoto(c);
      const isActive = activeKey && recentKey(c) === activeKey;
      const preview = c.preview || "";

      const avatar = photo
        ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(name)}" />`
        : `<span class="placeholder">${escapeHtml(avatarLetter(name))}</span>`;

      return `
        <div class="chat-item ${isActive ? "active" : ""}" data-to="${escapeHtml(c.to)}" data-name="${escapeHtml(name)}" data-gender="${escapeHtml(c.gender || "")}">
          <div class="chat-avatar dp">${avatar}</div>
          <div style="min-width:0;">
            <div class="name">${escapeHtml(name)}</div>
            <div class="preview">${escapeHtml(preview || "")}</div>
          </div>
        </div>`;
    })
    .join("");

  // If no recents, keep sidebar empty (matches requested UX)
  if (!items.length) {
    el.chatList.innerHTML = "";
  }
}

function toChatImagePath(photoPath) {
  const raw = String(photoPath || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.replace(/^\.\.\//, "./");
}

function findContactPhoto(target) {
  if (!target) return "";
  const keys = new Set([
    keyify(target.name),
    keyify(target.to),
    keyify(String(target.to || "").replace(/^example[-_]?/, "")),
  ]);

  for (const c of CONTACTS) {
    if (keys.has(keyify(c?.name)) || keys.has(keyify(c?.slug)) || keys.has(keyify(c?.username))) {
      return toChatImagePath(c?.photo || c?.profilePhoto || c?.gallery?.[0]);
    }
  }

  return "";
}

function getIdentity() {
  const fromLocal = (localStorage.getItem(IDENTITY_KEY) || "").trim();
  if (fromLocal) return fromLocal;
  const fromName = (localStorage.getItem("vivah_name") || "").trim();
  if (fromName) return fromName;
  const fromUsername = (localStorage.getItem("vivah_username") || "").trim();
  if (fromUsername) return fromUsername;

  try {
    const user = JSON.parse(localStorage.getItem("firebaseUser") || "null");
    return (user?.displayName || user?.email || "").trim();
  } catch {
    return "";
  }
}

function setIdentity(value) {
  localStorage.setItem(IDENTITY_KEY, String(value || "").trim());
}

function getTargetFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const to = (params.get("to") || params.get("user") || params.get("username") || "").trim();
  const name = (params.get("name") || "").trim();
  const gender = (params.get("gender") || "").trim().toLowerCase();
  if (!to) return null;
  return { to, name: name || to, gender };
}

function resolveReceiverGender(target) {
  if (!target) return "male";

  if (target.gender === "female" || target.gender === "male") {
    return target.gender;
  }

  const keys = new Set([
    keyify(target.name),
    keyify(target.to),
    keyify(String(target.to || "").replace(/^example[-_]?/, "")),
  ]);

  for (const c of CONTACTS) {
    if (keys.has(keyify(c?.name)) || keys.has(keyify(c?.slug)) || keys.has(keyify(c?.username))) {
      return c?._gender || "male";
    }
  }

  return "male";
}

function isHobbiesQuestion(text) {
  const s = normalize(text);
  if (!s) return false;

  const keywords = [
    "hobby",
    "hobbies",
    "what are your hobbies",
    "what is your hobby",
    "your hobbies",
    "your hobby",
  ];

  return keywords.some((word) => s.includes(word));
}

function hobbiesReplyByGender(gender) {
  return gender === "female"
    ? "My hobbies are dancing and painting"
    : "My hobbies are cricket and football";
}

function pickNonRepeatingReply(replies) {
  if (!Array.isArray(replies) || !replies.length) return "Okay 🙂";

  const pool = replies.filter((text) => text !== lastAutoReply);
  const source = pool.length ? pool : replies;
  const picked = source[Math.floor(Math.random() * source.length)];
  lastAutoReply = picked;
  return picked;
}

function buildRuleBasedReply(userText) {
  const text = normalize(userText);

  if (isHobbiesQuestion(text)) {
    return hobbiesReplyByGender(activeReceiverGender);
  }

  const friendlyReplies = [
    "That's interesting, tell me more!",
    "Really? I'd love to know more.",
    "Haha nice 🙂",
    "Why do you think that?",
  ];

  if (text.includes("hi") || text.includes("hello") || text.includes("hey")) {
    return pickNonRepeatingReply([
      "Hey! Nice to hear from you 🙂",
      "Hi there! What's up?",
      "Hello! How's your day going?",
    ]);
  }

  if (text.includes("how are you")) {
    return pickNonRepeatingReply([
      "I'm doing great, thanks for asking!",
      "All good here 🙂 How about you?",
      "I'm good! Tell me about your day.",
    ]);
  }

  if (text.includes("why") || text.endsWith("?")) {
    return pickNonRepeatingReply([
      "Why do you think that?",
      "That's a good question.",
      "Interesting question — what do you feel?",
    ]);
  }

  return pickNonRepeatingReply(friendlyReplies);
}

async function maybeAutoReply(userText, sender) {
  if (activeRoomId === GLOBAL_ROOM_ID) return;

  const reply = buildRuleBasedReply(userText);
  const botRef = push(ref(database, "chat"));
  await set(botRef, {
    text: reply,
    sender: activeReceiverName,
    receiver: sender,
    timestamp: Date.now(),
    roomId: activeRoomId,
    unsent: false,
    bot: true,
  });
}

function makeDirectRoomId(a, b) {
  const x = safeId(a);
  const y = safeId(b);
  return x < y ? `dm_${x}__${y}` : `dm_${y}__${x}`;
}

function resolveRoomContext(identity) {
  const target = getTargetFromUrl();
  const me = normalize(identity);
  const to = normalize(target?.to);

  if (!target || !to || to === me) {
    return {
      roomId: GLOBAL_ROOM_ID,
      roomName: "Global Chat",
      receiver: "Global",
      target: null,
    };
  }

  return {
    roomId: makeDirectRoomId(identity, target.name || target.to),
    roomName: `Chat with ${target.name || target.to}`,
    receiver: target.name || target.to,
    target,
  };
}

function showError(message = "") {
  if (!message) {
    el.errorBanner.style.display = "none";
    el.errorBanner.textContent = "";
    return;
  }
  el.errorBanner.style.display = "block";
  el.errorBanner.textContent = message;
}

function formatTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

function clearMessagesToEmptyState() {
  el.messages.innerHTML = `<div class="empty-state">No messages yet. Start the conversation 👋</div>`;
}

function setHeader(ctx) {
  const contactName = ctx.target?.name || "Global Chat";
  const firstChar = (contactName || "G").trim().charAt(0).toUpperCase() || "G";
  const photo = findContactPhoto(ctx.target);

  if (el.chatAvatarImg) {
    if (photo) {
      el.chatAvatarImg.src = photo;
      el.chatAvatarImg.style.display = "block";
      if (el.chatAvatarFallback) el.chatAvatarFallback.style.display = "none";
    } else {
      el.chatAvatarImg.removeAttribute("src");
      el.chatAvatarImg.style.display = "none";
      if (el.chatAvatarFallback) el.chatAvatarFallback.style.display = "inline-block";
    }
  }

  if (ctx.target?.name) {
    el.chatTitle.textContent = `Chat with ${ctx.target.name}`;
    el.chatSubtitle.textContent = "Realtime • Firebase Realtime Database";
    return;
  }

  el.chatTitle.textContent = "Global Chat";
  el.chatSubtitle.textContent = "Realtime • Firebase Realtime Database";
}

function renderMessages(items, myIdentity) {
  if (!items.length) {
    clearMessagesToEmptyState();
    return;
  }

  const mine = normalize(myIdentity);
  el.messages.innerHTML = items
    .map((item) => {
      const sender = item.sender || "Unknown";
      const isMe = normalize(sender) === mine;
      const time = formatTime(item.timestamp);
      const isUnsent = Boolean(item.unsent);
      const shownText = isUnsent ? (isMe ? "You unsent a message." : "This message was unsent.") : (item.text || "");
      const unsendBtn = isMe && !isUnsent
        ? `<button type="button" class="msg-action" data-action="unsend" data-id="${escapeHtml(item.id || "")}">Unsend</button>`
        : "";
      const messageId = escapeHtml(item.id || "");

      return `
      <div class="msg-row ${isMe ? "me" : ""}">
        <article class="bubble">
          <div class="meta">
            <span>${escapeHtml(sender)}</span>
            <span>${escapeHtml(time)}</span>
          </div>
          <div class="text ${isUnsent ? "unsent-label" : ""}">${escapeHtml(shownText)}</div>
          <div class="msg-actions">
            <button type="button" class="msg-menu-toggle" data-action="toggle-menu" data-id="${messageId}" aria-label="Message options">⋮</button>
            <div class="msg-menu-panel" data-menu-for="${messageId}">
              ${unsendBtn}
              <button type="button" class="msg-action delete" data-action="delete" data-id="${messageId}">Delete</button>
            </div>
          </div>
        </article>
      </div>`;
    })
    .join("");

  const last = items[items.length - 1];
  if (last && activeTarget) {
    const previewText = `${last.sender || "User"}: ${(last.unsent ? "message unsent" : (last.text || "")).slice(0, 44)}`;
    upsertRecent(activeTarget, { preview: previewText, updatedAt: Number(last.timestamp || Date.now()) });
    renderChatList();
  }
  el.messages.scrollTop = el.messages.scrollHeight;
}

function subscribeToRoom(roomId) {
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }

  const q = query(ref(database, "chat"), orderByChild("roomId"), equalTo(roomId));
  unsubscribeMessages = onValue(
    q,
    (snapshot) => {
      const value = snapshot.val() || {};
      const rows = Object.entries(value)
        .map(([id, data]) => ({ id, ...(data || {}) }))
        .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
      renderMessages(rows, getIdentity());
      showError("");
    },
    (err) => {
      console.error(err);
      showError(err?.message || "Failed to fetch messages in realtime.");
    }
  );
}

async function sendMessage() {
  const sender = getIdentity();
  const text = (el.messageInput.value || "").trim();

  if (!sender) {
    openLoginOverlay();
    return;
  }
  if (!text) {
    showError("Please type a message before sending.");
    return;
  }

  el.sendBtn.disabled = true;
  try {
    const newRef = push(ref(database, "chat"));
    await set(newRef, {
      text,
      sender,
      receiver: activeReceiverName,
      timestamp: Date.now(),
      roomId: activeRoomId,
      unsent: false,
    });

    if (activeTarget) {
      upsertRecent(activeTarget, { preview: `You: ${text.slice(0, 44)}`, updatedAt: Date.now() });
      renderChatList();
    }

    window.setTimeout(() => {
      maybeAutoReply(text, sender).catch((err) => {
        console.error(err);
      });
    }, 600);

    el.messageInput.value = "";
    el.messageInput.focus();
    showError("");
  } catch (err) {
    console.error(err);
    showError(err?.message || "Failed to send message.");
  } finally {
    el.sendBtn.disabled = false;
  }
}

async function deleteMessage(messageId) {
  await remove(ref(database, `chat/${messageId}`));
}

async function unsendMessage(messageId) {
  await update(ref(database, `chat/${messageId}`), {
    text: "",
    unsent: true,
  });
}

async function deleteCurrentRoomMessages() {
  const q = query(ref(database, "chat"), orderByChild("roomId"), equalTo(activeRoomId));
  const snap = await get(q);
  const value = snap.val() || {};
  const ids = Object.keys(value);
  await Promise.all(ids.map((id) => remove(ref(database, `chat/${id}`))));
}

function openLoginOverlay() {
  el.identityInput.value = getIdentity();
  el.loginOverlay.style.display = "flex";
  setTimeout(() => el.identityInput.focus(), 0);
}

function closeLoginOverlay() {
  el.loginOverlay.style.display = "none";
}

async function setupRoom() {
  const identity = getIdentity();
  if (!identity) {
    openLoginOverlay();
    return;
  }

  const ctx = resolveRoomContext(identity);
  activeRoomId = ctx.roomId;
  activeRoomName = ctx.roomName;
  activeReceiverName = ctx.receiver;
  activeReceiverGender = resolveReceiverGender(ctx.target);
  activeTarget = ctx.target;

  if (activeTarget) {
    upsertRecent(activeTarget);
  }
  renderChatList();

  setHeader(ctx);
  subscribeToRoom(activeRoomId);
}

async function saveCredentialsAndEnterRoom() {
  const identity = (el.identityInput.value || "").trim();
  if (!identity) {
    showError("Username/email cannot be empty.");
    return;
  }
  setIdentity(identity);
  closeLoginOverlay();
  await setupRoom();
}

function wireEvents() {
  el.chatList?.addEventListener("click", async (event) => {
    const item = event.target.closest(".chat-item");
    if (!item) return;
    const to = item.getAttribute("data-to") || "";
    const name = item.getAttribute("data-name") || "";
    const gender = item.getAttribute("data-gender") || "";
    if (!to && !name) return;

    updateUrlForTarget({ to, name, gender });
    await setupRoom();
  });

  el.composer.addEventListener("submit", async (event) => {
    event.preventDefault();
    await sendMessage();
  });

  el.saveIdentityBtn.addEventListener("click", async () => {
    await saveCredentialsAndEnterRoom();
  });

  el.identityInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    el.saveIdentityBtn.click();
  });

  el.messages.addEventListener("click", async (event) => {
    const toggle = event.target.closest(".msg-menu-toggle");
    if (toggle) {
      const panel = toggle.parentElement?.querySelector(".msg-menu-panel");
      const willOpen = !panel?.classList.contains("open");
      el.messages.querySelectorAll(".msg-menu-panel.open").forEach((node) => node.classList.remove("open"));
      if (willOpen && panel) panel.classList.add("open");
      return;
    }

    const actionNode = event.target.closest(".msg-action");
    if (!actionNode) return;
    const action = actionNode.getAttribute("data-action");
    const id = actionNode.getAttribute("data-id");
    if (!id) return;

    el.messages.querySelectorAll(".msg-menu-panel.open").forEach((node) => node.classList.remove("open"));
    try {
      if (action === "delete") await deleteMessage(id);
      if (action === "unsend") await unsendMessage(id);
    } catch (err) {
      showError(err?.message || "Action failed.");
    }
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest(".msg-actions")) return;
    el.messages.querySelectorAll(".msg-menu-panel.open").forEach((node) => node.classList.remove("open"));
  });

  el.deleteChatBtn?.addEventListener("click", async () => {
    const ok = window.confirm(`Delete all messages in ${activeRoomName}?`);
    if (!ok) return;
    try {
      await deleteCurrentRoomMessages();
    } catch (err) {
      showError(err?.message || "Unable to delete chat.");
    }
  });
}

async function init() {
  wireEvents();
  clearMessagesToEmptyState();
  renderChatList();
  await setupRoom();
}

init().catch((err) => {
  console.error(err);
  showError(err?.message || "Failed to initialize chat.");
});
