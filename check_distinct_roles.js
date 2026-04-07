const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../bot/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoles() {
    console.log("Fetching distinct roles from users table...");
    const { data, error } = await supabase.from('users').select('role');
    
    if (error) {
        console.error("Error fetching roles:", error.message);
        return;
    }
    
    const roles = [...new Set(data.map(u => u.role))];
    console.log("Current distinct roles:", roles);
}

checkRoles();
