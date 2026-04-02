const { Telegraf, session, Markup } = require('telegraf');
const dotenv = require('dotenv');
const { supabase, getUser, createUser, getTariffs, saveMessage, getHistory, createOrder, getFaq, clearHistory } = require('./src/supabase');
const { getChatResponse, getLocalizedText } = require('./src/openai');

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const MANAGER_ID = parseInt(process.env.MANAGER_ID);

const userLangCache = {};

bot.use(session());

// In-memory state tracking for managers: { managerTelegramId: orderId }
const managerStates = new Map();

// --- HELPER: Late Follow-up (2 min) ---
async function scheduleFollowup(userId, lang) {
    const delayTextRu = `Благодарим Вас за проявленный интерес и уделенное время! 🙏
Желаем Вам приятного путешествия! ✈️

Ваша eSIM уже активна — интернет заработает сразу по прилёту. Если Вы уже за границей, связь доступна прямо сейчас 🌍
Не забудьте включить роуминг данных для профиля eSIM.

Рекомендуем установить приложение eMedeo — цифровую платформу с прозрачными ценами, отзывами и поддержкой 24/7 🤖
ИИ от eMedeo поможет Вам:
• Подобрать трансфер 🚗
• Арендовать авто или жильё 🏡
• Забронировать экскурсии 🗺️
• Совершать покупки 🛍️
• Получить юридические и консультационные услуги ⚖️
— Мир без посредников —

Мы всегда рядом, если что-то пойдёт не так — чат поддержки 24/7 💬

Наше приложение:
Android: https://play.google.com/store/apps/details?id=com.emedeo.codeware
IOS: https://apps.apple.com/app/emedeo/id6738978452`;
    
    setTimeout(async () => {
        const delayText = await getLocalizedText(lang, delayTextRu);
        try {
            const photoUrl = 'https://drive.google.com/uc?export=download&id=1zxDZ_QkKYu6VKFlS7nNlRktlLKLxSx47';
            // Use axios with headers to bypass potential blocks
            const response = await axios({
                url: photoUrl,
                method: 'GET',
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            const buffer = Buffer.from(response.data);
            await bot.telegram.sendPhoto(userId, { source: buffer }, { caption: delayText });
        } catch (err) {
            console.error('Promo photo error:', err.message);
            try { await bot.telegram.sendMessage(userId, delayText, { disable_web_page_preview: true }); } catch (e) { }
        }
    }, 2 * 60 * 1000);
}

// --- MANAGER FLOW ---
bot.on(['photo', 'document', 'text'], async (ctx, next) => {
    const senderId = ctx.from.id;

    // Skip if it's the start command
    if (ctx.message.text && ctx.message.text.startsWith('/start')) return next();

    const { data: sender } = await getUser(senderId);
    const isManager = sender && (sender.role === 'manager' || sender.role === 'founder' || senderId === MANAGER_ID);

    if (!isManager) {
        return next();
    }

    // 1. Check in-memory state first (Strict Assignment)
    const activeState = managerStates.get(senderId);
    if (!activeState || !activeState.orderId) {
        if (ctx.message.photo || ctx.message.document) {
            return ctx.reply("❌ Ошибка: вы не выбрали заказ.\nСначала нажмите кнопку «Отправить eSIM» под нужным заказом в ленте, чтобы закрепить его за собой.");
        }
        return next();
    }

    // Fetch the order from DB using the ID we tracked in RAM
    const { data: pendingOrder } = await supabase
        .from('orders').select('*')
        .eq('id', activeState.orderId)
        .single();

    if (pendingOrder) {
        const orderId = pendingOrder.id;
        const userId = pendingOrder.user_id;

        // Atomic check: Only proceed if status is STILL 'awaiting_qr'
        const { data: updated, error: updateError } = await supabase
            .from('orders')
            .update({ status: 'paid', assigned_manager: null })
            .eq('id', orderId)
            .eq('status', 'awaiting_qr')
            .select();

        if (updateError || !updated || updated.length === 0) {
            managerStates.delete(senderId); // Clean up state regardless
            return ctx.reply('❌ Ошибка: Заказ уже был выполнен другим менеджером или отменен.');
        }

        const clientRawLang = userLangCache[userId] || 'en';
        const captionRu = `🎉 Ваш eSIM готов!

Вот данные для установки — приятного путешествия! 🌍

Перейдите по ссылке, введите код доступа и следуйте простой инструкции на экране.

Если возникнут вопросы, я всегда помогу Вам быстро разобраться и подключиться 🚀`;
        const caption = await getLocalizedText(clientRawLang, captionRu);

        let qrSent = false;
        try {
            if (ctx.message.photo) {
                const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
                await bot.telegram.sendPhoto(userId, photoId, { caption: ctx.message.caption ? `${caption}\n${ctx.message.caption}` : caption });
                qrSent = true;
            } else if (ctx.message.document) {
                await bot.telegram.sendDocument(userId, ctx.message.document.file_id, { caption: ctx.message.caption ? `${caption}\n${ctx.message.caption}` : caption });
                qrSent = true;
            } else if (ctx.message.text) {
                const messageRu = `🎉 Ваш eSIM готов!

Вот данные для установки — приятного путешествия! 🌍

Перейдите по ссылке, введите код доступа и следуйте простой инструкции на экране.

Если возникнут вопросы, я всегда помогу Вам быстро разобраться и подключиться 🚀

` + ctx.message.text;
                const message = await getLocalizedText(userLangCache[userId] || 'en', messageRu);
                await bot.telegram.sendMessage(userId, message);
                qrSent = true;
            }
        } catch (err) {
            console.error('Failed to send payload to client:', err.message);
            return ctx.reply('❌ Ошибка отправки клиенту. Сообщите разработчику.');
        }

        if (qrSent) {
            managerStates.delete(senderId); // Clear active tracking

            // --- REFERRAL PAYOUT: 20% of tariff price ---
            try {
                const { data: buyer } = await supabase.from('users').select('referrer_id').eq('telegram_id', userId).single();
                if (buyer?.referrer_id && pendingOrder.price_usd) {
                    const reward = Math.round(pendingOrder.price_usd * 0.20 * 100) / 100;
                    const { data: refUser } = await supabase.from('users').select('balance').eq('telegram_id', buyer.referrer_id).single();
                    const newBalance = Math.round(((refUser?.balance || 0) + reward) * 100) / 100;
                    await supabase.from('users').update({ balance: newBalance }).eq('telegram_id', buyer.referrer_id);

                    // Log commission to chat_history so WebApp stats see each deal
                    await supabase.from('chat_history').insert({
                        id: `ref_${pendingOrder.id}_${buyer.referrer_id}`,
                        user_id: buyer.referrer_id,
                        role: 'assistant',
                        content: `COMMISSION_RECORD:${reward}:order_${pendingOrder.id}:buyer_${userId}`,
                        created_at: new Date().toISOString()
                    }).then(({ error }) => { if (error) console.error('Commission log error:', error.message); });

                    try {
                        const { data: refUserLang } = await supabase.from('users').select('lang_code').eq('telegram_id', buyer.referrer_id).single();
                        const refLang = refUserLang?.lang_code || userLangCache[buyer.referrer_id] || 'ru';
                        const refRu = `💰 Вам начислено $${reward} (20% от продажи eSIM)! Ваш новый баланс: $${newBalance}`;
                        const refMsg = await getLocalizedText(refLang, refRu);
                        await bot.telegram.sendMessage(buyer.referrer_id, refMsg);
                    } catch (e) { }
                }
            } catch (e) {
                console.error('Referral payout error:', e.message);
            }

            // Schedule delayed promo message (2 minutes)
            await scheduleFollowup(userId, clientRawLang);

            // Visual reset for the Manager (remove buttons, mark as done)
            if (activeState.messageId) {
                try {
                    const originalText = activeState.originalText || "Данные отправлены пользователю!";
                    const cleanText = originalText.replace(/\n\n⏳ ОЖИДАНИЕ.*/g, '');
                    await bot.telegram.editMessageText(
                        senderId,
                        activeState.messageId,
                        undefined,
                        `✅ **ОТПРАВЛЕН (Завершено)**\n\n${cleanText}`
                    );
                } catch (e) { console.error('Visual reset error:', e.message); }
            }

            return ctx.reply('✅ Данные (ссылка/QR) успешно отправлены. Покупка зачтена (paid) и начислены бонусы.');
        }
    }
});

// --- CLIENT FLOW ---

bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const username = ctx.from.username || 'User';
    const startPayload = ctx.payload;

    try {
        console.log(`[START] Triggered for ${username} (${telegramId})`);
        await clearHistory(telegramId);

        if (startPayload === 'getqr') {
            const lang = userLangCache[telegramId] || ctx.from.language_code || 'en';
            const refLink = `https://t.me/emedeoesimworld_bot?start=${telegramId}`;
            const textRu = `🎁 Вот твоя пригласительная ссылка и QR-код:\n\n${refLink}\n\nТвой промокод (для ввода вручную): \`${telegramId}\``;
            const text = await getLocalizedText(lang, textRu);
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(refLink)}&margin=10`;
            try { await ctx.replyWithPhoto(qrUrl, { caption: text, parse_mode: 'Markdown' }); } catch (e) { }
        }

        let { data: user } = await getUser(telegramId);
        if (!user) {
            const rId = startPayload && !isNaN(startPayload) ? parseInt(startPayload) : null;
            const { data: newUser } = await createUser({
                telegram_id: telegramId, username, role: 'client',
                lang_code: ctx.from.language_code || 'en',
                referrer_id: (rId && rId !== telegramId) ? rId : null
            });
            user = newUser;
        } else if (startPayload && !isNaN(startPayload) && !user.referrer_id) {
            // Existing user without a referrer came via a referral link — assign now
            const rId = parseInt(startPayload);
            if (rId !== telegramId) {
                await supabase.from('users').update({ referrer_id: rId }).eq('telegram_id', telegramId);
                user = { ...user, referrer_id: rId };
                console.log(`[START] Assigned referrer ${rId} to existing user ${telegramId}`);
            }
        }

        // welcomeLang: Priority on TG settings (for the first message)
        // sessionLang: Priority on DB settings (for the rest of the chat)
        const welcomeLang = ctx.from.language_code || user?.lang_code || 'en';
        const sessionLang = user?.lang_code || ctx.from.language_code || 'en';

        // Set cache to sessionLang (DB priority)
        userLangCache[telegramId] = sessionLang;
        console.log(`[START] Greet: '${welcomeLang}', Cache: '${sessionLang}'`);

        // Sync DB if new user
        if (user && !user.lang_code) {
            try {
                const { updateUser } = require('./src/supabase');
                await updateUser(telegramId, { lang_code: sessionLang });
            } catch (e) { }
        }

        const welcomeRuPart1 = `Привет! 🚀
Я — Ваш персональный ИИ-менеджер от eMedeo 🤖
Помогу Вам:
✔️ подобрать лучший тариф eSIM под Вашу поездку
✔️ сэкономить на дорогом роуминге и местных SIM-картах
✔️ оставаться на связи сразу после прилёта
📲 Быстро, удобно и без лишних затрат — всё онлайн за пару минут.`;

        const welcomeRuPart2 = `Рекомендую перед покупкой eSIM проверить, поддерживает ли Ваш телефон
технологию eSIM 📱
Это важно, потому что не все устройства работают с eSIM, и Вы сможете
избежать лишних затрат и проблем с подключением.
Откройте  «Телефон» (набор номера).
Введите *#06#.
Если устройство поддерживает eSIM, в появившемся окне отобразится
строка «EID» и его номер.
Так куда планируете  лететь? 🌍 — подберу идеальный для Вас вариант 👇`;

        const welcomeText1 = await getLocalizedText(welcomeLang, welcomeRuPart1);
        const dashboardBtn = await getLocalizedText(welcomeLang, '📱 Открыть Дашборд');

        // Cleanup stale keyboards
        try { const k = await ctx.reply('…', Markup.removeKeyboard()); await bot.telegram.deleteMessage(ctx.chat.id, k.message_id); } catch (e) { }

        await ctx.reply(welcomeText1,
            Markup.keyboard([[Markup.button.webApp(dashboardBtn, `${process.env.WEBAPP_URL || 'https://esim.ticaretai.tr'}?uid=${telegramId}`)]]).resize()
        );
        console.log(`[START] Welcome Part 1 sent to ${username}`);

        setTimeout(async () => {
            try {
                const welcomeText2 = await getLocalizedText(welcomeLang, welcomeRuPart2);
                await bot.telegram.sendMessage(telegramId, welcomeText2);
                console.log(`[START] Welcome Part 2 sent to ${username}`);
            } catch (err) {
                console.error('[START Part 2] Error:', err.message);
            }
        }, 2000);

    } catch (err) {
        console.error('[START] Fatal Error:', err.message);
        try { await ctx.reply('Привет! Я твой eSIM-менеджер. Открой дашборд или напиши страну, куда летишь!'); } catch (e) { }
    }
});

bot.command('ref', async (ctx) => {
    const telegramId = ctx.from.id;
    const lang = userLangCache[telegramId] || ctx.from.language_code || 'en';
    const refLink = `https://t.me/emedeoesimworld_bot?start=${telegramId}`;

    const textRu = `🎁 Вот твоя пригласительная ссылка и QR-код:\n\n${refLink}\n\nТвой промокод (для ввода вручную): \`${telegramId}\``;
    const text = await getLocalizedText(lang, textRu);

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(refLink)}&margin=10`;

    try {
        await ctx.replyWithPhoto(qrUrl, { caption: text, parse_mode: 'Markdown' });
    } catch (err) {
        await ctx.reply(text, { parse_mode: 'Markdown', disable_web_page_preview: true });
    }
});

bot.on('message', async (ctx, next) => {
    if (ctx.message?.web_app_data) {
        const data = ctx.message.web_app_data.data;
        console.log('[WEB APP DATA RECEIVED]', data);
        if (data === '/ref') {
            const telegramId = ctx.from.id;
            const lang = userLangCache[telegramId] || ctx.from.language_code || 'en';
            const refLink = `https://t.me/emedeoesimworld_bot?start=${telegramId}`;

            const textRu = `🎁 Вот твоя пригласительная ссылка и QR-код:\n\n${refLink}\n\nТвой промокод (для ввода вручную): \`${telegramId}\``;
            const text = await getLocalizedText(lang, textRu);
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(refLink)}&margin=10`;

            try {
                await ctx.replyWithPhoto(qrUrl, { caption: text, parse_mode: 'Markdown' });
            } catch (err) {
                await ctx.reply(text, { parse_mode: 'Markdown', disable_web_page_preview: true });
            }
        } else {
            let parsed = null;
            try { parsed = JSON.parse(data); } catch(e) {}
            if (parsed && parsed.action === 'buy') {
                const tariffId = parsed.tariffId;
                const telegramId = ctx.from.id;
                const username = ctx.from.username || ctx.from.first_name;
                
                let { data: tariffs } = await getTariffs();
                tariffs = tariffs || [];
                const tariff = tariffs.find(t => t.id === tariffId);

                if (tariff) {
                    try {
                        const { data: orderData } = await createOrder(telegramId, tariffId, tariff.price_usd);
                        
                        const uiLang = userLangCache[telegramId] || ctx.from.language_code || 'en';
                        
                        const successRu = `Выбранный тариф: ${tariff.country} | ${tariff.data_gb} на ${tariff.validity_period}`;
                        let finalResponse = await getLocalizedText(uiLang, successRu);
                        
                        const payTextRu = `\n\n👇 **Оплатить онлайн:**\n${tariff.payment_link || 'Обратись к менеджеру'}\n\n✅ *Сразу после успешной оплаты мы вышлем твой тариф!*`;
                        const payText = await getLocalizedText(uiLang, payTextRu);
                        finalResponse += payText;
                        
                        await saveMessage(telegramId, 'assistant', finalResponse);
                        
                        try {
                            await ctx.reply(finalResponse, { parse_mode: 'Markdown' });
                        } catch (mdError) {
                            await ctx.reply(finalResponse);
                        }

                        if (tariff.payment_qr_url) {
                            let finalQrUrl = tariff.payment_qr_url;
                            if (finalQrUrl.includes('drive.google.com')) {
                                const match = finalQrUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                                if (match && match[1]) {
                                    finalQrUrl = `https://drive.google.com/uc?export=view&id=${match[1]}`;
                                }
                            }
                            const captionRu = `QR-код для оплаты тарифа ${tariff.country}`;
                            const qrCaption = await getLocalizedText(uiLang, captionRu);
                            try {
                                await ctx.replyWithPhoto(finalQrUrl, { caption: qrCaption });
                            } catch (err) {}
                        }

                        const { data: managers } = await supabase.from('users').select('telegram_id').in('role', ['founder', 'manager']);
                        if (managers && managers.length > 0) {
                            for (const manager of managers) {
                                try {
                                    const mLangRaw = userLangCache[manager.telegram_id] || 'ru';
                                    const mLang = mLangRaw === 'ru' ? 'ru' : (mLangRaw === 'tr' ? 'tr' : 'en');
            
                                    const managerTexts = {
                                        ru: {
                                            alert: `🚀 **ЗАКАЗ (КАТАЛОГ)!**\n\nЮзер: @${username} (ID: ${telegramId})\nТариф: ${tariff.country} | ${tariff.data_gb} на ${tariff.validity_period}\nЦена: $${tariff.price_usd}\n\n⚠️ ВАЖНО: Подтвердите оплату перед тем как скидывать eSIM-код!`,
                                            sendBtn: '📤 Отправить eSIM (Код/Ссылка)'
                                        },
                                        tr: {
                                            alert: `🚀 **SİPARİŞ (KATALOG)!**\n\nKullanıcı: @${username} (ID: ${telegramId})\nTarife: ${tariff.country} | ${tariff.data_gb} - ${tariff.validity_period}\nFiyat: $${tariff.price_usd}\n\n⚠️ ÖNEMLİ: Link veya QR'ı göndermeden önce ödemeyi onaylayın!`,
                                            sendBtn: '📤 eSIM Gönder'
                                        },
                                        en: {
                                            alert: `🚀 **ORDER (CATALOG)!**\n\nUser: @${username} (ID: ${telegramId})\nPlan: ${tariff.country} | ${tariff.data_gb} for ${tariff.validity_period}\nPrice: $${tariff.price_usd}\n\n⚠️ IMPORTANT: Verify payment before sending the Link/Code!`,
                                            sendBtn: '📤 Send eSIM (Code/Link)'
                                        }
                                    };
                                    const mt = managerTexts[mLang];
                                    const buttons = (orderData && orderData.id) 
                                        ? Markup.inlineKeyboard([[Markup.button.callback(mt.sendBtn, `sendqr_${orderData.id}`)]]) 
                                        : {};
                                    await bot.telegram.sendMessage(manager.telegram_id, mt.alert, buttons);
                                } catch (e) {}
                            }
                        }
                    } catch (e) { console.error('Sale flow error:', e.message); }
                }
            }
        }
        return;
    }
    return next();
});

bot.on('text', async (ctx) => {
    const telegramId = ctx.from.id;
    const activeState = managerStates.get(telegramId);
    
    // If the manager is ACTIVELY waiting for a QR/Code, we handle it in the manager flow (line 63)
    // Here we handle GENERIC chat. If they are the manager, we allow them to chat too 
    // unless they specifically should be in the order flow.
    if (activeState && activeState.orderId) return; // Wait for the manager flow below...

    const username = ctx.from.username || ctx.from.first_name;
    const userText = ctx.message.text.trim();

    try {
        await saveMessage(telegramId, 'user', userText);
        let { data: user } = await getUser(telegramId);

        const systemLang = ctx.from.language_code || 'en';
        if (!userLangCache[telegramId]) {
            userLangCache[telegramId] = user?.lang_code || systemLang;
        }
        const uiLang = userLangCache[telegramId];

    if (!user) {
        const msgRu = 'Нажми /start для начала.';
        const msg = await getLocalizedText(systemLang, msgRu);
        return ctx.reply(msg, Markup.removeKeyboard());
    }

    // --- PROMO CODE LOGIC ---
    if (!user.referrer_id && /^\d{6,15}$/.test(userText)) {
        const promoId = parseInt(userText);
        if (promoId !== telegramId) {
            const { data: promoUser } = await getUser(promoId);
            if (promoUser) {
                await supabase.from('users').update({ referrer_id: promoId }).eq('telegram_id', telegramId);
                user.referrer_id = promoId;

                const successRu = '✅ Промокод успешно применен! Спасибо.\n\nА теперь подскажи, куда летим? 🌍';
                const successText = await getLocalizedText(uiLang, successRu);
                return ctx.reply(successText);
            }
        }

        const failRu = '❌ Неверный или недействительный промокод.';
        const failText = await getLocalizedText(uiLang, failRu);
        return ctx.reply(failText);
    }

    const { data: history } = await getHistory(telegramId);
    let { data: tariffs } = await getTariffs();
    if (!tariffs) tariffs = []; // Safe fallback

    try { await ctx.sendChatAction('typing'); } catch (e) { }

    const { data: faqRows, error: faqError } = await getFaq();
    let faqText = faqRows ? faqRows.map(f => `- ${f.topic}: ${f.content_ru}`).join('\n') : '';
    if (faqError) console.error('[FAQ] Supabase error:', faqError.message);

    // Get AI response
    const aiResponse = await getChatResponse(tariffs, faqText, history || [], userText);

    const langMatch = aiResponse.match(/\[LANG:\s*(ru|tr|en|fa|ar|de|pl)\]/i);
    if (langMatch) {
        const newLang = langMatch[1].toLowerCase();
        if (newLang !== userLangCache[telegramId]) {
            userLangCache[telegramId] = newLang;
            try {
                const { updateUser } = require('./src/supabase');
                await updateUser(telegramId, { lang_code: newLang });
            } catch (e) { console.error('Lang Update Error:', e.message); }
        }
    }

    const saleMatch = aiResponse.match(/\[SALE_REQUEST:\s*([a-zA-Z0-9_-]+)\]/i);
    let rawText = aiResponse.replace(/\[SALE_REQUEST:.*?\]/gi, '').replace(/\[LANG:.*?\]/gi, '').trim();
    const targetLang = userLangCache[telegramId] || 'ru';
    let finalResponse = await getLocalizedText(targetLang, rawText);

    if (saleMatch) {
        const tariffId = saleMatch[1];
        const tariff = tariffs.find(t => t.id === tariffId);

        if (tariff) {
            try {
                const { data: orderData } = await createOrder(telegramId, tariffId, tariff.price_usd);

            // Fetch dynamic uiLang strictly from userLangCache updated by AI
            const uiLang = userLangCache[telegramId] || ctx.from.language_code || 'en';
            const payTextRu = `\n\n👇 **Оплатить онлайн:**\n${tariff.payment_link || 'Обратись к менеджеру'}\n\n✅ *Сразу после успешной оплаты мы вышлем твой тариф!*`;
            const payText = await getLocalizedText(uiLang, payTextRu);

            finalResponse += payText;

            await saveMessage(telegramId, 'assistant', finalResponse);
            try {
                await ctx.reply(finalResponse, { parse_mode: 'Markdown' });
            } catch (mdError) {
                console.warn('[SALE] Markdown fallback triggered:', mdError.message);
                await ctx.reply(finalResponse);
            }

            // Restore AI Payment QR Automated Reply
            if (tariff.payment_qr_url) {
                let finalQrUrl = tariff.payment_qr_url;
                if (finalQrUrl.includes('drive.google.com')) {
                    const match = finalQrUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (match && match[1]) {
                        finalQrUrl = `https://drive.google.com/uc?export=view&id=${match[1]}`;
                    }
                }
                const captionRu = `QR-код для оплаты тарифа ${tariff.country}`;
                const qrCaption = await getLocalizedText(userLangCache[telegramId] || 'ru', captionRu);
                try {
                    await ctx.replyWithPhoto(finalQrUrl, { caption: qrCaption });
                } catch (err) {
                    console.error('Failed to send QR:', err.message);
                }
            }

            // Находим всех менеджеров и фаундеров
            const { data: managers } = await supabase
                .from('users')
                .select('telegram_id')
                .in('role', ['founder', 'manager']);

            if (managers && managers.length > 0) {
                for (const manager of managers) {
                    try {
                        const mLangRaw = userLangCache[manager.telegram_id] || 'ru';
                        const mLang = mLangRaw === 'ru' ? 'ru' : (mLangRaw === 'tr' ? 'tr' : 'en');

                        const managerTexts = {
                            ru: {
                                alert: `🚀 **ЗАКАЗ!**\n\nЮзер: @${username} (ID: ${telegramId})\nТариф: ${tariff.country} | ${tariff.data_gb} на ${tariff.validity_period}\nЦена: $${tariff.price_usd}\n\n⚠️ ВАЖНО: Подтвердите оплату перед тем как скидывать eSIM-код!`,
                                sendBtn: '📤 Отправить eSIM (Код/Ссылка)',
                                cancelBtn: '❌ Отменить'
                            },
                            tr: {
                                alert: `🚀 **SİPARİŞ!**\n\nKullanıcı: @${username} (ID: ${telegramId})\nTarife: ${tariff.country} | ${tariff.data_gb} - ${tariff.validity_period}\nFiyat: $${tariff.price_usd}\n\n⚠️ ÖNEMLİ: Link veya QR'ı göndermeden önce ödemeyi onaylayın!`,
                                sendBtn: '📤 eSIM Gönder',
                                cancelBtn: '❌ İptal'
                            },
                            en: {
                                alert: `🚀 **ORDER!**\n\nUser: @${username} (ID: ${telegramId})\nPlan: ${tariff.country} | ${tariff.data_gb} for ${tariff.validity_period}\nPrice: $${tariff.price_usd}\n\n⚠️ IMPORTANT: Verify payment before sending the Link/Code!`,
                                sendBtn: '📤 Send eSIM (Code/Link)',
                                cancelBtn: '❌ Cancel'
                            }
                        };
                        const mt = managerTexts[mLang];

                                // Safely handle orderData.id null check
                                const buttons = (orderData && orderData.id) 
                                    ? Markup.inlineKeyboard([[Markup.button.callback(mt.sendBtn, `sendqr_${orderData.id}`)]]) 
                                    : {};

                                await bot.telegram.sendMessage(manager.telegram_id, mt.alert, buttons);
                            } catch (e) {
                                console.error('Manager notify error:', e.message);
                            }
                }
            }
            return; // Exit here since we replied
            } catch (e) { console.error('Sale flow error:', e.message); }
        } else {
            console.log(`[SALE] Tariff ${tariffId} not found in DB!`);
            const errRu = `\n❌ Ошибка: Тариф "${tariffId}" не найден в базе. Менеджер скоро подключится.`;
            finalResponse += await getLocalizedText(targetLang, errRu);
        }
    }

        if (!finalResponse || finalResponse.trim() === '') {
            finalResponse = 'Пожалуйста, подожди минуту или напиши менеджеру.';
        }

        await saveMessage(telegramId, 'assistant', finalResponse);
        try {
            await ctx.reply(finalResponse, { parse_mode: 'Markdown' });
        } catch (mdError) {
            console.warn('[GENERIC] Markdown fallback triggered:', mdError.message);
            await ctx.reply(finalResponse);
        }

    } catch (err) {
        console.error('CRITICAL BOT ERROR:', err);
        try {
            await ctx.reply('Извини, я приуныл. Попробуй позже (System Error).');
        } catch (e) { }
    }
});

bot.action(/^sendqr_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const telegramId = ctx.from.id;

    const { data: user } = await getUser(telegramId);
    if (!user || (user.role !== 'founder' && user.role !== 'manager')) {
        return ctx.answerCbQuery('❌ У вас нет прав для подтверждения.', { show_alert: true });
    }

    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!order) return ctx.answerCbQuery('❌ Заказ не найден.', { show_alert: true });

    if (order.status === 'paid') {
        return ctx.answerCbQuery('❌ Заказ уже был оплачен и отправлен!', { show_alert: true });
    }
    if (order.status === 'awaiting_qr' && order.assigned_manager !== telegramId) {
        return ctx.answerCbQuery('❌ Этот заказ прямо сейчас обрабатывает другой менеджер.', { show_alert: true });
    }
    if (order.status === 'cancelled') {
        return ctx.answerCbQuery('❌ Этот заказ был отменен.', { show_alert: true });
    }

    // Persist awaiting state strictly from pending state
    const { data: updated, error: updateErr } = await supabase.from('orders')
        .update({ status: 'awaiting_qr', assigned_manager: telegramId })
        .eq('id', orderId)
        .eq('status', 'pending')
        .select();

    if (updateErr || !updated || updated.length === 0) {
        // Double check if we already own it
        if (order.assigned_manager !== telegramId) {
            return ctx.answerCbQuery('❌ Заказ недоступен для взятия в работу.', { show_alert: true });
        }
    }

    managerStates.set(telegramId, { 
        orderId: orderId, 
        messageId: ctx.callbackQuery.message.message_id,
        originalText: ctx.callbackQuery.message.text
    }); // Track msg to delete buttons later

    try {
        await ctx.editMessageText(
            ctx.callbackQuery.message.text + '\n\n⏳ ОЖИДАНИЕ: Отправьте АКТИВАЦИОННУЮ ССЫЛКУ или eSIM-КОД в ответ на это сообщение!',
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отменить ожидание', `cancelqr_${orderId}`)]
            ])
        );
    } catch (e) { }

    await ctx.answerCbQuery('⏳ Отправьте в чат ссылку или eSIM-код для клиента.', { show_alert: true });
});

bot.action(/^cancelqr_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const telegramId = ctx.from.id;

    const { data: user } = await getUser(telegramId);
    if (!user || (user.role !== 'founder' && user.role !== 'manager')) {
        return ctx.answerCbQuery('❌ У вас нет прав.', { show_alert: true });
    }

    // Clear DB waiting state and RAM state
    managerStates.delete(telegramId);
    await supabase.from('orders').update({ status: 'pending', assigned_manager: null }).eq('id', orderId);

    try {
        await ctx.editMessageText(
            ctx.callbackQuery.message.text.replace('\n\n⏳ ОЖИДАНИЕ: Отправьте АКТИВАЦИОННУЮ ССЫЛКУ или QR-код в ответ на это сообщение!', '') + '\n\n🛑 Ожидание отменено оператором.',
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('📤 Отправить eSIM', `sendqr_${orderId}`),
                    Markup.button.callback('❌ Отменить', `cancel_${orderId}`)
                ]
            ])
        );
    } catch (e) { }

    await ctx.answerCbQuery('Ожидание отменено.');
});

bot.action(/^cancel_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const telegramId = ctx.from.id;

    const { data: user } = await getUser(telegramId);
    if (!user || (user.role !== 'founder' && user.role !== 'manager')) {
        return ctx.answerCbQuery('❌ У вас нет прав.', { show_alert: true });
    }

    // Safety clear in case they cancel the order while waiting for QR
    managerStates.delete(telegramId);

    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);

    try {
        await ctx.editMessageText(
            ctx.callbackQuery.message.text + '\n\n❌ ЗАКАЗ ОТМЕНЕН'
        );
    } catch (e) { }

    await ctx.answerCbQuery('❌ Заказ отменен.');
});

// Если мы НЕ на Vercel (например, запускаем локально или на VPS)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    bot.launch().then(() => console.log('Bot is running locally (Long Polling)...'));
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Экспортируем бота для Vercel (webhook)
module.exports = bot;
