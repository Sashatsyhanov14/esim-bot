const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, './bot/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraint() {
    console.log("Checking users table constraints...");
    // Try to update a dummy user or just try to update a real user to 'admin' and see the error
    // Better: try to fetch table definition if possible, but simpler is to try update.
    
    const { data: user } = await supabase.from('users').select('*').limit(1).single();
    if (!user) {
        console.log("No users found.");
        return;
    }
    
    console.log(`Checking update for user ${user.telegram_id}...`);
    const { error } = await supabase.from('users').update({ role: 'admin' }).eq('telegram_id', user.telegram_id);
    
    if (error) {
        console.error("ERROR RECORDING ROLE 'admin':", error.message);
        console.error("DETAILED ERROR:", error);
    } else {
        console.log("SUCCESS: 'admin' role recorded! (Maybe it's fixed or no constraint exists)");
        // Rollback
        await supabase.from('users').update({ role: user.role }).eq('telegram_id', user.telegram_id);
    }
}

checkConstraint();
