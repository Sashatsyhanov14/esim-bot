
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Try to find supabase credentials in webapp/.env or bot/.env
let supabaseUrl, supabaseKey;

const webappEnv = fs.readFileSync('webapp/.env', 'utf8');
const urlMatch = webappEnv.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = webappEnv.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

if (urlMatch) supabaseUrl = urlMatch[1].trim();
if (keyMatch) supabaseKey = keyMatch[1].trim();

if (!supabaseUrl || !supabaseKey) {
    console.error('Could not find Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTariffs() {
    const { data, error } = await supabase.from('tariffs').select('*').order('sort_number', { ascending: true });
    if (error) {
        console.error(error);
        return;
    }

    console.log('--- Tariffs Data ---');
    data.forEach(t => {
        console.log(`ID: ${t.id} | Sort: ${t.sort_number} | Country: "${t.country}" | RU: "${t.country_ru}" | Data: ${t.data_gb} | Active: ${t.is_active}`);
    });
}

checkTariffs();
