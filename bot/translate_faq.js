const { createClient } = require('@supabase/supabase-js');
const { getLocalizedText } = require('./src/openai');
const path = require('path');
const dotenv = require('dotenv');

// Load env from the bot's .env file
dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- FAQ Bulk Translator Starting ---');
    const { data: faqs, error } = await supabase.from('faq').select('*');
    
    if (error) {
        console.error('Error fetching FAQs:', error.message);
        return;
    }

    console.log(`Found ${faqs.length} entries. Scanning for missing translations...`);

    const langs = ['tr', 'en', 'de', 'pl', 'ar', 'fa'];

    for (const faq of faqs) {
        let needsUpdate = false;
        const updates = {};

        for (const lang of langs) {
            const key = `content_${lang}`;
            // If column is empty or still contains Russian (fallback), translate it
            if (!faq[key] || (faq[key] === faq.content_ru && lang !== 'ru')) {
                console.log(`\nLocalizing [${faq.topic}] -> [${lang.toUpperCase()}] (Content)`);
                try {
                    const translated = await getLocalizedText(lang, faq.content_ru);
                    if (translated && translated !== faq.content_ru) {
                        updates[key] = translated;
                        needsUpdate = true;
                        console.log(`✅ Content Success`);
                    }
                } catch (e) {
                    console.error(`❌ Content error:`, e.message);
                }
            }

            // Also localize topic
            const topicKey = `topic_${lang}`;
            if (!faq[topicKey] || (faq[topicKey] === faq.topic && lang !== 'ru')) {
                console.log(`Localizing [${faq.topic}] -> [${lang.toUpperCase()}] (Topic)`);
                try {
                    const translatedTopic = await getLocalizedText(lang, faq.topic);
                    if (translatedTopic && translatedTopic !== faq.topic) {
                        updates[topicKey] = translatedTopic;
                        needsUpdate = true;
                        console.log(`✅ Topic Success`);
                    }
                } catch (e) {
                    console.error(`❌ Topic error:`, e.message);
                }
            }
        }

        if (needsUpdate) {
            console.log(`Saving translations for: ${faq.topic}`);
            const { error: updateError } = await supabase.from('faq').update(updates).eq('id', faq.id);
            if (updateError) {
                console.error(`❌ Save Error:`, updateError.message);
            } else {
                console.log('✅ Updated in Database');
            }
        } else {
            console.log(`Skip [${faq.topic}]: Already translated.`);
        }
    }

    console.log('\n--- Bulk Translation Finished! ---');
    process.exit(0);
}

run();
