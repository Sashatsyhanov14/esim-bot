const express = require('express');
const cors = require('cors');
const path = require('path');
const bot = require('./index');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- HELPER: Escape Markdown ---
const esc = (text) => (text || '').toString().replace(/[_*`[\]()]/g, '\\$&');

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
        const { data: managers } = await supabase.from('users').select('telegram_id').in('role', ['founder', 'admin', 'manager']);
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
                            text: `👤 **Юзер:** ${userLabel} (ID: ${telegramId})\n🚀 **ЗАКАЗ (WebApp)!**\n\nТариф: ${mlt.country} | ${mlt.data_gb} на ${mlt.validity}\nЦена: $${tariff.price_usd}\n\n⚠️ ВАЖНО: Подтвердите оплату перед тем как скидывать eSIM-код!`,
                            sendBtn: '📤 Отправить eSIM',
                            contactBtn: '✉️ Написать клиенту'
                        },
                        tr: {
                            text: `👤 **Kullanıcı:** ${userLabel} (ID: ${telegramId})\n🚀 **SİPARİŞ (WebApp)!**\n\nTarife: ${mlt.country} | ${mlt.data_gb} - ${mlt.validity}\nFiyat: $${tariff.price_usd}\n\n⚠️ ÖNEMLİ: Link или QR'ı göndermeden önce öдеmeyi onaylayın!`,
                            sendBtn: '📤 eSIM Gönder',
                            contactBtn: '✉️ Müşтерiye Yaz'
                        },
                        en: {
                            text: `👤 **User:** ${userLabel} (ID: ${telegramId})\n🚀 **ORDER (WebApp)!**\n\nPlan: ${mlt.country} | ${mlt.data_gb} for ${mlt.validity}\nPrice: $${tariff.price_usd}\n\n⚠️ IMPORTANT: Verify payment before sending the Link/Code!`,
                            sendBtn: '📤 Send eSIM',
                            contactBtn: '✉️ Write to Client'
                        }
                    };

                    const mt = alertTexts[mLang] || alertTexts['en'];

                    const buttons = (orderData && orderData.id) 
                        ? Markup.inlineKeyboard([
                            [Markup.button.callback(mt.sendBtn, `sendqr_${orderData.id}`)],
                            [Markup.button.callback(mt.contactBtn, `contactuser_${telegramId}`)]
                        ]) 
                        : {};
                    await bot.telegram.sendMessage(manager.telegram_id, mt.text, { parse_mode: 'Markdown', ...buttons });
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

app.post('/api/withdraw-request', async (req, res) => {
    try {
        const { telegram_id, amount, method } = req.body;
        if (!telegram_id || !amount || !method) return res.status(400).json({ error: 'Missing fields' });

        const { data: user } = await supabase.from('users').select('username, custom_note').eq('telegram_id', telegram_id).single();
        const userLabel = user?.custom_note ? `${user.custom_note} (@${user.username || telegram_id})` : `@${user?.username || telegram_id}`;

        const msg = `👤 **Клиент:** ${userLabel} (ID: ${telegram_id})\n🚀 **ЗАПРОС БОНУСОВ!**\n\n💰 Сумма: **$${amount}**\n💳 Способ: ${method}\n\n⚠️ Проверьте баланс пользователя в админке перед выплатой!`;

        const { data: managers } = await supabase.from('users').select('telegram_id').in('role', ['founder', 'manager']);
        if (managers && bot) {
            for (const manager of managers) {
                try {
                    await bot.telegram.sendMessage(manager.telegram_id, msg, { parse_mode: 'Markdown' });
                } catch (e) { console.error(`Failed to notify manager ${manager.telegram_id}:`, e.message); }
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Withdraw Request Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// API endpoint to validate Telegram WebApp Init Data
app.post('/api/validate-auth', async (req, res) => {
    try {
        const { initData } = req.body;
        if (!initData) return res.status(400).json({ error: 'Missing initData' });

        const crypto = require('crypto');
        const botToken = process.env.BOT_TOKEN;
        
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        const dataToCheck = [];

        params.sort();
        params.forEach((val, key) => {
            if (key !== 'hash') {
                dataToCheck.push(`${key}=${val}`);
            }
        });

        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
        const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataToCheck.join('\n')).digest('hex');

        if (calculatedHash === hash) {
            const userStr = params.get('user');
            const tgUser = userStr ? JSON.parse(userStr) : null;
            res.json({ ok: true, user: tgUser });
        } else {
            console.warn('[AUTH] Hash mismatch for initData');
            res.json({ ok: false });
        }
    } catch (err) {
        console.error('Auth validation error:', err.message);
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
