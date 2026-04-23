const { getLocalizedText } = require('./openai');

const dictionary = {
    '❌ Отмена': {
        en: '❌ Cancel',
        tr: '❌ İptal',
        de: '❌ Abbrechen',
        pl: '❌ Anuluj',
        ar: '❌ إلغاء',
        fa: '❌ لغو'
    },
    '❌ Обращение в поддержку отменено.': {
        en: '❌ Support request cancelled.',
        tr: '❌ Destek talebi iptal edildi.',
        de: '❌ Support-Anfrage abgebrochen.',
        pl: '❌ Zgłoszenie do pomocy anulowane.',
        ar: '❌ تم إلغاء طلب الدعم.',
        fa: '❌ درخواست پشتیبانی لغو شد.'
    },
    '✅ Ваше сообщение передано менеджеру. Спасибо!': {
        en: '✅ Your message has been forwarded to the manager. Thank you!',
        tr: '✅ Mesajınız yöneticiye iletildi. Teşekkürler!',
        de: '✅ Ihre Nachricht wurde an den Manager weitergeleitet. Vielen Dank!',
        pl: '✅ Twoja wiadomość została przekazana do menedżera. Dziękujemy!',
        ar: '✅ تم توجيه رسالتك إلى المدير. شكرًا لك!',
        fa: '✅ پیام شما به مدیر ارسال شد. متشکرم!'
    },
    '✅ Ваше вложение передано менеджеру. Спасибо!': {
        en: '✅ Your attachment has been forwarded to the manager. Thank you!',
        tr: '✅ Dosyanız yöneticiye iletildi. Teşekkürler!',
        de: '✅ Ваш файл был передан менеджеру. Спасибо!',
        pl: '✅ Twój załącznik został przekazany do menedżera. Dziękujemy!',
        ar: '✅ تم توجيه المرفق إلى المدير. شكرًا لك!',
        fa: '✅ پیوست شما به مدیر ارسال شد. متشکرم!'
    }
};

async function t(lang, text) {
    if (!lang || lang === 'ru') return text;
    
    // 1. Try AI first as requested
    try {
        const aiResult = await getLocalizedText(lang, text);
        if (aiResult && aiResult !== text) {
            return aiResult;
        }
    } catch (e) {
        console.warn(`[LOCALIZER] AI translation failed for "${text}": ${e.message}`);
    }

    // 2. Fallback to dictionary for speed/safety
    if (dictionary[text] && dictionary[text][lang]) {
        return dictionary[text][lang];
    }
    
    return text;
}

module.exports = { t };
