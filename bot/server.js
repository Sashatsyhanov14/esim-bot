const express = require('express');
const cors = require('cors');
const path = require('path');
const bot = require('./index');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- HELPER: Localization for Tariffs (Simplified: Country Only) ---
const locTariff = (tariff, lang) => {
    const l = lang || 'en';
    const country = (l !== 'en' && tariff[`country_${l}`]) ? tariff[`country_${l}`] : tariff.country;
    return { country, data_gb: tariff.data_gb, validity: tariff.validity_period };
};

// Serve static files from the React app
const webappDistPath = path.join(__dirname, '../webapp/dist');
app.use(express.static(webappDistPath));

// Webhook endpoint (if using webhooks)
app.post('/api/webhook', async (req, res) => {
    try {
        await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).send('Error');
    }
});

// API endpoint to send QR code via bot
app.post('/api/send-qr', async (req, res) => {
    try {
        const { telegram_id } = req.body;
        if (!telegram_id) return res.status(400).json({ error: 'Missing telegram_id' });

        const refLink = `https://t.me/emedeoesimworld_bot?start=${telegram_id}`;

        const caption = `🔗 Link: ${refLink}\n🎁 Promo: ${telegram_id}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(refLink)}`;
        await bot.telegram.sendPhoto(telegram_id, qrUrl, { caption });

        res.json({ success: true });
    } catch (err) {
        console.error('API Send QR Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// API endpoint for WebApp Catalog Purchase
app.post('/api/catalog-buy', async (req, res) => {
    try {
        const { telegramId, tariffId } = req.body;
        if (!telegramId || !tariffId) return res.status(400).json({ error: 'Missing parameters' });

        const { createOrder, getTariffs, supabase } = require('./src/supabase');
        let { data: tariffs } = await getTariffs();
        const tariff = (tariffs || []).find(t => t.id === tariffId);

        if (!tariff) return res.status(404).json({ error: 'Tariff not found' });

        const { data: orderData } = await createOrder(telegramId, tariffId, tariff.price_usd);

        // Fetch managers to notify
        const { data: managers } = await supabase.from('users').select('telegram_id').in('role', ['founder', 'manager']);
        if (managers && managers.length > 0) {
            const { Markup } = require('telegraf');
            
            // Try fetch username
            let username = "User";
            try { 
                const { data: bUser } = await supabase.from('users').select('username').eq('telegram_id', telegramId).single();
                if (bUser && bUser.username) username = bUser.username;
            } catch (e) {}

            for (const manager of managers) {
                try {
                    // Try to get manager's language from DB or default to 'ru' for managers
                    let mLang = 'ru';
                    try {
                        const { data: mUser } = await supabase.from('users').select('lang_code').eq('telegram_id', manager.telegram_id).single();
                        if (mUser && mUser.lang_code) mLang = mUser.lang_code;
                    } catch (e) {}

                    const mlt = locTariff(tariff, mLang);

                    const alertTexts = {
                        ru: {
                            text: `🚀 **ЗАКАЗ (КАТАЛОГ WebApp)!**\n\nЮзер: @${username} (ID: ${telegramId})\nТариф: ${mlt.country} | ${mlt.data_gb} на ${mlt.validity}\nЦена: $${tariff.price_usd}\n\n⚠️ ВАЖНО: Подтвердите оплату перед тем как скидывать eSIM-код!`,
                            btn: '📤 Отправить eSIM (Код/Ссылка)'
                        },
                        tr: {
                            text: `🚀 **SİPARİŞ (KATALOG WebApp)!**\n\nKullanıcı: @${username} (ID: ${telegramId})\nTarife: ${mlt.country} | ${mlt.data_gb} - ${mlt.validity}\nFiyat: $${tariff.price_usd}\n\n⚠️ ÖNEMLİ: Ödeme onayından sonra gönderin!`,
                            btn: '📤 eSIM Gönder'
                        },
                        en: {
                            text: `🚀 **ORDER (CATALOG WebApp)!**\n\nUser: @${username} (ID: ${telegramId})\nPlan: ${mlt.country} | ${mlt.data_gb} for ${mlt.validity}\nPrice: $${tariff.price_usd}\n\n⚠️ IMPORTANT: Verify payment before sending!`,
                            btn: '📤 Send eSIM (Code/Link)'
                        }
                    };

                    const mt = alertTexts[mLang] || alertTexts['en'];

                    const buttons = (orderData && orderData.id) 
                        ? Markup.inlineKeyboard([[Markup.button.callback(mt.btn, `sendqr_${orderData.id}`)]]) 
                        : {};
                    await bot.telegram.sendMessage(manager.telegram_id, mt.text, buttons);
                } catch (e) {}
            }
        }

        res.json({ success: true, orderId: orderData?.id });
    } catch (err) {
        console.error('Catalog Buy API Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// API endpoint to translate text (for Admin Panel Auto-translate)
app.post('/api/translate', async (req, res) => {
    try {
        const { text, targetLang } = req.body;
        if (!text || !targetLang) return res.status(400).json({ error: 'Missing parameters' });

        const { getLocalizedText } = require('./src/openai');
        const translatedText = await getLocalizedText(targetLang, text);
        
        res.json({ translatedText });
    } catch (err) {
        console.error('API Translate Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Any other request serves the React app
app.get('*', (req, res) => {
    res.sendFile(path.join(webappDistPath, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);

    // Check if we should use Long Polling or Webhook
    const WEBHOOK_URL = process.env.WEBHOOK_URL;
    if (WEBHOOK_URL) {
        bot.telegram.setWebhook(`${WEBHOOK_URL}/api/webhook`)
            .then(() => console.log(`Webhook set to: ${WEBHOOK_URL}/api/webhook`))
            .catch(err => console.error('Error setting webhook:', err));
    } else {
        bot.launch()
            .then(() => console.log('Bot started with Long Polling'))
            .catch(err => console.error('Error launching bot:', err));
    }
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
