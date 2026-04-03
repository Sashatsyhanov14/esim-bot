import React, { useState } from 'react';

interface WithdrawModalProps {
    isOpen: boolean;
    onClose: () => void;
    balance: number;
    lang: string;
    telegramId?: number;
}

const translations: Record<string, any> = {
    ru: {
        title: "Вывод бонусов",
        amountLabel: "Выводимая сумма: {balance} $",
        methodLabel: "Способ выплаты (Карта / USDT / Номер)",
        methodPlaceholder: "Реквизиты...",
        submit: "Отправить запрос",
        alert: "Заявка на вывод {amount} $ ({method}) отправлена менеджеру!"
    },
    en: {
        title: "Withdraw Bonuses",
        amountLabel: "Amount to withdraw: {balance} $",
        methodLabel: "Payout Method (Card / USDT / Number)",
        methodPlaceholder: "Details...",
        submit: "Submit Request",
        alert: "Withdrawal request for {amount} $ ({method}) sent to manager!"
    },
    de: {
        title: "Boni auszahlen",
        amountLabel: "Betrag (Max: {balance} $)",
        amountPlaceholder: "0.00",
        methodLabel: "Auszahlungsmethode (Karte / USDT / Nummer)",
        methodPlaceholder: "Details...",
        submit: "Anfrage senden",
        alert: "Auszahlungsanfrage über {amount} $ ({method}) an Manager gesendet!"
    },
    pl: {
        title: "Wypłata Bonusów",
        amountLabel: "Kwota (Maks: {balance} $)",
        amountPlaceholder: "0.00",
        methodLabel: "Metoda Wypłaty (Karta / USDT / Numer)",
        methodPlaceholder: "Dane konta...",
        submit: "Wyślij zapytanie",
        alert: "Prośba o wypłatę {amount} $ ({method}) wysłana do menedżera!"
    },
    ar: {
        title: "سحب المكافآت",
        amountLabel: "المبلغ (الحد الأقصى: {balance} $)",
        amountPlaceholder: "0.00",
        methodLabel: "طريقة الدفع (بطاقة / USDT / رقم)",
        methodPlaceholder: "التفاصيل...",
        submit: "إرسال طلب",
        alert: "تم إرسال طلب سحب {amount} $ ({method}) إلى المدير!"
    },
    fa: {
        title: "برداشت پاداش‌ها",
        amountLabel: "مبلغ (حداکثر: {balance} $)",
        amountPlaceholder: "0.00",
        methodLabel: "روش پرداخت (کارت / USDT / شماره)",
        methodPlaceholder: "مشخصات...",
        submit: "ارسال درخواست",
        alert: "درخواست برداشت {amount} $ ({method}) به مدیر ارسال شد!"
    },
    tr: {
        title: "Bonus Çekimi",
        amountLabel: "Çekilecek tutar: {balance} $",
        methodLabel: "Ödeme Yöntemi (Kart / USDT / Numara)",
        methodPlaceholder: "Hesap Bilgileri...",
        submit: "Talebi Gönder",
        alert: "Çekim talebi {amount} $ ({method}) yöneticiye gönderildi!"
    }
};

const WithdrawModal: React.FC<WithdrawModalProps> = ({ isOpen, onClose, balance, lang, telegramId }) => {
    const [method, setMethod] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const t = translations[lang] || translations['en'];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!telegramId || balance <= 0) return;

        setLoading(true);
        try {
            await fetch('/api/withdraw-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegram_id: telegramId, amount: balance, method })
            });
            alert(t.alert.replace('{amount}', String(balance)).replace('{method}', method));
            onClose();
        } catch (err) {
            alert("Error sending request");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white dark:bg-[#1a191d] border border-white/5 rounded-t-2xl sm:rounded-2xl p-6 shadow-[0_30px_60px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300 text-on-surface">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold font-headline">{t.title}</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-surface-container-highest transition-colors flex items-center justify-center">
                        <span className="material-symbols-outlined text-on-surface-variant">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 font-body">
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 mb-4 animate-in fade-in zoom-in duration-300">
                        <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-1 opacity-60">{t.amountLabel.split(':')[0]}</p>
                        <p className="text-2xl font-headline font-extrabold text-primary">${balance.toFixed(2)}</p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm text-on-surface-variant font-bold uppercase tracking-wide">{t.methodLabel}</label>
                        <input
                            type="text"
                            required
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="w-full p-3 flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary/50"
                            placeholder={t.methodPlaceholder}
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-4 text-sm uppercase tracking-widest font-bold bg-primary/20 text-primary border border-primary/30 rounded-xl shadow-[0_0_15px_rgba(208,188,255,0.1)] hover:bg-primary/30 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {loading ? '...' : t.submit}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default WithdrawModal;
