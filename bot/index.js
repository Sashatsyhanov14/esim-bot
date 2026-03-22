const { Telegraf, session, Markup } = require('telegraf');
const dotenv = require('dotenv');
const { supabase, getUser, createUser, getTariffs, saveMessage, getHistory, createOrder, getFaq, clearHistory } = require('./src/supabase');
const { getChatResponse } = require('./src/openai');

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

    // 1. DB-based flow (using "Send QR" button → orders.status='awaiting_qr')
    const { data: pendingOrder } = await supabase
        .from('orders').select('*')
        .eq('assigned_manager', senderId)
        .eq('status', 'awaiting_qr')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (pendingOrder) {
        const orderId = pendingOrder.id;
        const userId = pendingOrder.user_id;

        const rawLang = userLangCache[userId] || 'en';
        const uiLang = rawLang === 'ru' ? 'ru' : (rawLang === 'tr' ? 'tr' : 'en');
        const captions = {
            ru: `🎉 Твой eSIM готов! Вот информация для установки. Приятного путешествия! 🌍`,
            tr: `🎉 eSIM'iniz hazır! İşte bağlantınız/kurulum bilgileriniz. İyi yolculuklar! 🌍`,
            en: `🎉 Your eSIM is ready! Here is your installation info. Have a great trip! 🌍`
        };
        const caption = captions[uiLang];

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
            await supabase.from('orders').update({ status: 'paid', assigned_manager: null }).eq('id', orderId);

            // --- REFERRAL PAYOUT: 15% of tariff price ---
            try {
                const { data: buyer } = await supabase.from('users').select('referrer_id').eq('telegram_id', userId).single();
                if (buyer?.referrer_id && pendingOrder.price_usd) {
                    const reward = Math.round(pendingOrder.price_usd * 0.15 * 100) / 100;
                    const { data: refUser } = await supabase.from('users').select('balance').eq('telegram_id', buyer.referrer_id).single();
                    const newBalance = Math.round(((refUser?.balance || 0) + reward) * 100) / 100;
                    await supabase.from('users').update({ balance: newBalance }).eq('telegram_id', buyer.referrer_id);
                    try {
                        await bot.telegram.sendMessage(buyer.referrer_id, `💰 Вам начислено $${reward} (15% от продажи eSIM)! Ваш новый баланс: $${newBalance}`);
                    } catch (e) { }
                }
            } catch (e) {
                console.error('Referral payout error:', e.message);
            }

            // Schedule delayed promo message (2 minutes)
            const clientLang = rawLang;
            setTimeout(async () => {
                const dLang = clientLang === 'ru' ? 'ru' : (clientLang === 'tr' ? 'tr' : 'en');
                const delayTexts = {
                    ru: `Благодарим за проявленный интерес и уделенное нам время. Желаю Вам Счастливого пути! ✈️ Ваша eSIM активна — интернет заработает по прилёту, а если вы уже за границей, связь уже доступна. Не забудьте включить роуминг данных для профиля eсим.\n\nРекомендуем установить приложение eMedeo — цифровую платформу с прозрачными ценами, отзывами и поддержкой 24/7. Получайте трансфер, аренду авто/жилья, экскурсии, покупки и юридические консультации напрямую, без посредников.\n\nМы рядом, если что-то пойдёт не так: чат поддержки 24/7\n\nНаше приложение:\nAndroid: https://play.google.com/store/apps/details?id=com.emedeo.codeware\nIOS: https://apps.apple.com/app/emedeo/id6738978452`,
                    tr: `Gösterdiğiniz ilgi ve ayırdığınız zaman için teşekkür ederiz. İyi yolculuklar dilerim! ✈️ eSIM'iniz aktif — internet vardığınızda çalışacaktır, eğer zaten yurtdışındaysanız bağlantı hazırdır. eSIM profili için veri dolaşımını açmayı unutmayın.\n\nŞeffaf fiyatlar, yorumlar ve 7/24 destek sunan dijital platformumuz eMedeo uygulamasını yüklemenizi öneririz. Transfer, araç/ev kiralama, turlar, alışveriş ve hukuki danışmanlık hizmetlerini doğrudan, aracısız alın.\n\nBir şeyler ters giderse yanınızdayız: 7/24 destek sohbeti.\n\nUygulamamız:\nAndroid: https://play.google.com/store/apps/details?id=com.emedeo.codeware\nIOS: https://apps.apple.com/app/emedeo/id6738978452`,
                    en: `Thank you for your interest and your time. Have a great trip! ✈️ Your eSIM is active — the internet will work upon arrival, and if you are already abroad, the connection is ready. Don't forget to turn on data roaming for the eSIM profile.\n\nWe recommend installing the eMedeo app — a digital platform with transparent prices, reviews, and 24/7 support. Book transfers, car/home rentals, tours, shopping, and legal consultations directly, without intermediaries.\n\nWe are here if something goes wrong: 24/7 support chat.\n\nOur App:\nAndroid: https://play.google.com/store/apps/details?id=com.emedeo.codeware\nIOS: https://apps.apple.com/app/emedeo/id6738978452`
                };
                const delayText = delayTexts[dLang];
                try {
                    const res = await fetch('https://drive.google.com/uc?export=download&id=1zxDZ_QkKYu6VKFlS7nNlRktlLKLxSx47');
                    const arrayBuffer = await res.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    await bot.telegram.sendPhoto(userId, { source: buffer }, { caption: delayText });
                } catch (err) {
                    console.error('Promo photo error:', err.message);
                    try { await bot.telegram.sendMessage(userId, delayText, { disable_web_page_preview: true }); } catch (e) { }
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

    await clearHistory(telegramId);

    if (startPayload === 'getqr') {
        const rawLang = userLangCache[telegramId] || ctx.from.language_code || 'en';
        const lang = rawLang === 'ru' ? 'ru' : (rawLang === 'tr' ? 'tr' : 'en');
        const refLink = `https://t.me/eesimtestbot?start=${telegramId}`;

        const texts = {
            ru: `🎁 Вот твоя пригласительная ссылка и QR-код:\n\n${refLink}\n\nТвой промокод (для ввода вручную): \`${telegramId}\``,
            tr: `🎁 İşte davet linkiniz ve QR kodunuz:\n\n${refLink}\n\nPromosyon kodunuz (linki açamayanlar için): \`${telegramId}\``,
            en: `🎁 Here is your invitation link and QR code:\n\n${refLink}\n\nYour promo code (for manual entry): \`${telegramId}\``
        };
        const text = texts[lang];
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(refLink)}&margin=10`;

        try {
            await ctx.replyWithPhoto(qrUrl, { caption: text, parse_mode: 'Markdown' });
        } catch (err) {
            await ctx.reply(text, { parse_mode: 'Markdown', disable_web_page_preview: true });
        }
        return;
    }

    const lang = ctx.from.language_code || 'en';

    let { data: user } = await getUser(telegramId);
    if (!user) {
        const referrerId = startPayload && !isNaN(startPayload) ? parseInt(startPayload) : null;
        const { data: newUser, error: createError } = await createUser({
            telegram_id: telegramId,
            username: username,
            referral_id: (referrerId && referrerId !== telegramId) ? referrerId : null,
            balance: 0
        });

        if (createError) {
            console.error('Error creating user:', createError);
            return ctx.reply('Ошибка при регистрации. Пожалуйста, попробуйте позже.');
        }

        user = newUser;
        console.log(`New user: ${username} (${telegramId})`);
    }

    if (!user) {
        return ctx.reply('Не удалось загрузить данные пользователя.');
    }

    const noReferralUsed = !startPayload || isNaN(startPayload);

    const rawLang = lang;
    const uiLang = rawLang === 'ru' ? 'ru' : (rawLang === 'tr' ? 'tr' : 'en');
    const welcomeTexts = {
        ru: {
            text: `Привет, ${username}! 🚀\n\nЯ твой персональный менеджер по eSIM. Помогу выбрать лучший интернет для твоей поездки.\n\n${noReferralUsed && !user.referral_id ? '🎁 Если у тебя есть промокод, можешь прислать его прямо сейчас (просто цифры без пробелов).\n\n' : ''}Куда летим? 🌍`,
            btn: '📱 Открыть Дашборд'
        },
        tr: {
            text: `Merhaba, ${username}! 🚀\n\nBen senin kişisel eSIM yöneticinim. Seyahatin için en iyi internet paketini seçmene yardımcı olacağım.\n\n${noReferralUsed && !user.referral_id ? '🎁 Bir promosyon kodunuz varsa, теперь ты можешь прислать его прямо сейчас (просто цифры без пробелов).\n\n' : ''}Nereye uçuyoruz? 🌍`,
            btn: '📱 Paneli Aç'
        },
        en: {
            text: `Hello, ${username}! 🚀\n\nI am your personal eSIM manager. I will help you choose the best internet package for your trip.\n\n${noReferralUsed && !user.referral_id ? '🎁 If you have a promo code, you can send it right now (just the numbers).\n\n' : ''}Where are we flying? 🌍`,
            btn: '📱 Dashboard'
        }
    };
    const welcomeParams = welcomeTexts[uiLang];

    // Remove any stuck reply keyboard silently
    try {
        const killMsg = await ctx.reply('…', Markup.removeKeyboard());
        await bot.telegram.deleteMessage(ctx.chat.id, killMsg.message_id);
    } catch (e) { }

    await ctx.reply(welcomeParams.text,
        Markup.keyboard([
            [Markup.button.webApp(welcomeParams.btn, 'https://esim-bot.vercel.app')]
        ]).resize()
    );
});

bot.command('ref', async (ctx) => {
    const telegramId = ctx.from.id;
    const rawLang = userLangCache[telegramId] || ctx.from.language_code || 'en';
    const lang = rawLang === 'ru' ? 'ru' : (rawLang === 'tr' ? 'tr' : 'en');
    const refLink = `https://t.me/eesimtestbot?start=${telegramId}`;

    const texts = {
        ru: `🎁 Вот твоя пригласительная ссылка и QR-код:\n\n${refLink}\n\nТвой промокод (для ввода вручную): \`${telegramId}\``,
        tr: `🎁 İşte davet linkiniz ve QR kodunuz:\n\n${refLink}\n\nPromosyon kodunuz (linki açamayanlar için): \`${telegramId}\``,
        en: `🎁 Here is your invitation link and QR code:\n\n${refLink}\n\nYour promo code (for manual entry): \`${telegramId}\``
    };
    const text = texts[lang];

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
        if (data === '/ref') {
            const telegramId = ctx.from.id;
            const rawLang = userLangCache[telegramId] || ctx.from.language_code || 'en';
            const lang = rawLang === 'ru' ? 'ru' : (rawLang === 'tr' ? 'tr' : 'en');
            const refLink = `https://t.me/eesimtestbot?start=${telegramId}`;

            const texts = {
                ru: `🎁 Вот твоя пригласительная ссылка и QR-код:\n\n${refLink}\n\nТвой промокод (для ввода вручную): \`${telegramId}\``,
                tr: `🎁 İşte davet linkiniz ve QR kodunuz:\n\n${refLink}\n\nPromosyon kodunuz (linki açamayanlar için): \`${telegramId}\``,
                en: `🎁 Here is your invitation link and QR code:\n\n${refLink}\n\nYour promo code (for manual entry): \`${telegramId}\``
            };
            const text = texts[lang];
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(refLink)}&margin=10`;

            try {
                await ctx.replyWithPhoto(qrUrl, { caption: text, parse_mode: 'Markdown' });
            } catch (err) {
                await ctx.reply(text, { parse_mode: 'Markdown', disable_web_page_preview: true });
            }
        }
        return;
    }
    return next();
});

bot.on('text', async (ctx) => {
    const telegramId = ctx.from.id;
    if (telegramId === MANAGER_ID) return;

    const username = ctx.from.username || ctx.from.first_name;
    const userText = ctx.message.text.trim();

    const systemLang = ctx.from.language_code || 'en';
    if (!userLangCache[telegramId]) {
        userLangCache[telegramId] = systemLang;
    }
    const currentLang = userLangCache[telegramId];
    const uiLang = currentLang === 'ru' ? 'ru' : (currentLang === 'tr' ? 'tr' : 'en');

    let { data: user } = await getUser(telegramId);
    if (!user) {
        const msg = { ru: 'Нажми /start для начала.', tr: 'Başlamak için /start\'a basın.', en: 'Press /start to begin.' };
        return ctx.reply(msg[uiLang], Markup.removeKeyboard());
    }

    // --- PROMO CODE LOGIC ---
    if (!user.referrer_id && /^\d{6,15}$/.test(userText)) {
        const promoId = parseInt(userText);
        if (promoId !== telegramId) {
            const { data: promoUser } = await getUser(promoId);
            if (promoUser) {
                await supabase.from('users').update({ referrer_id: promoId }).eq('telegram_id', telegramId);
                user.referrer_id = promoId;

                const successTexts = {
                    ru: '✅ Промокод успешно применен! Спасибо.\n\nА теперь подскажи, куда летим? 🌍',
                    tr: '✅ Promosyon kodu başarıyla uygulandı! Teşekkürler.\n\nŞimdi nereye uçtuğumuzu söyle? 🌍',
                    en: '✅ Promo code applied successfully! Thank you.\n\nNow, tell me, where are we flying? 🌍'
                };
                return ctx.reply(successTexts[uiLang]);
            }
        }

        const failTexts = { ru: '❌ Неверный или недействительный промокод.', tr: '❌ Geçersiz promosyon kodu.', en: '❌ Invalid promo code.' };
        return ctx.reply(failTexts[uiLang]);
    }

    const { data: history } = await getHistory(telegramId);
    const { data: tariffs } = await getTariffs();

    await saveMessage(telegramId, 'user', userText);

    try { await ctx.sendChatAction('typing'); } catch (e) { }

    const { data: faqRows } = await getFaq();
    let faqText = '';
    if (faqRows && faqRows.length > 0) {
        faqText = faqRows.map(f => `- ${f.topic}: ${f.content_ru}`).join('\n');
    }

    // Get AI response with Multi-Agent System (Analyzer -> Writer)
    const aiResponse = await getChatResponse(tariffs, faqText, history, userText);

    // AI Language detection tag extraction [LANG:code]
    const langMatch = aiResponse.match(/\[LANG:\s*(ru|tr|en)\]/i);
    if (langMatch) {
        userLangCache[telegramId] = langMatch[1].toLowerCase();
    }

    // 1. Detect Sale Request [SALE_REQUEST: UUID]
    const saleMatch = aiResponse.match(/\[SALE_REQUEST:\s*([a-f0-9-]+)\]/i);
    let finalResponse = aiResponse.replace(/\[SALE_REQUEST:.*?\]/gi, '').replace(/\[LANG:.*?\]/gi, '').trim();

    if (saleMatch) {
        const tariffId = saleMatch[1];
        const tariff = tariffs.find(t => t.id === tariffId);

        if (tariff) {
            const { data: orderData } = await createOrder(telegramId, tariffId, tariff.price_usd);

            // Fetch dynamic uiLang strictly from userLangCache updated by AI
            const rawLang = userLangCache[telegramId] || ctx.from.language_code || 'en';
            const uiLang = rawLang === 'ru' ? 'ru' : (rawLang === 'tr' ? 'tr' : 'en');
            const payTexts = {
                ru: `\n\n👇 **Оплатить онлайн:**\n${tariff.payment_link || 'Обратись к менеджеру'}\n\n✅ *Сразу после успешной оплаты мы вышлем твой тариф!*`,
                tr: `\n\n👇 **Online Öde:**\n${tariff.payment_link || 'Yöneticiye başvurun'}\n\n✅ *Başarılı ödemeden hemen sonra tarifenizi göndereceğiz!*`,
                en: `\n\n👇 **Pay Online:**\n${tariff.payment_link || 'Contact a manager'}\n\n✅ *We will send your eSIM immediately after successful payment!*`
            };
            const payText = payTexts[uiLang];

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
                const captionTexts = {
                    ru: `QR-код для оплаты тарифа ${tariff.country}`,
                    tr: `${tariff.country} tarifesi için ödeme QR kodu`,
                    en: `Payment QR code for the ${tariff.country} plan`
                };
                try {
                    await ctx.replyWithPhoto(finalQrUrl, {
                        caption: captionTexts[uiLang]
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
                        const mLangRaw = userLangCache[manager.telegram_id] || 'ru';
                        const mLang = mLangRaw === 'ru' ? 'ru' : (mLangRaw === 'tr' ? 'tr' : 'en');

                        const managerTexts = {
                            ru: {
                                alert: `🚀 **ЗАКАЗ!**\n\nЮзер: @${username} (ID: ${telegramId})\nТариф: ${tariff.country} | ${tariff.data_gb} на ${tariff.validity_period}\nЦена: $${tariff.price_usd}\n\n⚠️ ВАЖНО: Подтвердите оплату перед тем как скидывать QR!`,
                                sendBtn: '📤 Отправить QR',
                                cancelBtn: '❌ Отменить'
                            },
                            tr: {
                                alert: `🚀 **SİPARİŞ!**\n\nKullanıcı: @${username} (ID: ${telegramId})\nTarife: ${tariff.country} | ${tariff.data_gb} - ${tariff.validity_period}\nFiyat: $${tariff.price_usd}\n\n⚠️ ÖNEMLİ: QR'ı göndermeden önce ödemeyi onaylayın!`,
                                sendBtn: '📤 QR Gönder',
                                cancelBtn: '❌ İptal'
                            },
                            en: {
                                alert: `🚀 **ORDER!**\n\nUser: @${username} (ID: ${telegramId})\nPlan: ${tariff.country} | ${tariff.data_gb} for ${tariff.validity_period}\nPrice: $${tariff.price_usd}\n\n⚠️ IMPORTANT: Verify payment before sending the QR!`,
                                sendBtn: '📤 Send QR',
                                cancelBtn: '❌ Cancel'
                            }
                        };
                        const mt = managerTexts[mLang];

                        await bot.telegram.sendMessage(manager.telegram_id, mt.alert,
                            orderData ? Markup.inlineKeyboard([
                                [
                                    Markup.button.callback(mt.sendBtn, `sendqr_${orderData.id}`),
                                    Markup.button.callback(mt.cancelBtn, `cancel_${orderData.id}`)
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

    // Persist awaiting state in DB (survives Vercel webhook restarts)
    await supabase.from('orders').update({ status: 'awaiting_qr', assigned_manager: telegramId }).eq('id', orderId);

    try {
        await ctx.editMessageText(
            ctx.callbackQuery.message.text + '\n\n⏳ ОЖИДАНИЕ QR: Отправьте фото или текст в ответ на это сообщение!',
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Отменить ожидание', `cancelqr_${orderId}`)]
            ])
        );
    } catch (e) { }

    await ctx.answerCbQuery('⏳ Отправьте в чат фото или ссылку-приглашение для клиента.', { show_alert: true });
});

bot.action(/^cancelqr_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const telegramId = ctx.from.id;

    const { data: user } = await getUser(telegramId);
    if (!user || (user.role !== 'founder' && user.role !== 'manager')) {
        return ctx.answerCbQuery('❌ У вас нет прав.', { show_alert: true });
    }

    // Clear DB waiting state
    await supabase.from('orders').update({ status: 'pending', assigned_manager: null }).eq('id', orderId);

    try {
        await ctx.editMessageText(
            ctx.callbackQuery.message.text.replace('\n\n⏳ ОЖИДАНИЕ QR: Отправьте фото или текст в ответ на это сообщение!', '') + '\n\n🛑 Ожидание отменено оператором.',
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('📤 Отправить QR', `sendqr_${orderId}`),
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
