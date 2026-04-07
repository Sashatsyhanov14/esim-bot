const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../bot/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraints() {
    console.log("Attempting to detect role constraints...");
    
    // We can try to update and catch the specific error message
    // Most 'check constraint' errors include the constraint name or allowed values.
    
    const { data: user } = await supabase.from('users').select('*').limit(1).single();
    if (!user) {
        console.log("No users found to test with.");
        return;
    }
    
    console.log(`Testing 'admin' role update on user ${user.telegram_id}...`);
    const { error } = await supabase.from('users').update({ role: 'admin' }).eq('telegram_id', user.telegram_id);
    
    if (error) {
        console.error("FAILED TO RECORD 'admin' ROLE.");
        console.error("Error Hint:", error.hint);
        console.error("Error Message:", error.message);
        console.error("Details:", error.details);
    } else {
        console.log("SUCCESS: 'admin' role is allowed by DB.");
        await supabase.from('users').update({ role: user.role }).eq('telegram_id', user.telegram_id);
    }
}

checkConstraints();
