const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = {
  supabase,

  async getUser(telegramId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    return { data, error };
  },

  async createUser(user) {
    const { data, error } = await supabase
      .from('users')
      .insert([user])
      .select()
      .single();
    return { data, error };
  },

  async getTariffs() {
    const { data, error } = await supabase
      .from('tariffs')
      .select('id, sort_number, country, data_gb, validity_period, price_usd, payment_link, payment_qr_url')
      .eq('is_active', true)
      .order('sort_number', { ascending: true }); // Отвечаем в отсортированном порядке, если есть
    return { data, error };
  },

  async saveMessage(userId, role, content) {
    const { error } = await supabase
      .from('chat_history')
      .insert([{ user_id: userId, role, content }]);
    return { error };
  },

  async getHistory(userId, limit = 10) {
    const { data, error } = await supabase
      .from('chat_history')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return { data: (data || []).reverse(), error };
  },

  async createOrder(userId, tariffId) {
    const { data, error } = await supabase
      .from('orders')
      .insert([{ user_id: userId, tariff_id: tariffId, status: 'pending' }])
      .select()
      .single();
    return { data, error };
  }
};
