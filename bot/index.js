const { Telegraf, session, Markup } = require('telegraf');
const dotenv = require('dotenv');
const { supabase, getUser, createUser, getTariffs, saveMessage, getHistory, createOrder, getFaq } = require('./src/supabase');
const { getChatResponse } = require('./src/openai');
const { SALES_SYSTEM_PROMPT } = require('./src/prompts');

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const MANAGER_ID = parseInt(process.env.MANAGER_ID);

const userLangCache = {};

bot.use(session());

// --- MANAGER FLOW ---
// Manager sends photo + caption (Client ID) -> Forward to Client
bot.on(['photo', 'document'], async (ctx) => {
    const senderId = ctx.from.id;

    if (senderId === MANAGER_ID) {
        const caption = ctx.message.caption || '';
        const clientIdMatch = caption.match(/\d+/);

        if (clientIdMatch) {
            const clientId = clientIdMatch[0];
            try {
                if (ctx.message.photo) {
                    const photo = ctx.message.photo[ctx.message.photo.length - 1].file_id;
                    await bot.telegram.sendPhoto(clientId, photo, {
                        caption: "🎉 Твой eSIM готов! Вот QR-код и инструкция по установке. Приятного путешествия! 🌍"
                    });
                } else if (ctx.message.document) {
                    await bot.telegram.sendDocument(clientId, ctx.message.document.file_id, {
                        caption: "📄 Твой eSIM готов! Инструкция во вложении."
                    });
                }
                await ctx.reply(`✅ Переслано клиенту ID: ${clientId}`);
            } catch (err) {
                await ctx.reply(`❌ Ошибка пересылки: ${err.message}`);
            }
        } else {
            await ctx.reply("ℹ️ Чтобы переслать QR клиенту, в подписи (caption) укажи его ID.");
        }
    }
});

// --- CLIENT FLOW ---

bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;
    const startPayload = ctx.payload;

    const lang = ctx.from.language_code === 'tr' ? 'tr' : 'ru';
    userLangCache[telegramId] = lang;

    let { data: user } = await getUser(telegramId);

    if (!user) {
        const referrerId = startPayload && !isNaN(startPayload) ? parseInt(startPayload) : null;
        const { data: newUser } = await createUser({
            telegram_id: telegramId,
            username: username,
            referrer_id: (referrerId && referrerId !== telegramId) ? referrerId : null,
            balance: 0
        });
        user = newUser;
        console.log(`New user: ${username} (${telegramId})`);
    }

    const welcomeParams = lang === 'tr'
        ? {
            text: `Merhaba, ${username}! 🚀\n\nBen senin kişisel eSIM yöneticinim. Seyahatin için en iyi internet paketini seçmene yardımcı olacağım.\n\nNereye uçuyoruz? 🌍`,
            btn: '📱 Paneli Aç'
        }
        : {
            text: `Привет, ${username}! 🚀\n\nЯ твой персональный менеджер по eSIM. Помогу выбрать лучший интернет для твоей поездки.\n\nКуда летим? 🌍`,
            btn: '📱 Открыть Дашборд'
        };

    await ctx.reply(welcomeParams.text,
        Markup.inlineKeyboard([
            [Markup.button.webApp(welcomeParams.btn, 'https://esim-bot.vercel.app')]
        ])
    );
});

bot.on('text', async (ctx) => {
    const telegramId = ctx.from.id;
    if (telegramId === MANAGER_ID) return;

    const username = ctx.from.username || ctx.from.first_name;
    const userText = ctx.message.text;

    const lang = ctx.from.language_code === 'tr' ? 'tr' : 'ru';
    userLangCache[telegramId] = lang;

    const { data: user } = await getUser(telegramId);
    if (!user) {
        return ctx.reply(lang === 'tr' ? 'Başlamak için /start\'a basın.' : 'Нажми /start для начала.');
    }

    const { data: history } = await getHistory(telegramId);
    const { data: tariffs } = await getTariffs();

    await saveMessage(telegramId, 'user', userText);

    try { await ctx.sendChatAction('typing'); } catch (e) { }

    const { data: faqRows } = await getFaq();
    let faqText = '';
    if (faqRows && faqRows.length > 0) {
        faqText = faqRows.map(f => `- ${f.topic}: ${lang === 'tr' ? f.content_tr : f.content_ru}`).join('\n');
    }

    // Get AI response with Salesperson character
    const aiResponse = await getChatResponse(SALES_SYSTEM_PROMPT(tariffs, lang, faqText), history, userText);

    // 1. Detect Sale Request [SALE_REQUEST: UUID]
    const saleMatch = aiResponse.match(/\[SALE_REQUEST:\s*([a-f0-9-]+)\]/i);
    let finalResponse = aiResponse.replace(/\[SALE_REQUEST:.*?\]/gi, '').trim();

    if (saleMatch) {
        const tariffId = saleMatch[1];
        const tariff = tariffs.find(t => t.id === tariffId);

        if (tariff) {
            const { data: orderData } = await createOrder(telegramId, tariffId);

            const lang = ctx.from.language_code === 'tr' ? 'tr' : 'ru';
            const payText = lang === 'tr'
                ? `\n\n👇 **Online Öde:**\n${tariff.payment_link || 'Yöneticiye başvurun'}\n\n✅ *Başarılı ödemeden hemen sonra tarifenizi göndereceğiz!*`
                : `\n\n👇 **Оплатить онлайн:**\n${tariff.payment_link || 'Обратись к менеджеру'}\n\n✅ *Сразу после успешной оплаты мы вышлем твой тариф!*`;

            finalResponse += payText;

            await saveMessage(telegramId, 'assistant', finalResponse);
            await ctx.reply(finalResponse, { parse_mode: 'Markdown' });

            // AI recommended tariff, sent payment link. QR logic removed (now handled by manager).
            // Находим всех менеджеров и фаундеров
            const { data: managers } = await supabase
                .from('users')
                .select('telegram_id')
                .in('role', ['founder', 'manager']);

            if (managers && managers.length > 0) {
                for (const manager of managers) {
                    try {
                        await bot.telegram.sendMessage(manager.telegram_id,
                            `🚀 **ЗАКАЗ!**\n\n` +
                            `Юзер: @${username} (ID: ${telegramId})\n` +
                            `Тариф: ${tariff.country} | ${tariff.data_gb} на ${tariff.validity_period}\n` +
                            `Цена: $${tariff.price_usd}`,
                            orderData ? Markup.inlineKeyboard([
                                [
                                    Markup.button.callback('📤 Отправить QR', `sendqr_${orderData.id}`),
                                    Markup.button.callback('❌ Отменить', `cancel_${orderData.id}`)
                                ]
                            ]) : {}
                        );
                    } catch (err) {
                        console.error('Failed to notify manager:', err.message);
                    }
                }
            }
            return; // Exit here since we replied
        }
    }

    await saveMessage(telegramId, 'assistant', finalResponse);
    await ctx.reply(finalResponse, { parse_mode: 'Markdown' });
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

    await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId);

    const { data: tariff } = await supabase.from('tariffs').select('*').eq('id', order.tariff_id).single();
    if (tariff) {
        const clientLang = userLangCache[order.user_id] || 'ru';
        const caption = clientLang === 'tr'
            ? `🎉 eSIM'iniz hazır! İşte bağlantınız/kurulum bilgileriniz. İyi yolculuklar! 🌍`
            : `🎉 Твой eSIM готов! Вот информация для установки. Приятного путешествия! 🌍`;

        let qrSent = false;
        if (tariff.payment_qr_url) {
            let finalQrUrl = tariff.payment_qr_url;
            if (finalQrUrl.includes('drive.google.com')) {
                const match = finalQrUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (match && match[1]) {
                    finalQrUrl = `https://drive.google.com/uc?export=view&id=${match[1]}`;
                }
            }
            try {
                await bot.telegram.sendPhoto(order.user_id, finalQrUrl, { caption });
                qrSent = true;
            } catch (err) {
                console.error('Failed to send QR to client:', err.message);
            }
        }

        if (!qrSent) {
            try {
                await bot.telegram.sendMessage(order.user_id, `${caption}\n${tariff.payment_link || ''}`);
            } catch (e) { }
        }

        // Schedule delayed message (2 minutes for quick testing)
        setTimeout(async () => {
            const delayText = clientLang === 'tr'
                ? `Gösterdiğiniz ilgi ve ayırdığınız zaman için teşekkür ederiz. İyi yolculuklar dilerim! ✈️ eSIM'iniz aktif — internet vardığınızda çalışacaktır, eğer zaten yurtdışındaysanız bağlantı hazırdır. eSIM profili için veri dolaşımını açmayı unutmayın.\n\nŞeffaf fiyatlar, yorumlar ve 7/24 destek sunan dijital platformumuz eMedeo uygulamasını yüklemenizi öneririz. Transfer, araç/ev kiralama, turlar, alışveriş ve hukuki danışmanlık hizmetlerini doğrudan, aracısız alın.\n\nBir şeyler ters giderse yanınızdayız: 7/24 destek sohbeti.\n\nUygulamamız:\nAndroid: https://play.google.com/store/apps/details?id=com.emedeo.codeware\nIOS: https://apps.apple.com/app/emedeo/id6738978452`
                : `Благодарим за проявленный интерес и уделенное нам время. Желаю Вам Счастливого пути! ✈️ Ваша eSIM активна — интернет заработает по прилёту, а если вы уже за границей, связь уже доступна. Не забудьте включить роуминг данных для профиля eсим.\n\nРекомендуем установить приложение eMedeo — цифровую платформу с прозрачными ценами, отзывами и поддержкой 24/7. Получайте трансфер, аренду авто/жилья, экскурсии, покупки и юридические консультации напрямую, без посредников.\n\nМы рядом, если что-то пойдёт не так: чат поддержки 24/7\n\nНаше приложение:\nAndroid: https://play.google.com/store/apps/details?id=com.emedeo.codeware\nIOS: https://apps.apple.com/app/emedeo/id6738978452`;

            try {
                await bot.telegram.sendPhoto(order.user_id, 'https://drive.google.com/uc?export=view&id=1zxDZ_QkKYu6VKFlS7nNlRktlLKLxSx47', {
                    caption: delayText
                });
            } catch (err) {
                console.error('Failed to send delayed photo:', err.message);
                try {
                    await bot.telegram.sendMessage(order.user_id, delayText, { disable_web_page_preview: true });
                } catch (e) { }
            }
        }, 2 * 60 * 1000); // 2 mins
    }

    try {
        await ctx.editMessageText(
            ctx.callbackQuery.message.text + '\n\n✅ QR ОТПРАВЛЕН КЛИЕНТУ! (ПОКУПКА УЧТЕНА)'
        );
    } catch (e) { }

    await ctx.answerCbQuery('✅ QR отправлен! Награда зачислена.', { show_alert: true });
});

bot.action(/^cancel_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const telegramId = ctx.from.id;

    const { data: user } = await getUser(telegramId);
    if (!user || (user.role !== 'founder' && user.role !== 'manager')) {
        return ctx.answerCbQuery('❌ У вас нет прав.', { show_alert: true });
    }

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
