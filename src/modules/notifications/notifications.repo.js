const supabase = require('../../core/db/supabase');

async function listByUser(userId, limit = 50) {
  return supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
}

async function markRead(userId, id) {
  return supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('id', id)
    .select()
    .single();
}

async function markAllRead(userId) {
  return supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
}

async function createNotification(payload) {
  // payload: { user_id, type, title, body, trip_id, thread_id, seat_no, meta }
  return supabase
    .from('notifications')
    .insert(payload)
    .select()
    .single();
}

module.exports = {
  listByUser,
  markRead,
  markAllRead,
  createNotification,
};
