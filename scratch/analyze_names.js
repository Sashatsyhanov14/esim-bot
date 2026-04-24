
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../bot/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
    console.error('Missing SUPABASE_URL');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.from('tariffs').select('*');
    if (error) {
        console.error(error);
    } else {
        const sorted = data.sort((a, b) => b.country.length - a.country.length);
        console.log("Top 5 Longest Names:");
        sorted.slice(0, 5).forEach(t => console.log(`${t.country.length}: ${t.country}`));
        
        const russian = data.filter(t => /[а-яА-Я]/.test(t.country));
        console.log("\nRussian Names:");
        russian.forEach(t => console.log(`${t.country}`));
    }
}

run();
