// /home/mzokirovic/Desktop/yol-yolakay-backend/src/modules/notifications/notifications.repo.js

const supabase = require('../../core/db/supabase');

async function listByUser(userId, limit = 50) {
  return supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
}

// user_id ni ham tekshiramiz, birov birovning xabarini o'qimasligi uchun
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
  return supabase
    .from('notifications')
    .insert(payload)
    .select()
    .single();
}

// Tokenni saqlash yoki yangilash
async function upsertDeviceToken(userId, token, platform) {
  return supabase
    .from('device_tokens')
    .upsert(
      { user_id: userId, token, platform },
      { onConflict: 'user_id,token' } // Agar bir xil user va token bo'lsa, update qiladi
    );
}

async function listDeviceTokens(userId) {
  return supabase
    .from('device_tokens')
    .select('token')
    .eq('user_id', userId);
}

module.exports = {
  listByUser,
  markRead,
  markAllRead,
  createNotification,
  upsertDeviceToken,
  listDeviceTokens,
};