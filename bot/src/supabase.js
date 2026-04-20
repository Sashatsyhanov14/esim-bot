const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const crypto = require('crypto');

module.exports = {
  supabase,

  async getUser(telegramId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();
      
      if (error) {
        // If columns are missing (e.g. before migration), return defaults instead of crashing
        if (error.code === '42703') {
           console.warn(`[Supabase] Missing columns in users table, using defaults for ID ${telegramId}`);
           return { data: { telegram_id: telegramId, is_support_mode: false, manager_contact_id: null, waiting_order_id: null }, error: null };
        }
        return { data, error };
      }
      return { data, error };
    } catch (e) {
      console.error('getUser critical error:', e.message);
      return { data: null, error: e };
    }
  },

  async createUser(user) {
    user.created_at = new Date().toISOString();
    if (user.balance === undefined) user.balance = 0;

    const { data, error } = await supabase
      .from('users')
      .insert([user])
      .select()
      .single();

    if (error) console.error("Supabase createUser error:", error.message);
    return { data, error };
  },

  async updateUser(telegramId, updates) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('telegram_id', telegramId)
        .select()
        .single();
      if (error) {
        if (error.code === '42703') {
           console.warn(`[Supabase] Update failed (missing columns):`, updates);
           return { data: null, error: null }; // Silent fail to prevent crash
        }
        console.error("Supabase updateUser error:", error.message);
      }
      return { data, error };
    } catch (e) {
      console.error('updateUser critical error:', e.message);
      return { data: null, error: e };
    }
  },

  async getTariffs() {
    const { data, error } = await supabase
      .from('tariffs')
      .select('*, country, data_gb, validity_period') // Selection * ensures we get all new columns like country_ru, etc.
      .eq('is_active', true)
      .order('sort_number', { ascending: true }); // Отвечаем в отсортированном порядке, если есть
    return { data, error };
  },

  async saveMessage(userId, role, content) {
    const { error } = await supabase
      .from('chat_history')
      .insert([{ id: crypto.randomUUID(), user_id: userId, role, content, created_at: new Date().toISOString() }]);
    if (error) console.error('Supabase saveMessage error:', error.message);
    return { error };
  },

  async clearHistory(userId) {
    const { error } = await supabase
      .from('chat_history')
      .delete()
      .eq('user_id', userId)
      .in('role', ['user', 'assistant'])
      .not('content', 'like', 'PAYOUT_RECORD:%')
      .not('content', 'like', 'COMMISSION_RECORD:%');
    return { error };
  },

  async getHistory(userId, limit = 10) {
    const { data, error } = await supabase
      .from('chat_history')
      .select('role, content')
      .eq('user_id', userId)
      .in('role', ['user', 'assistant'])
      .not('content', 'like', 'PAYOUT_RECORD:%')
      .not('content', 'like', 'COMMISSION_RECORD:%')
      .order('created_at', { ascending: false })
      .limit(limit);

    return { data: (data || []).reverse(), error };
  },

  async getFaq() {
    const { data, error } = await supabase.from('faq').select('*');
    return { data, error };
  },

  async createOrder(userId, tariffId, priceUsd) {
    const orderId = crypto.randomUUID();
    const { data, error } = await supabase
      .from('orders')
      .insert([{ id: orderId, user_id: userId, tariff_id: tariffId, price_usd: priceUsd, status: 'pending', created_at: new Date().toISOString() }])
      .select()
      .single();

    if (error) console.error("Supabase createOrder error:", error.message);
    return { data, error };
  }
};
