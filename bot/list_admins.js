const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAdmins() {
    console.log("Fetching users with potential admin/manager roles...");
    const { data, error } = await supabase
        .from('users')
        .select('telegram_id, username, role')
        .in('role', ['founder', 'admin', 'manager', 'user']);
    
    if (error) {
        console.error("Error:", error.message);
        return;
    }
    
    console.log("Users found:");
    console.table(data);
}

listAdmins();
