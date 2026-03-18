const { Telegraf, session } = require('telegraf');
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

    await ctx.reply(`Привет, ${username}! 🚀\n\nЯ твой персональный менеджер по eSIM. Помогу выбрать лучший интернет для твоей поездки.\n\nКуда летим? 🌍`);
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

    // Get AI response with Salesperson character
    const aiResponse = await getChatResponse(SALES_SYSTEM_PROMPT(tariffs), history, userText);

    // 1. Detect Sale Request [SALE_REQUEST: UUID]
    const saleMatch = aiResponse.match(/\[SALE_REQUEST:\s*([a-f0-9-]+)\]/i);
    let finalResponse = aiResponse.replace(/\[SALE_REQUEST:.*?\]/gi, '').trim();

    if (saleMatch) {
        const tariffId = saleMatch[1];
        const tariff = tariffs.find(t => t.id === tariffId);

        if (tariff) {
            await createOrder(telegramId, tariffId);

            finalResponse += `\n\n💳 **Вот ссылка на оплату:** ${tariff.payment_link || 'Обратись к менеджеру'}\n\nКак только оплатишь, я передам инфо коллегам!`;

            await saveMessage(telegramId, 'assistant', finalResponse);
            await ctx.reply(finalResponse, { parse_mode: 'Markdown' });

            if (tariff.payment_qr_url) {
                try {
                    await ctx.replyWithPhoto(tariff.payment_qr_url, {
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
                            `Цена: $${tariff.price_usd}`
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

// Если мы НЕ на Vercel (например, запускаем локально или на VPS)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    bot.launch().then(() => console.log('Bot is running locally (Long Polling)...'));
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Экспортируем бота для Vercel (webhook)
module.exports = bot;
