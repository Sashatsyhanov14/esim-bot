
require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Could not find Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTariffs() {
    const { data, error } = await supabase.from('tariffs').select('*').order('sort_number', { ascending: true });
    if (error) {
        console.error(error);
        return;
    }

    console.log('--- ALL TARIFFS IN DATABASE ---');
    console.log('Total count:', data.length);
    
    // Grouping to find potential duplicates
    const counts = {};
    
    data.forEach(t => {
        const key = `${t.country}|${t.country_ru}|${t.data_gb}|${t.validity_period}`;
        counts[key] = (counts[key] || 0) + 1;
        
        console.log(`ID: ${t.id}`);
        console.log(`  Sort: ${t.sort_number} | Country: "${t.country}" | RU: "${t.country_ru}"`);
        console.log(`  Data: "${t.data_gb}" | Period: "${t.validity_period}" | Price: $${t.price_usd} / ₽${t.price_rub || '-'}`);
        console.log(`  Active: ${t.is_active} | Created: ${t.created_at}`);
        console.log('-----------------------------------');
    });

    console.log('\n--- POTENTIAL DUPLICATES (Same Country/Data/Period) ---');
    Object.keys(counts).forEach(key => {
        if (counts[key] > 1) {
            console.log(`DUPLICATE FOUND (${counts[key]} times): ${key}`);
        }
    });
}

checkTariffs();
