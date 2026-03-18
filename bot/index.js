const { Telegraf, session, Markup } = require('telegraf');
const dotenv = require('dotenv');
const { supabase, getUser, createUser, getTariffs, saveMessage, getHistory, createOrder } = require('./src/supabase');
const { getChatResponse } = require('./src/openai');
const { SALES_SYSTEM_PROMPT } = require('./src/prompts');

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const MANAGER_ID = parseInt(process.env.MANAGER_ID);

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

    await ctx.reply(`Привет, ${username}! 🚀\n\nЯ твой персональный менеджер по eSIM. Помогу выбрать лучший интернет для твоей поездки.\n\nКуда летим? 🌍`,
        Markup.inlineKeyboard([
            [Markup.button.webApp('📱 Открыть Дашборд', 'https://esim-bot.vercel.app')]
        ])
    );
});

bot.on('text', async (ctx) => {
    const telegramId = ctx.from.id;
    if (telegramId === MANAGER_ID) return;

    const username = ctx.from.username || ctx.from.first_name;
    const userText = ctx.message.text;

    const { data: user } = await getUser(telegramId);
    if (!user) return ctx.reply('Нажми /start для начала.');

    const { data: history } = await getHistory(telegramId);
    const { data: tariffs } = await getTariffs();

    await saveMessage(telegramId, 'user', userText);

    try { await ctx.sendChatAction('typing'); } catch (e) { }

    // Get AI response with Salesperson character
    const aiResponse = await getChatResponse(SALES_SYSTEM_PROMPT(tariffs), history, userText);

    // 1. Detect Sale Request [SALE_REQUEST: UUID]
    const saleMatch = aiResponse.match(/\[SALE_REQUEST:\s*([a-f0-9-]+)\]/i);
    let finalResponse = aiResponse.replace(/\[SALE_REQUEST:.*?\]/gi, '').trim();

    if (saleMatch) {
        const tariffId = saleMatch[1];
        const tariff = tariffs.find(t => t.id === tariffId);

        if (tariff) {
            const { data: orderData } = await createOrder(telegramId, tariffId);

            finalResponse += `\n\n👇 **Оплатить онлайн:**\n${tariff.payment_link || 'Обратись к менеджеру'}\n\n✅ *Сразу после успешной оплаты мы вышлем твой тариф!*`;

            await saveMessage(telegramId, 'assistant', finalResponse);
            await ctx.reply(finalResponse, { parse_mode: 'Markdown' });

            if (tariff.payment_qr_url) {
                let finalQrUrl = tariff.payment_qr_url;

                // Хак: Если это ссылка на Google Drive (содержит /file/d/ID/view),
                // вытаскиваем ID и конвертируем в прямую ссылку на картинку.
                if (finalQrUrl.includes('drive.google.com')) {
                    const match = finalQrUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (match && match[1]) {
                        finalQrUrl = `https://drive.google.com/uc?export=view&id=${match[1]}`;
                    }
                }

                try {
                    await ctx.replyWithPhoto(finalQrUrl, {
                        caption: `QR-код для оплаты тарифа ${tariff.country}`
                    });
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
                        await bot.telegram.sendMessage(manager.telegram_id,
                            `🚀 **ЗАКАЗ!**\n\n` +
                            `Юзер: @${username} (ID: ${telegramId})\n` +
                            `Тариф: ${tariff.country} | ${tariff.data_gb} на ${tariff.validity_period}\n` +
                            `Цена: $${tariff.price_usd}`,
                            orderData ? Markup.inlineKeyboard([
                                Markup.button.callback('✅ Покупка подтверждена', `confirm_${orderData.id}`)
                            ]) : undefined
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

bot.action(/^confirm_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const telegramId = ctx.from.id;

    const { data: user } = await getUser(telegramId);
    if (!user || (user.role !== 'founder' && user.role !== 'manager')) {
        return ctx.answerCbQuery('❌ У вас нет прав для подтверждения.', { show_alert: true });
    }

    const { error } = await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);

    if (error) {
        return ctx.answerCbQuery('❌ Ошибка обновления статуса.', { show_alert: true });
    }

    await ctx.editMessageText(
        ctx.callbackQuery.message.text + '\n\n✅ ОПЛАЧЕНО И ПОДТВЕРЖДЕНО!'
    );

    await ctx.answerCbQuery('✅ Покупка подтверждена! Реферальный бонус начислен.', { show_alert: true });
});

// Если мы НЕ на Vercel (например, запускаем локально или на VPS)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    bot.launch().then(() => console.log('Bot is running locally (Long Polling)...'));
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Экспортируем бота для Vercel (webhook)
module.exports = bot;
