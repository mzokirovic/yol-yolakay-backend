const repo = require('./inbox.repo');
const supabase = require('../../core/db/supabase');

function normalizePair(a, b) {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

async function fetchNames(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', ids);

  if (error) return {}; // profiles bo‘lmasa ham ishlayversin
  const map = {};
  for (const r of data || []) map[r.user_id] = r.display_name;
  return map;
}

exports.listThreads = async (userId) => {
  const rows = await repo.listThreads(userId);

  // otherId lar
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

  const msg = await repo.insertMessage({ threadId, senderId: userId, text });
  await repo.updateLastMessage({ threadId, lastMessage: text });
  return msg;
};
