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
bot.on(['photo', 'document', 'text'], async (ctx, next) => {
    const senderId = ctx.from.id;

    // Skip if it's the start command
    if (ctx.message.text && ctx.message.text.startsWith('/start')) return next();

    const { data: sender } = await getUser(senderId);
    const isManager = sender && (sender.role === 'manager' || sender.role === 'founder' || senderId === MANAGER_ID);

    if (!isManager) {
        return next();
    }

    // 1. Session flow (using "Send QR" button)
    if (ctx.session && ctx.session.awaitingQR) {
        const { orderId, userId } = ctx.session.awaitingQR;

        const clientLang = userLangCache[userId] || 'ru';
        const caption = clientLang === 'tr'
            ? `🎉 eSIM'iniz hazır! İşte bağlantınız/kurulum bilgileriniz. İyi yolculuklar! 🌍`
            : `🎉 Твой eSIM готов! Вот информация для установки. Приятного путешествия! 🌍`;

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
                await bot.telegram.sendMessage(userId, `${caption}\n\n${ctx.message.text}`);
                qrSent = true;
            }
        } catch (err) {
            console.error('Failed to send payload to client:', err.message);
            return ctx.reply('❌ Ошибка отправки клиенту.');
        }

        if (qrSent) {
            await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId);
            ctx.session.awaitingQR = null;

            // --- REFERRAL PAYOUT: 15% of tariff price ---
            try {
                const { data: buyer } = await supabase.from('users').select('referrer_id').eq('telegram_id', userId).single();
                const { data: orderRow } = await supabase.from('orders').select('tariff_id').eq('id', orderId).single();
                if (buyer?.referrer_id && orderRow?.tariff_id) {
                    const { data: tariffRow } = await supabase.from('tariffs').select('price_usd').eq('id', orderRow.tariff_id).single();
                    if (tariffRow?.price_usd) {
                        const reward = Math.round(tariffRow.price_usd * 0.15 * 100) / 100; // 15%, 2 decimal
                        const { data: refUser } = await supabase.from('users').select('balance').eq('telegram_id', buyer.referrer_id).single();
                        const newBalance = Math.round(((refUser?.balance || 0) + reward) * 100) / 100;
                        await supabase.from('users').update({ balance: newBalance }).eq('telegram_id', buyer.referrer_id);
                        // Notify referrer
                        try {
                            await bot.telegram.sendMessage(buyer.referrer_id, `💰 Вам начислено $${reward} (15% от продажи eSIM)! Ваш новый баланс: $${newBalance}`);
                        } catch (e) { }
                    }
                }
            } catch (e) {
                console.error('Referral payout error:', e.message);
            }
            // -------------------------------------------------

            // Schedule delayed message (2 minutes)
            setTimeout(async () => {
                const delayText = clientLang === 'tr'
                    ? `Gösterdiğiniz ilgi ve ayırdığınız zaman için teşekkür ederiz. İyi yolculuklar dilerim! ✈️ eSIM'iniz aktif — internet vardığınızda çalışacaktır, eğer zaten yurtdışındaysanız bağlantı hazırdır. eSIM profili için veri dolaşımını açmayı unutmayın.\n\nŞeffaf fiyatlar, yorumlar ve 7/24 destek sunan dijital platformumuz eMedeo uygulamasını yüklemenizi öneririz. Transfer, araç/ev kiralama, turlar, alışveriş ve hukuki danışmanlık hizmetlerini doğrudan, aracısız alın.\n\nBir şeyler ters giderse yanınızdayız: 7/24 destek sohbeti.\n\nUygulamamız:\nAndroid: https://play.google.com/store/apps/details?id=com.emedeo.codeware\nIOS: https://apps.apple.com/app/emedeo/id6738978452`
                    : `Благодарим за проявленный интерес и уделенное нам время. Желаю Вам Счастливого пути! ✈️ Ваша eSIM активна — интернет заработает по прилёту, а если вы уже за границей, связь уже доступна. Не забудьте включить роуминг данных для профиля eсим.\n\nРекомендуем установить приложение eMedeo — цифровую платформу с прозрачными ценами, отзывами и поддержкой 24/7. Получайте трансфер, аренду авто/жилья, экскурсии, покупки и юридические консультации напрямую, без посредников.\n\nМы рядом, если что-то пойдёт не так: чат поддержки 24/7\n\nНаше приложение:\nAndroid: https://play.google.com/store/apps/details?id=com.emedeo.codeware\nIOS: https://apps.apple.com/app/emedeo/id6738978452`;

                try {
                    await bot.telegram.sendPhoto(userId, 'https://drive.google.com/uc?export=view&id=1zxDZ_QkKYu6VKFlS7nNlRktlLKLxSx47', {
                        caption: delayText
                    });
                } catch (err) {
                    try {
                        await bot.telegram.sendMessage(userId, delayText, { disable_web_page_preview: true });
                    } catch (e) { }
                }
            }, 2 * 60 * 1000);

            return ctx.reply('✅ Данные успешно отправлены клиенту! Покупка зачтена (paid) и рефералу зачислены бонусы.');
        }
    }

    // 2. Legacy Flow (Manager sends photo with caption containing client ID)
    if (ctx.message.photo || ctx.message.document) {
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
        }
        return; // Handled
    }

    return next();
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

    // Only prompt for promo code if user didn't arrive via a referral link/QR
    const noReferralUsed = !startPayload || isNaN(startPayload);

    const welcomeParams = lang === 'tr'
        ? {
            text: `Merhaba, ${username}! 🚀\n\nBen senin kişisel eSIM yöneticinim. Seyahatin için en iyi internet paketini seçmene yardımcı olacağım.\n\n${noReferralUsed && !user.referrer_id ? '🎁 Bir promosyon kodunuz varsa, şimdi gönderebilirsiniz (sadece numarayı yazın).\n\n' : ''}Nereye uçuyoruz? 🌍`,
            btn: '📱 Paneli Aç'
        }
        : {
            text: `Привет, ${username}! 🚀\n\nЯ твой персональный менеджер по eSIM. Помогу выбрать лучший интернет для твоей поездки.\n\n${noReferralUsed && !user.referrer_id ? '🎁 Если у тебя есть промокод, можешь прислать его прямо сейчас (просто цифры без пробелов).\n\n' : ''}Куда летим? 🌍`,
            btn: '📱 Открыть Дашборд'
        };

    await ctx.reply(welcomeParams.text,
        Markup.inlineKeyboard([
            [Markup.button.webApp(welcomeParams.btn, 'https://esim-bot.vercel.app')]
        ])
    );
});

bot.command('ref', async (ctx) => {
    const telegramId = ctx.from.id;
    const lang = ctx.from.language_code === 'tr' ? 'tr' : 'ru';
    const refLink = `https://t.me/eesimtestbot?start=${telegramId}`;

    const text = lang === 'tr'
        ? `🎁 İşte davet linkiniz ve QR kodunuz:\n\n${refLink}\n\nPromosyon kodunuz (linki açamayanlar için): \`${telegramId}\``
        : `🎁 Вот твоя пригласительная ссылка и QR-код:\n\n${refLink}\n\nТвой промокод (для ввода вручную): \`${telegramId}\``;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(refLink)}&margin=10`;

    try {
        await ctx.replyWithPhoto(qrUrl, { caption: text, parse_mode: 'Markdown' });
    } catch (err) {
        await ctx.reply(text, { parse_mode: 'Markdown', disable_web_page_preview: true });
    }
});

bot.on('text', async (ctx) => {
    const telegramId = ctx.from.id;
    if (telegramId === MANAGER_ID) return;

    const username = ctx.from.username || ctx.from.first_name;
    const userText = ctx.message.text.trim();

    const lang = ctx.from.language_code === 'tr' ? 'tr' : 'ru';
    userLangCache[telegramId] = lang;

    let { data: user } = await getUser(telegramId);
    if (!user) {
        return ctx.reply(lang === 'tr' ? 'Başlamak için /start\'a basın.' : 'Нажми /start для начала.');
    }

    // --- PROMO CODE LOGIC ---
    if (!user.referrer_id && /^\d{6,15}$/.test(userText)) {
        const promoId = parseInt(userText);
        if (promoId !== telegramId) {
            const { data: promoUser } = await getUser(promoId);
            if (promoUser) {
                await supabase.from('users').update({ referrer_id: promoId }).eq('telegram_id', telegramId);
                user.referrer_id = promoId;

                const successText = lang === 'tr'
                    ? '✅ Promosyon kodu başarıyla uygulandı! Teşekkürler.\n\nŞimdi nereye uçtuğumuzu söyle? 🌍'
                    : '✅ Промокод успешно применен! Спасибо.\n\nА теперь подскажи, куда летим? 🌍';
                return ctx.reply(successText);
            }
        }

        const failText = lang === 'tr'
            ? '❌ Geçersiz promosyon kodu.'
            : '❌ Неверный или недействительный промокод.';
        return ctx.reply(failText);
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

            // Restore AI Payment QR Automated Reply
            if (tariff.payment_qr_url) {
                let finalQrUrl = tariff.payment_qr_url;
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

    ctx.session = ctx.session || {};
    ctx.session.awaitingQR = { orderId, userId: order.user_id };

    try {
        await ctx.editMessageText(
            ctx.callbackQuery.message.text + '\n\n⏳ ОЖИДАНИЕ QR: Отправьте фото или текст в ответ на это сообщение!'
        );
    } catch (e) { }

    await ctx.answerCbQuery('⏳ Отправьте в чат фото или ссылку-приглашение для клиента.', { show_alert: true });
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
