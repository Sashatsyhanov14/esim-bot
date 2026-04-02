import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import WithdrawModal from './components/WithdrawModal';
import AdminStats from './components/AdminStats';
import AdminTariffs from './components/AdminTariffs';
import AdminFaq from './components/AdminFaq';
import ClientCatalog from './components/ClientCatalog';

declare global {
  interface Window {
    Telegram: any;
  }
}

const translations = {
  ru: {
    adminTitle: "Панель Основателя",
    adminSubtitle: "Глобальная статистика",
    overview: "Обзор проекта",
    overviewDesc: "Все пользователи и активные заказы.",
    totalUsers: "Всего юзеров",
    totalSales: "Выручка",
    manageManagers: "Управление Менеджерами",
    assignEmployee: "Назначить сотрудника",
    enterTgId: "Введите Telegram ID",
    activeEmployees: "Действующие сотрудники",
    managerAddError: "ОШИБКА: Этот пользователь еще ни разу не запускал бота! Пусть нажмет /start в боте.",
    managerAddSuccess: "Успех! ID {id} теперь Менеджер.",
    managerRemoveSuccess: "Сотрудник {id} удален.",
    managerAddFail: "Ошибка при добавлении менеджера.",
    ownerBadge: "Владелец",
    balance: "Баланс",
    invitedCount: "Приглашены",
    userTitle: "Бонусы",
    userSubtitle: "Твоя статистика",
    bonusBalance: "Твой бонусный баланс",
    withdraw: "Вывести",
    invitedLabel: "Приглашено",
    boughtEsimLabel: "Активаций",
    inviteFriend: "Пригласить друга",
    tabReferral: "Бонусы",
    tabCatalog: "Каталог",
    tabStats: "Статистика",
    tabTariffs: "Тарифы",
    tabFaq: "FAQ",
    loginTitle: "Вход в панель",
    loginDesc: "Открыто вне Telegram. Введите свой Telegram ID для доступа.",
    loginPlaceholder: "Введите ID (например, 12345678)",
    loginBtn: "Войти",
    loading: "Загрузка данных...",
    linkCopied: "Ссылка скопирована!",
    promoTitle: "Поделись ссылкой или Промокодом:",
    promoLabel: "ПРОМОКОД",
    getQrChat: "Получить QR в чат",
    enterPromoPlaceholder: "Введите промокод (ID друга)",
    applyPromoBtn: "Применить",
    promoSuccess: "Промокод успешно применён!",
    promoError: "Неверный промокод или ошибка.",
    // Admin Tariffs
    manageTariffs: "Управление тарифами",
    addTariff: "Добавить",
    newTariff: "Новый тариф",
    editTariff: "Редактировать",
    sortNumber: "Сортировка (1, 2...)",
    country: "Страна (Turkiye, Europe)",
    traffic: "Трафик (1 Gb, unlimited)",
    validity: "Срок (7 days)",
    price: "Цена USD (10.50)",
    qrLink: "QR ссылка (https://...)",
    paymentLink: "Ссылка на оплату (https://...)",
    isActive: "Активен",
    saveBtn: "Сохранить",
    cancelBtn: "Отмена",
    deleteConfirm: "Точно удалить тариф?",
    linkQr: "QR",
    linkPay: "Оплата",
    // Admin FAQ
    manageFaq: "Управление FAQ",
    addFaq: "Добавить",
    newFaq: "Новый FAQ",
    editFaq: "Редактировать",
    faqTopic: "Тема / Вопрос",
    faqContent: "Ответ (на русском)...",
    deleteFaqConfirm: "Точно удалить этот вопрос?",
    // Admin Stats
    tabOrders: "Заказы",
    tabUsers: "Юзеры",
    analyzing: "Анализ базы...",
    noOrders: "Нет заказов",
    invitedLabelStats: "ПРИГЛАСИЛ:",
    purchasesLabel: "ПОКУПОК:",
    spentLabel: "Потратил",
    hideAll: "Скрыть ⬆",
    showAll: "Показать все ({count}) ⬇",
    deletedTariff: "Удаленный тариф",
    unknownUser: "Неизвестный",
    statuses: {
      all: "ВСЕ",
      paid: "ОПЛАЧЕН",
      pending: "В ОЖИДАНИИ",
      awaiting_qr: "ЖДЕТ QR",
      cancelled: "ОТМЕНЕН"
    }
  },
  tr: {
    adminTitle: "Kurucu Paneli",
    adminSubtitle: "Küresel İstatistikler",
    overview: "Proje İncelemesi",
    overviewDesc: "Tüm kullanıcılar ve aktif siparişler.",
    totalUsers: "Toplam Kullanıcı",
    totalSales: "Ciro",
    manageManagers: "Yönetici Yönetimi",
    assignEmployee: "Çalışan Ata",
    enterTgId: "Telegram ID girin",
    activeEmployees: "Aktif Çalışanlar",
    managerAddError: "HATA: Bu kullanıcı botu hiç başlatmamış! Botta /start'a bassın.",
    managerAddSuccess: "Başarı! ID {id} artık Yönetici.",
    managerRemoveSuccess: "Çalışan {id} kaldırıldı.",
    managerAddFail: "Yönetici eklerken hata oluştu.",
    ownerBadge: "Sahibi",
    balance: "Bakiye",
    invitedCount: "Kişi",
    userTitle: "Bonuslar",
    userSubtitle: "İstatistiklerin",
    bonusBalance: "Bonus Bakiyen",
    withdraw: "Para Çek",
    invitedLabel: "Davet Edildi",
    boughtEsimLabel: "Aktivasyonlar",
    inviteFriend: "Arkadaş Davet Et",
    tabReferral: "Bonuslar",
    tabCatalog: "Katalog",
    tabStats: "İstatistik",
    tabTariffs: "Tarifeler",
    tabFaq: "SSS",
    loginTitle: "Panele Giriş",
    loginDesc: "Telegram dışında açıldı. Erişim için Telegram ID'nizi girin.",
    loginPlaceholder: "ID girin (örn. 12345678)",
    loginBtn: "Giriş Yap",
    loading: "Veriler yükleniyor...",
    linkCopied: "Bağlantı kopyalandı!",
    promoTitle: "Bağlantınızı veya Promosyon Kodunuzu paylaşın:",
    promoLabel: "PROMO",
    getQrChat: "QR'ı Sohbete Al",
    enterPromoPlaceholder: "Arkadaşınızın kodunu (ID) girin",
    applyPromoBtn: "Uygula",
    promoSuccess: "Promosyon kodu uygulandı!",
    promoError: "Geçersiz kod veya hata.",
    // Admin Tariffs
    manageTariffs: "Tarife Yönetimi",
    addTariff: "Ekle",
    newTariff: "Yeni Tarife",
    editTariff: "Düzenle",
    sortNumber: "Sıralama (1, 2...)",
    country: "Ülke (Türkiye, Europe)",
    traffic: "İnternet (1 GB, sınırsız)",
    validity: "Süre (7 gün)",
    price: "Fiyat USD (10.50)",
    qrLink: "QR Bağlantısı (https://...)",
    paymentLink: "Ödeme Bağlantısı (https://...)",
    isActive: "Aktif",
    saveBtn: "Kaydet",
    cancelBtn: "İptal",
    deleteConfirm: "Tarifi silmek istediğinize emin misiniz?",
    linkQr: "QR",
    linkPay: "Ödeme",
    // Admin FAQ
    manageFaq: "SSS Yönetimi",
    addFaq: "Ekle",
    newFaq: "Yeni SSS",
    editFaq: "Düzenle",
    faqTopic: "Konu / Soru",
    faqContent: "Cevap (Rusça)...",
    deleteFaqConfirm: "Bu soruyu silmek istediğinize emin misiniz?",
    // Admin Stats
    tabOrders: "Siparişler",
    tabUsers: "Kullanıcılar",
    analyzing: "Veritabanı Analizi...",
    noOrders: "Sipariş Yok",
    invitedLabelStats: "DAVET ETTİ:",
    purchasesLabel: "SATIN ALMALAR:",
    spentLabel: "Harcadı",
    hideAll: "Gizle ⬆",
    showAll: "Tümünü Göster ({count}) ⬇",
    deletedTariff: "Silinmiş Tarife",
    unknownUser: "Bilinmeyen",
    statuses: {
      all: "HEPSİ",
      paid: "ÖDENDİ",
      pending: "BEKLİYOR",
      awaiting_qr: "QR BEKLİYOR",
      cancelled: "İPTAL"
    }
  },
  en: {
    adminTitle: "Founder Panel",
    adminSubtitle: "Global Statistics",
    overview: "Project Overview",
    overviewDesc: "All users and active orders.",
    totalUsers: "Total Users",
    totalSales: "Revenue",
    manageManagers: "Manager Management",
    assignEmployee: "Assign Employee",
    enterTgId: "Enter Telegram ID",
    activeEmployees: "Active Employees",
    managerAddError: "ERROR: This user hasn't started the bot! Tell them to press /start.",
    managerAddSuccess: "Success! ID {id} is now a Manager.",
    managerRemoveSuccess: "Employee {id} removed.",
    managerAddFail: "Error adding manager.",
    ownerBadge: "Owner",
    balance: "Balance",
    invitedCount: "Invited",
    userTitle: "Bonuses",
    userSubtitle: "Your Statistics",
    bonusBalance: "Your Bonus Balance",
    withdraw: "Withdraw",
    invitedLabel: "Invited",
    boughtEsimLabel: "Activations",
    inviteFriend: "Invite a Friend",
    tabReferral: "Bonuses",
    tabCatalog: "Catalog",
    tabStats: "Stats",
    tabTariffs: "Tariffs",
    tabFaq: "FAQ",
    loginTitle: "Panel Login",
    loginDesc: "Opened outside of Telegram. Enter your Telegram ID for access.",
    loginPlaceholder: "Enter ID (e.g., 12345678)",
    loginBtn: "Login",
    loading: "Loading data...",
    linkCopied: "Link copied!",
    promoTitle: "Share your Link or Promo Code:",
    promoLabel: "PROMO",
    getQrChat: "Get QR in Chat",
    enterPromoPlaceholder: "Enter friend's code (ID)",
    applyPromoBtn: "Apply",
    promoSuccess: "Promo code applied!",
    promoError: "Invalid code or error.",
    // Admin Tariffs
    manageTariffs: "Tariff Management",
    addTariff: "Add",
    newTariff: "New Tariff",
    editTariff: "Edit",
    sortNumber: "Sort (1, 2...)",
    country: "Country (Turkiye, Europe)",
    traffic: "Traffic (1 GB, unlimited)",
    validity: "Validity (7 days)",
    price: "Price USD (10.50)",
    qrLink: "QR Link (https://...)",
    paymentLink: "Payment Link (https://...)",
    isActive: "Active",
    saveBtn: "Save",
    cancelBtn: "Cancel",
    deleteConfirm: "Are you sure you want to delete this tariff?",
    linkQr: "QR",
    linkPay: "Pay",
    // Admin FAQ
    manageFaq: "FAQ Management",
    addFaq: "Add",
    newFaq: "New FAQ",
    editFaq: "Edit",
    faqTopic: "Topic / Question",
    faqContent: "Answer (in Russian)...",
    deleteFaqConfirm: "Are you sure you want to delete this question?",
    // Admin Stats
    tabOrders: "Orders",
    tabUsers: "Users",
    analyzing: "Database Analysis...",
    noOrders: "No Orders",
    invitedLabelStats: "INVITED:",
    purchasesLabel: "PURCHASES:",
    spentLabel: "Spent",
    hideAll: "Hide ⬆",
    showAll: "Show All ({count}) ⬇",
    deletedTariff: "Deleted Tariff",
    unknownUser: "Unknown",
    statuses: {
      all: "ALL",
      paid: "PAID",
      pending: "PENDING",
      awaiting_qr: "AWAITING QR",
      cancelled: "CANCELLED"
    }
  }
};

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loginInputId, setLoginInputId] = useState('');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [purchasedRefsCount, setPurchasedRefsCount] = useState(0);
  const [payoutsHistory, setPayoutsHistory] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState({ totalUsers: 0, totalOrders: 0, totalSales: 0 });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lang, setLang] = useState<'ru' | 'tr'>('ru');

  const [activeTab, setActiveTab] = useState<'referral' | 'catalog' | 'stats' | 'tariffs' | 'faq'>('catalog');

  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    const init = async () => {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
      }

      // 1. Try URL Parameters (uid=) - most reliable for TG Desktop
      const params = new URLSearchParams(window.location.search);
      const uid = params.get('uid');
      if (uid && !isNaN(parseInt(uid))) {
        await fetchUserData(parseInt(uid));
        return;
      }

      // 2. Try Telegram SDK Polling
      let tgUser: any = null;
      for (let i = 0; i < 5; i++) {
        tgUser = tg?.initDataUnsafe?.user;
        if (tgUser?.id) break;
        await new Promise(r => setTimeout(r, 200));
      }

      // 3. Try Raw initData Parsing
      if (!tgUser?.id && tg?.initData) {
        try {
          const paramsRaw = new URLSearchParams(tg.initData);
          const userStr = paramsRaw.get('user');
          if (userStr) tgUser = JSON.parse(decodeURIComponent(userStr));
        } catch {}
      }

      if (tgUser?.id) {
        if (tgUser.language_code === 'tr') setLang('tr');
        await fetchUserData(tgUser.id, tgUser.first_name, tgUser.username);
      } else {
        setLoading(false);
      }
    };
    init();
  }, []);

  const t = translations[lang];

  const toggleLang = () => {
    setLang(lang === 'ru' ? 'tr' : 'ru');
  };

  const renderLangSwitcher = () => (
    <button
      onClick={toggleLang}
      className="bg-surface-container-high hover:bg-surface-container-highest px-3 py-1.5 rounded-full text-[10px] font-extrabold text-on-surface flex items-center gap-1 transition-colors border border-white/5 active:scale-95"
    >
      <span className="material-symbols-outlined text-[14px]">language</span>
      {lang.toUpperCase()}
    </button>
  );

  const fetchUserData = async (tgId: number, firstName?: string, username?: string) => {
    try {
      setLoading(true);
      const { data: userData, error: fetchErr } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tgId)
        .single();

      let currentUser = userData;

      // САМОРЕГ: Если пользователя нет в БД — создаем его
      if (!userData && (fetchErr?.code === 'PGRST116' || !fetchErr)) {
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        const newUser = {
          telegram_id: tgId,
          username: username || firstName || tgUser?.first_name || `user_${tgId}`,
          role: 'client',
          balance: 0
        };
        const { data: created, error: regError } = await supabase.from('users').insert(newUser).select().single();
        if (created) {
          currentUser = created;
          console.log('Self-registration successful for:', tgId);
        } else {
          console.error('Self-registration failed:', regError);
        }
      }

      if (currentUser) {
        setUser(currentUser);
        if (currentUser.role === 'founder' || currentUser.role === 'manager') {
          setActiveTab('stats');
        }

        const { data: refs } = await supabase
          .from('users')
          .select('telegram_id, username, created_at')
          .eq('referrer_id', tgId);

        setReferrals(refs || []);

        if (refs && refs.length > 0) {
          const refIds = refs.map((r: any) => r.telegram_id);
          const { data: orderedRefs } = await supabase
            .from('orders')
            .select('user_id')
            .in('user_id', refIds)
            .eq('status', 'paid');

          const uniqueBuyers = new Set((orderedRefs || []).map((o: any) => o.user_id));
          setPurchasedRefsCount(uniqueBuyers.size);
        }

        const { data: userPayouts } = await supabase.from('chat_history').select('content, created_at').eq('user_id', tgId).eq('role', 'assistant').like('content', 'PAYOUT_RECORD:%').order('created_at', { ascending: false });
        setPayoutsHistory(userPayouts || []);

        if (currentUser.role === 'founder' || currentUser.role === 'manager') {
          const { count: uCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
          const { data: paidOrdersList, count: oCount } = await supabase.from('orders').select('price_usd', { count: 'exact' }).eq('status', 'paid');

          let sumSales = 0;
          if (paidOrdersList) {
            sumSales = paidOrdersList.reduce((acc: number, order: any) => acc + (Number(order.price_usd) || 0), 0);
          }

          setGlobalStats({
            totalUsers: uCount || 0,
            totalOrders: oCount || 0,
            totalSales: sumSales
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refLink = user ? `https://t.me/emedeoesimworld_bot?start=${user.telegram_id}` : '';

  const copyRefLink = () => {
    navigator.clipboard.writeText(refLink);
    tg?.showAlert(t.linkCopied);
  };

  const handleManualLogin = async () => {
    if (!loginInputId) return;
    setLoading(true);
    await fetchUserData(parseInt(loginInputId));
  };

  if (loading) return <div className="p-8 text-center text-on-surface-variant font-body animate-pulse mt-20">{t.loading}</div>;

  if (!user) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center p-6">
        <div className="glass-card p-6 rounded-2xl w-full max-w-sm space-y-6 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary-container/20 border border-primary/20 rounded-full mx-auto flex items-center justify-center mb-4 neon-glow">
              <span className="material-symbols-outlined text-primary text-3xl">login</span>
            </div>
            <h1 className="text-2xl font-headline font-bold text-slate-100">{t.loginTitle}</h1>
            <p className="text-sm font-body text-on-surface-variant">{t.loginDesc}</p>
          </div>
          <div className="space-y-4">
            <input
              type="number"
              value={loginInputId}
              onChange={(e) => setLoginInputId(e.target.value)}
              placeholder={t.loginPlaceholder}
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 text-on-surface focus:outline-none focus:border-primary/50 text-center font-mono"
            />
            <button
              onClick={handleManualLogin}
              className="w-full bg-primary/20 text-primary border border-primary/30 py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(208,188,255,0.1)] hover:bg-primary/30 transition-all active:scale-95"
            >
              {t.loginBtn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isFounder = user?.role === 'founder' || user?.role === 'manager';

  const renderAdminHeader = () => (
    <header className="px-6 pt-10 pb-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] -z-10 translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-48 h-48 bg-secondary/10 rounded-full blur-[60px] -z-10 -translate-x-1/2 translate-y-1/4 pointer-events-none"></div>

      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-sm font-bold text-primary tracking-widest uppercase">{t.adminSubtitle}</p>
          <h1 className="text-3xl font-headline font-extrabold text-slate-100 flex items-center gap-2">{t.adminTitle}</h1>
        </div>
        {renderLangSwitcher()}
      </div>
    </header>
  );

  const renderUserHeader = () => (
    <header className="px-6 pt-10 pb-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/20 rounded-full blur-[80px] -z-10 translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>

      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-sm font-bold text-secondary tracking-widest uppercase">{t.userSubtitle}</p>
          <h1 className="text-3xl font-headline font-extrabold text-slate-100 flex items-center gap-2">{t.userTitle}</h1>
        </div>
        {renderLangSwitcher()}
      </div>
    </header>
  );

  const renderAdminContent = () => {
    if (activeTab === 'tariffs') {
      return <AdminTariffs t={t} />;
    }
    if (activeTab === 'faq') {
      return <AdminFaq t={t} />;
    }

    // Default to 'stats'
    return <AdminStats t={t} globalStats={globalStats} />;
  };

  const handleSendQr = async () => {
    if (!user?.telegram_id) return;
    try {
      tg?.showAlert("Отправляем QR в чат...");
      await fetch('/api/send-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_id: user.telegram_id })
      });
      tg?.close();
    } catch (err) {
      tg?.showAlert("Ошибка отправки QR");
    }
  };

  const renderUserContent = () => {
    if (activeTab === 'catalog') {
        return <ClientCatalog lang={lang} />;
    }

    return (
    <div className="space-y-6">
      <div className="bg-[#201f22] p-5 rounded-3xl relative overflow-hidden flex flex-col items-center text-center border border-white/5 mx-2">
        <div className="w-14 h-14 bg-secondary-container/20 border border-secondary/20 rounded-full flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-secondary text-2xl">account_balance_wallet</span>
        </div>
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">{t.bonusBalance}</p>
        <h2 className="text-4xl font-headline font-extrabold text-slate-100 mb-2">${user?.balance?.toFixed(2) || '0.00'}</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 mx-2">
        <div className="bg-surface-container-low p-4 rounded-2xl flex flex-col justify-between min-h-[100px] border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-primary/10 p-1.5 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[18px]">group_add</span>
            </div>
            <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">{t.invitedLabel}</p>
          </div>
          <span className="text-2xl font-headline font-extrabold text-slate-200">{referrals.length}</span>
        </div>

        <div className="bg-surface-container-low p-4 rounded-2xl flex flex-col justify-between min-h-[100px] border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-secondary/10 p-1.5 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary text-[18px]">shopping_bag</span>
            </div>
            <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">{t.boughtEsimLabel}</p>
          </div>
          <span className="text-2xl font-headline font-extrabold text-slate-200">{purchasedRefsCount}</span>
        </div>
      </div>

      {payoutsHistory.length > 0 && (
        <div className="glass-card p-5 rounded-3xl mx-2 border border-white/5">
            <h3 className="text-sm font-headline font-bold text-on-surface mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary text-[18px]">history</span>
              {lang === 'ru' ? 'История выплат' : lang === 'tr' ? 'Ödeme Geçmişi' : 'Payout History'}
            </h3>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto clean-scrollbar pr-1">
              {payoutsHistory.map((p, idx) => (
                   <div key={idx} className="flex justify-between items-center bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/10">
                       <span className="text-xs text-on-surface-variant">{new Date(p.created_at).toLocaleDateString()} {new Date(p.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                       <span className="font-bold text-green-400 text-sm">+${Number(p.content.split(':')[1]).toFixed(2)}</span>
                   </div>
              ))}
            </div>
        </div>
      )}

      <div className="glass-card p-5 rounded-3xl mx-2 border border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] -z-10 translate-x-1/2 -translate-y-1/2"></div>
        <h3 className="text-lg font-headline font-bold text-on-surface mb-3 flex items-center gap-2">
          {t.inviteFriend}
        </h3>
        <p className="text-sm font-medium text-on-surface-variant mb-4">{t.promoTitle}</p>

        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-surface-container-lowest p-1.5 rounded-xl border border-outline-variant/10">
            <input
              type="text"
              readOnly
              value={refLink}
              className="flex-1 bg-transparent text-sm text-on-surface outline-none px-2 font-mono"
            />
            <button
              onClick={copyRefLink}
              className="w-[42px] h-[42px] bg-primary/20 text-primary rounded-lg flex items-center justify-center active:scale-90 transition-transform hover:bg-primary/30"
            >
              <span className="material-symbols-outlined text-[20px]">content_copy</span>
            </button>
          </div>
          <div className="flex items-center gap-2 bg-surface-container-lowest p-1.5 rounded-xl border border-outline-variant/10">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider px-2 border-r border-outline-variant/10 mr-1">{t.promoLabel}</span>
            <input
              type="text"
              readOnly
              value={user?.telegram_id || ''}
              className="flex-1 bg-transparent font-bold text-primary outline-none px-2 font-mono text-[15px]"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(String(user?.telegram_id));
                tg?.showAlert(t.linkCopied);
              }}
              className="w-[42px] h-[42px] bg-primary/20 text-primary rounded-lg flex items-center justify-center active:scale-90 transition-transform hover:bg-primary/30"
            >
              <span className="material-symbols-outlined text-[20px]">content_copy</span>
            </button>
          </div>
        </div>

        <div className="mt-5 border-t border-outline-variant/10 pt-5 flex flex-col items-center pb-2">
          <div className="bg-white p-3 rounded-2xl w-fit mx-auto relative group shadow-[0_0_20px_rgba(255,255,255,0.1)] mb-4">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(refLink)}`}
              alt="QR Code"
              width={180}
              height={180}
              className="rounded-xl block"
            />
          </div>
          <button
            onClick={handleSendQr}
            className="w-full bg-primary/20 text-primary border border-primary/30 py-3.5 rounded-xl font-bold active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">send_to_mobile</span>
            {t.getQrChat}
          </button>
        </div>
      </div>
    </div>
    );
  };
  const isManagerTab = ['stats', 'tariffs', 'faq'].includes(activeTab);

  return (
    <>
      {isFounder && isManagerTab ? renderAdminHeader() : renderUserHeader()}
      <main className="px-4 pt-2 space-y-8 max-w-2xl mx-auto pb-24">
        {isFounder && isManagerTab ? renderAdminContent() : renderUserContent()}
      </main>

      <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center px-2 pb-6 pt-3 bg-[#131315]/80 backdrop-blur-2xl rounded-t-[1.5rem] shadow-[0_-10px_30px_rgba(0,0,0,0.5)] border-t border-white/5">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex flex-col items-center p-2 rounded-xl transition-all w-full max-w-[80px] ${activeTab === 'catalog' ? 'text-primary scale-110' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'catalog' ? "\'FILL\' 1" : "\'FILL\' 0" }}>storefront</span>
          <span className="font-['Inter'] text-[9px] font-extrabold uppercase tracking-widest mt-1">{t.tabCatalog}</span>
        </button>

        <button
          onClick={() => setActiveTab('referral')}
          className={`flex flex-col items-center p-2 rounded-xl transition-all w-full max-w-[80px] ${activeTab === 'referral' ? 'text-secondary scale-110' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'referral' ? "\'FILL\' 1" : "\'FILL\' 0" }}>group</span>
          <span className="font-['Inter'] text-[9px] font-extrabold uppercase tracking-widest mt-1">{t.tabReferral}</span>
        </button>

        {isFounder && (
          <>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex flex-col items-center p-2 rounded-xl transition-all w-full max-w-[80px] ${activeTab === 'stats' ? 'text-primary scale-110' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'stats' ? "\'FILL\' 1" : "\'FILL\' 0" }}>bar_chart</span>
              <span className="font-['Inter'] text-[9px] font-extrabold uppercase tracking-widest mt-1">{t.tabStats}</span>
            </button>
            <button
              onClick={() => setActiveTab('tariffs')}
              className={`flex flex-col items-center p-2 rounded-xl transition-all w-full max-w-[80px] ${activeTab === 'tariffs' ? 'text-primary scale-110' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'tariffs' ? "\'FILL\' 1" : "\'FILL\' 0" }}>sell</span>
              <span className="font-['Inter'] text-[9px] font-extrabold uppercase tracking-widest mt-1">{t.tabTariffs}</span>
            </button>
            {/* Make FAQ take less space or remove it to fit 5 items comfortably? Let's give buttons a max width */}
            <button
              onClick={() => setActiveTab('faq')}
              className={`flex flex-col items-center p-2 rounded-xl transition-all w-full max-w-[80px] ${activeTab === 'faq' ? 'text-primary scale-110' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'faq' ? "\'FILL\' 1" : "\'FILL\' 0" }}>help</span>
              <span className="font-['Inter'] text-[9px] font-extrabold uppercase tracking-widest mt-1">{t.tabFaq}</span>
            </button>
          </>
        )}
      </nav>

      <WithdrawModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        balance={user?.balance || 0}
        lang={lang}
      />
    </>
  );
};

export default App;
