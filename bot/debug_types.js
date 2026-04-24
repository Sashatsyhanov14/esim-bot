const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    const { data: users, error } = await supabase.from('users').select('telegram_id, referrer_id, role').limit(10);
    if (error) {
        console.error("Error:", error.message);
        return;
    }
    console.log("Users sample:");
    users.forEach(u => {
        console.log(`ID: ${u.telegram_id} (${typeof u.telegram_id}), Ref: ${u.referrer_id} (${typeof u.referrer_id}), Role: ${u.role}`);
    });
}

debug();
