const repo = require('./inbox.repo');
const supabase = require('../../core/db/supabase');
// ✅ Notification tizimini ulaymiz
const notifRepo = require('../notifications/notifications.repo');
const { sendToToken } = require('../../core/fcm');

function normalizePair(a, b) {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

async function fetchNames(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', ids);

  if (error) return {};
  const map = {};
  for (const r of data || []) map[r.user_id] = r.display_name;
  return map;
}

// ✅ Yordamchi funksiya: Push yuborish
async function notifyReceiver(senderId, receiverId, text, threadId) {
  try {
    // 1. Qabul qiluvchining tokenlarini olamiz
    const { data: tokens } = await notifRepo.listDeviceTokens(receiverId);
    if (!tokens || tokens.length === 0) return;

    // 2. Yuboruvchining ismini olamiz (Chiroyli ko'rinishi uchun)
    const nameMap = await fetchNames([senderId]);
    const senderName = nameMap[senderId] || "Foydalanuvchi";

    // 3. Har bir tokeniga push yuboramiz
    const payload = {
      title: senderName, // Masalan: "Jasur"
      body: text,        // Masalan: "Qayerdasiz?"
      notification_id: Date.now().toString(),
      thread_id: threadId,
      type: "CHAT_MESSAGE"
    };

    // Parallel yuborish (tez ishlashi uchun)
    const promises = tokens.map(t => sendToToken(t.token, payload));
    await Promise.allSettled(promises);

    console.log(`🔔 Push sent to ${receiverId} from ${senderId}`);
  } catch (e) {
    console.error("⚠️ Push yuborishda xatolik:", e.message);
    // Xato bo'lsa ham kod to'xtab qolmaydi, chunki bu fon jarayoni
  }
}

exports.listThreads = async (userId) => {
  const rows = await repo.listThreads(userId);
  const otherIds = rows.map(t => (t.user_low === userId ? t.user_high : t.user_low));
  const names = await fetchNames([...new Set(otherIds)]);

  return rows.map(t => {
    const otherId = (t.user_low === userId ? t.user_high : t.user_low);
    return {
      id: t.id,
      tripId: t.trip_id,
      otherUserId: otherId,
      otherUserName: names[otherId] || null,
      lastMessage: t.last_message || null,
      updatedAt: t.updated_at
    };
  });
};

exports.createThread = async ({ userId, peerId, tripId }) => {
  const p = normalizePair(userId, peerId);
  const thread = await repo.upsertThread({ tripId, user_low: p.low, user_high: p.high });
  return thread;
};

exports.getThread = async ({ userId, threadId }) => {
  const thread = await repo.getThreadById(threadId);
  if (!thread) throw new Error('Thread not found');

  const isMember = (thread.user_low === userId || thread.user_high === userId);
  if (!isMember) {
    const err = new Error('Bu thread sizniki emas');
    err.code = 'FORBIDDEN';
    throw err;
  }

  const messages = await repo.listMessages(threadId);
  return { thread, messages };
};

exports.sendMessage = async ({ userId, threadId, text }) => {
  const thread = await repo.getThreadById(threadId);
  if (!thread) throw new Error('Thread not found');

  const isMember = (thread.user_low === userId || thread.user_high === userId);
  if (!isMember) {
    const err = new Error('Bu thread sizniki emas');
    err.code = 'FORBIDDEN';
    throw err;
  }

  // 1. Xabarni bazaga yozamiz
  const msg = await repo.insertMessage({ threadId, senderId: userId, text });

  // 2. Threadni yangilaymiz (last_message)
  await repo.updateLastMessage({ threadId, lastMessage: text });

  // ✅ 3. SENIOR FIX: Notification yuboramiz (Fire-and-Forget)
  // Biz buni 'await' qilmaymiz, foydalanuvchi javobni kutib o'tirmasligi uchun.
  const receiverId = (thread.user_low === userId ? thread.user_high : thread.user_low);
  notifyReceiver(userId, receiverId, text, threadId);

  return msg;
};