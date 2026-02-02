const supabase = require('../../core/db/supabase');

exports.listThreads = async (userId) => {
  const { data, error } = await supabase
    .from('threads')
    .select('*')
    .or(`user_low.eq.${userId},user_high.eq.${userId}`)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

exports.upsertThread = async ({ tripId, user_low, user_high }) => {
  const { data, error } = await supabase
    .from('threads')
    .upsert({ trip_id: tripId, user_low, user_high }, { onConflict: 'trip_id,user_low,user_high' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

exports.getThreadById = async (id) => {
  const { data, error } = await supabase
    .from('threads')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
};

exports.listMessages = async (threadId) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

exports.insertMessage = async ({ threadId, senderId, text }) => {
  const { data, error } = await supabase
    .from('messages')
    .insert({ thread_id: threadId, sender_id: senderId, text })
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

exports.updateLastMessage = async ({ threadId, lastMessage }) => {
  const { error } = await supabase
    .from('threads')
    .update({ last_message: lastMessage })
    .eq('id', threadId);

  if (error) throw error;
};
