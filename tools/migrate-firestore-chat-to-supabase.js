/*
  One-time migration: Firestore chatRooms/messages -> Supabase chat_rooms/chat_messages

  Usage:
    1) npm i firebase-admin
    2) Set env vars:
       FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json
       SUPABASE_URL=...
       SUPABASE_SERVICE_ROLE_KEY=...
    3) node tools/migrate-firestore-chat-to-supabase.js
*/

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { createClient } = require("@supabase/supabase-js");

const servicePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.APP_FIREBASE_SERVICE_ACCOUNT_PATH;
const supabaseUrl = process.env.SUPABASE_URL || process.env.APP_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.APP_SUPABASE_SERVICE_ROLE_KEY;

if (!servicePath || !supabaseUrl || !supabaseKey) {
  console.error(
    "Missing env vars. Required: FIREBASE_SERVICE_ACCOUNT_PATH (or APP_FIREBASE_SERVICE_ACCOUNT_PATH), SUPABASE_URL (or APP_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY (or APP_SUPABASE_SERVICE_ROLE_KEY)"
  );
  process.exit(1);
}

const resolvedServicePath = path.resolve(process.cwd(), servicePath);
if (!fs.existsSync(resolvedServicePath)) {
  console.error(`Service account file not found: ${resolvedServicePath}`);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(resolvedServicePath)),
});

const db = admin.firestore();
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

function toIso(ts, fallbackMs) {
  if (ts && typeof ts.toDate === "function") return ts.toDate().toISOString();
  if (typeof fallbackMs === "number" && Number.isFinite(fallbackMs)) return new Date(fallbackMs).toISOString();
  return new Date().toISOString();
}

async function upsertRoom(roomId, roomData) {
  const payload = {
    id: roomId,
    name: roomData?.name || roomId,
    type: roomData?.type || "group",
    participants: roomData?.participants || [],
    created_at: toIso(roomData?.createdAt, roomData?.createdAtMs),
    updated_at: toIso(roomData?.updatedAt, roomData?.updatedAtMs),
    last_message: roomData?.lastMessage || null,
    last_sender: roomData?.lastSender || null,
  };

  const { error } = await supabase.from("chat_rooms").upsert(payload, { onConflict: "id" });
  if (error) throw error;
}

async function insertMessages(roomId, docs) {
  if (!docs.length) return;

  const rows = docs.map((d) => {
    const v = d.data();
    return {
      room_id: roomId,
      sender: v?.sender || v?.username || "Unknown",
      text: v?.text || v?.message || "",
      created_at: toIso(v?.createdAt, v?.createdAtMs),
    };
  }).filter((r) => r.text.trim().length > 0);

  if (!rows.length) return;

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("chat_messages").insert(chunk);
    if (error) throw error;
  }
}

async function run() {
  console.log("Reading Firestore chatRooms...");
  const roomsSnap = await db.collection("chatRooms").get();
  console.log(`Found rooms: ${roomsSnap.size}`);

  for (const roomDoc of roomsSnap.docs) {
    const roomId = roomDoc.id;
    const roomData = roomDoc.data();

    await upsertRoom(roomId, roomData);

    const messagesSnap = await db.collection("chatRooms").doc(roomId).collection("messages").orderBy("createdAt", "asc").get();
    await insertMessages(roomId, messagesSnap.docs);

    console.log(`Migrated room ${roomId} with ${messagesSnap.size} messages`);
  }

  console.log("Migration complete.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
