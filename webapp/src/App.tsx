import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import WithdrawModal from './components/WithdrawModal';

declare global {
  interface Window {
    Telegram: any;
  }
}

const translations = {
  ru: {
    adminTitle: "Панель Основателя 👑",
    adminSubtitle: "Глобальная статистика",
    overview: "Обзор проекта",
    overviewDesc: "Все пользователи и активные заказы.",
    totalUsers: "Всего юзеров",
    totalSales: "Всего продаж",
    manageManagers: "Управление Менеджерами",
    assignEmployee: "Назначить сотрудника",
    enterTgId: "Введите Telegram ID пользователя",
    activeEmployees: "Действующие сотрудники",
    ownerBadge: "Владелец",
    topReferrers: "Топ Рефералов",
    noInvitedUsers: "Пока нет приглашенных юзеров",
    balance: "Баланс",
    invitedCount: "Приглашены",
    userTitle: "Рефералка 🎁",
    userSubtitle: "Твоя статистика",
    bonusBalance: "Твой бонусный баланс",
    withdraw: "Вывести",
    invitedLabel: "Приглашено",
    boughtEsimLabel: "Купили eSIM",
    inviteFriend: "Пригласить друга",
    tabReferral: "Рефералка",
    tabFounder: "Основатель",
    loginTitle: "Вход в панель",
    loginDesc: "Открыто вне Telegram. Введите свой Telegram ID для доступа.",
    loginPlaceholder: "Введите ID (например, 12345678)",
    loginBtn: "Войти",
    loading: "Загрузка данных...",
    linkCopied: "Ссылка скопирована!",
    managerAddError: "ОШИБКА: Этот пользователь еще ни разу не запускал бота! Пусть нажмет /start в боте.",
    managerAddSuccess: "Успех! ID {id} теперь Менеджер.",
    managerRemoveSuccess: "Сотрудник {id} удален.",
    managerAddFail: "Ошибка при добавлении менеджера."
  },
  tr: {
    adminTitle: "Kurucu Paneli 👑",
    adminSubtitle: "Küresel İstatistikler",
    overview: "Proje İncelemesi",
    overviewDesc: "Tüm kullanıcılar ve aktif siparişler.",
    totalUsers: "Toplam Kullanıcı",
    totalSales: "Toplam Satış",
    manageManagers: "Yönetici Yönetimi",
    assignEmployee: "Çalışan Ata",
    enterTgId: "Kullanıcı Telegram ID girin",
    activeEmployees: "Aktif Çalışanlar",
    ownerBadge: "Sahibi",
    topReferrers: "En İyi Referanslar",
    noInvitedUsers: "Henüz davet edilen kullanıcı yok",
    balance: "Bakiye",
    invitedCount: "Kişi",
    userTitle: "Referans 🎁",
    userSubtitle: "İstatistiklerin",
    bonusBalance: "Bonus Bakiyen",
    withdraw: "Para Çek",
    invitedLabel: "Davet Edildi",
    boughtEsimLabel: "eSIM Aldı",
    inviteFriend: "Arkadaş Davet Et",
    tabReferral: "Referans",
    tabFounder: "Kurucu",
    loginTitle: "Panele Giriş",
    loginDesc: "Telegram dışında açıldı. Erişim için Telegram ID'nizi girin.",
    loginPlaceholder: "ID girin (örn. 12345678)",
    loginBtn: "Giriş Yap",
    loading: "Veriler yükleniyor...",
    linkCopied: "Bağlantı kopyalandı!",
    managerAddError: "HATA: Bu kullanıcı botu hiç başlatmamış! Botta /start'a bassın.",
    managerAddSuccess: "Başarı! ID {id} artık Yönetici.",
    managerRemoveSuccess: "Çalışan {id} kaldırıldı.",
    managerAddFail: "Yönetici eklerken hata oluştu."
  }
};

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loginInputId, setLoginInputId] = useState('');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [purchasedRefsCount, setPurchasedRefsCount] = useState(0);
  const [globalStats, setGlobalStats] = useState({ totalUsers: 0, totalOrders: 0, totalSales: 0 });
  const [topReferrers, setTopReferrers] = useState<any[]>([]);
  const [managersList, setManagersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newManagerId, setNewManagerId] = useState('');
  const [lang, setLang] = useState<'ru' | 'tr'>('ru');

  const [activeTab, setActiveTab] = useState<'referral' | 'founder'>('referral');

  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    if (tg && tg.initDataUnsafe?.user) {
      if (tg.initDataUnsafe.user.language_code === 'tr') {
        setLang('tr');
      }
      tg.ready();
      tg.expand();
      fetchUserData(tg.initDataUnsafe.user.id);
    } else {
      setLoading(false);
    }
  }, []);

  const t = translations[lang];

  const fetchUserData = async (tgId: number) => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tgId)
        .single();

      if (userData) {
        setUser(userData);
        if (userData.role === 'founder' || userData.role === 'manager') {
          setActiveTab('founder');
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

        if (userData.role === 'founder' || userData.role === 'manager') {
          const { count: uCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
          const { count: oCount } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'paid');
          setGlobalStats({
            totalUsers: uCount || 0,
            totalOrders: oCount || 0,
            totalSales: 0
          });

          const { data: allUsers } = await supabase.from('users').select('telegram_id, username, referrer_id, balance');
          if (allUsers) {
            const counts: Record<string, any> = {};
            allUsers.forEach((u: any) => {
              if (u.referrer_id) {
                if (!counts[u.referrer_id]) {
                  const refUser = allUsers.find((r: any) => r.telegram_id === u.referrer_id);
                  counts[u.referrer_id] = {
                    username: refUser?.username || u.referrer_id,
                    count: 0,
                    balance: refUser?.balance || 0
                  };
                }
                counts[u.referrer_id].count += 1;
              }
            });
            const sortedRefs = Object.entries(counts)
              .map(([id, data]) => ({ id, ...data }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 10);
            setTopReferrers(sortedRefs);
          }

          const { data: mUsers } = await supabase.from('users').select('*').in('role', ['manager', 'founder']);
          setManagersList(mUsers || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refLink = user ? `https://t.me/eesimtestbot?start=${user.telegram_id}` : '';

  const copyRefLink = () => {
    navigator.clipboard.writeText(refLink);
    tg?.showAlert(t.linkCopied);
  };

  const handleAddManager = async () => {
    if (!newManagerId) return;
    const tgId = parseInt(newManagerId);

    const { data: existingUser } = await supabase.from('users').select('*').eq('telegram_id', tgId).single();
    if (!existingUser) {
      tg?.showAlert(t.managerAddError);
      return;
    }

    const { error } = await supabase
      .from('users')
      .update({ role: 'manager' })
      .eq('telegram_id', tgId);

    if (!error) {
      setManagersList(prev => {
        if (prev.find(m => m.telegram_id === tgId)) return prev;
        return [...prev, { ...existingUser, role: 'manager' }];
      });
      tg?.showAlert(t.managerAddSuccess.replace('{id}', String(tgId)));
      setNewManagerId('');
    } else {
      tg?.showAlert(t.managerAddFail);
    }
  };

  const handleRemoveManager = async (tgId: number) => {
    const { error } = await supabase.from('users').update({ role: 'user' }).eq('telegram_id', tgId);
    if (!error) {
      setManagersList(prev => prev.filter(m => m.telegram_id !== tgId));
      tg?.showAlert(t.managerRemoveSuccess.replace('{id}', String(tgId)));
    }
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
    <header className="bg-[#131315]/60 dark:bg-[#131315]/60 backdrop-blur-xl flex justify-between items-center px-6 pt-5 pb-4 w-full z-50 sticky top-0 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-high border border-outline-variant/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-2xl">shield_person</span>
        </div>
        <div className="flex flex-col">
          <h1 className="font-headline font-bold tracking-tight text-slate-100 text-lg leading-tight">{t.adminTitle}</h1>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-medium">{t.adminSubtitle}</p>
        </div>
      </div>
      <button onClick={() => setLang(lang === 'ru' ? 'tr' : 'ru')} className="bg-surface-container-high border border-outline-variant/20 px-3 py-1 rounded-lg text-xs font-bold font-mono text-on-surface-variant hover:text-white transition-colors">
        {lang === 'ru' ? '🇹🇷 TR' : '🇷🇺 RU'}
      </button>
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-b from-slate-100/10 to-transparent h-[1px]"></div>
    </header>
  );

  const renderUserHeader = () => (
    <header className="bg-[#131315]/60 dark:bg-[#131315]/60 backdrop-blur-xl flex justify-between items-center px-6 pt-5 pb-4 w-full z-50 sticky top-0 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-secondary-container/20 border border-secondary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-secondary text-2xl">card_giftcard</span>
        </div>
        <div className="flex flex-col">
          <h1 className="font-headline font-bold tracking-tight text-slate-100 text-lg leading-tight">{t.userTitle}</h1>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-medium">{t.userSubtitle}</p>
        </div>
      </div>
      <button onClick={() => setLang(lang === 'ru' ? 'tr' : 'ru')} className="bg-surface-container-high border border-outline-variant/20 px-3 py-1 rounded-lg text-xs font-bold font-mono text-on-surface-variant hover:text-white transition-colors">
        {lang === 'ru' ? '🇹🇷 TR' : '🇷🇺 RU'}
      </button>
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-b from-slate-100/10 to-transparent h-[1px]"></div>
    </header>
  );

  const renderAdminContent = () => (
    <>
      <section className="mb-6">
        <h2 className="text-xl font-headline font-extrabold text-primary mb-1">
          {t.overview}
        </h2>
        <p className="text-on-surface-variant font-body text-sm">{t.overviewDesc}</p>
      </section>

      <section className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-[#201f22] p-4 rounded-xl flex flex-col justify-between min-h-[100px] border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-primary/10 p-1.5 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[18px]">group</span>
            </div>
            <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">{t.totalUsers}</p>
          </div>
          <span className="text-3xl font-headline font-extrabold text-on-surface">{globalStats.totalUsers}</span>
        </div>

        <div className="bg-[#201f22] p-4 rounded-xl flex flex-col justify-between min-h-[100px] border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-secondary/10 p-1.5 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary text-[18px]">shopping_bag</span>
            </div>
            <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">{t.totalSales}</p>
          </div>
          <span className="text-3xl font-headline font-extrabold text-on-surface">{globalStats.totalOrders}</span>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-headline font-bold text-on-surface pl-1">{t.manageManagers}</h3>
        <div className="glass-card p-4 rounded-xl space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-surface-container-lowest rounded-full flex items-center justify-center border border-outline-variant/10">
              <span className="material-symbols-outlined text-tertiary">person_add</span>
            </div>
            <div>
              <p className="font-headline font-semibold text-on-surface text-sm">{t.assignEmployee}</p>
              <p className="text-xs text-on-surface-variant">{t.enterTgId}</p>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <input
              type="number"
              value={newManagerId}
              onChange={(e) => setNewManagerId(e.target.value)}
              className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 min-h-[42px] text-sm text-on-surface focus:outline-none focus:border-primary/50"
              placeholder="e.g. 12345678"
            />
            <button onClick={handleAddManager} className="whitespace-nowrap bg-primary/20 text-primary border border-primary/30 w-[42px] h-[42px] min-w-[42px] flex items-center justify-center rounded-lg shadow-[0_0_15px_rgba(208,188,255,0.1)] hover:bg-primary/30 transition-colors active:scale-95">
              <span className="material-symbols-outlined font-bold text-xl">add</span>
            </button>
          </div>

          {managersList.length > 0 && (
            <div className="pt-4 mt-4 border-t border-outline-variant/10 space-y-2">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">{t.activeEmployees}</p>
              {managersList.map((m) => (
                <div key={m.telegram_id} className="flex justify-between items-center bg-surface-container-lowest p-2 px-3 rounded-lg border border-outline-variant/10">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-tertiary">{m.role === 'founder' ? 'shield_person' : 'badge'}</span>
                    <span className="text-sm text-on-surface font-medium truncate w-32">@{m.username || String(m.telegram_id)}</span>
                    {m.role === 'founder' && <span className="text-[8px] uppercase tracking-widest bg-primary/20 text-primary px-1.5 py-0.5 rounded-sm font-bold">{t.ownerBadge}</span>}
                  </div>
                  {m.role !== 'founder' && (
                    <button onClick={() => handleRemoveManager(m.telegram_id)} className="text-error hover:bg-error/10 p-1.5 rounded-md transition-colors active:scale-95 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[16px]">person_remove</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-headline font-bold text-on-surface pl-1">{t.topReferrers}</h3>
        <div className="flex flex-col gap-3">
          {topReferrers.length === 0 ? (
            <div className="glass-card p-4 rounded-xl text-center text-sm text-on-surface-variant">{t.noInvitedUsers}</div>
          ) : (
            topReferrers.map((ref, idx) => (
              <div key={ref.id} className="glass-card p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-surface-container-lowest rounded-full flex items-center justify-center border border-outline-variant/10 font-bold text-primary">
                    #{idx + 1}
                  </div>
                  <div>
                    <p className="font-headline font-semibold text-on-surface truncate w-24 sm:w-32">@{ref.username}</p>
                    <p className="text-[10px] text-on-surface-variant uppercase mt-0.5">{t.balance}: {ref.balance} ₽</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-headline font-bold text-secondary">{ref.count}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase mt-0.5">{t.invitedCount}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );

  const renderUserContent = () => (
    <>
      <section className="mb-6">
        <h2 className="text-xl font-headline font-extrabold text-secondary mb-1">
          {t.bonusBalance}
        </h2>
        <div className="flex items-end gap-3 pt-1">
          <span className="text-4xl font-bold font-headline text-on-surface">{user?.balance || 0} ₽</span>
          <button onClick={() => setIsModalOpen(true)} className="mb-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(208,188,255,0.1)]">
            {t.withdraw}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-[#201f22] p-4 rounded-xl flex flex-col justify-between min-h-[100px] border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-secondary text-[18px]">group</span>
            <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">{t.invitedLabel}</p>
          </div>
          <span className="text-3xl font-headline font-extrabold text-on-surface">{referrals.length}</span>
        </div>
        <div className="bg-[#201f22] p-4 rounded-xl flex flex-col justify-between min-h-[100px] border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-green-400 text-[18px]">shopping_bag</span>
            <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">{t.boughtEsimLabel}</p>
          </div>
          <span className="text-3xl font-headline font-extrabold text-on-surface">{purchasedRefsCount}</span>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-headline font-bold text-on-surface pl-1">{t.inviteFriend}</h3>

        <div className="glass-card p-4 rounded-xl flex items-center justify-between gap-3">
          <div className="truncate flex-1 bg-surface-container-lowest px-3 py-2.5 rounded-lg text-xs text-on-surface-variant border border-outline-variant/10 font-mono">
            {refLink || '...'}
          </div>
          <button onClick={copyRefLink} className="bg-surface-container-high p-2.5 rounded-lg text-secondary hover:bg-secondary/10 hover:text-secondary-fixed transition-colors">
            <span className="material-symbols-outlined text-[20px]">content_copy</span>
          </button>
        </div>

        <div className="flex justify-center pt-6 pb-4">
          <div className="p-4 bg-white rounded-2xl shadow-[0_0_40px_rgba(208,188,255,0.15)]">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(refLink)}&margin=10`}
              alt="QR Code"
              className="w-44 h-44 rounded-xl"
            />
          </div>
        </div>
      </section>

      <WithdrawModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        balance={user?.balance || 0}
        lang={lang}
      />
    </>
  );

  return (
    <>
      {activeTab === 'founder' ? renderAdminHeader() : renderUserHeader()}

      <main className="px-6 pt-8 space-y-8 max-w-2xl mx-auto pb-24">
        {activeTab === 'founder' ? renderAdminContent() : renderUserContent()}
      </main>

      <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-3 bg-[#131315]/60 dark:bg-[#131315]/80 backdrop-blur-2xl rounded-t-[1.5rem] shadow-[0_-10px_30px_rgba(0,0,0,0.5)] border-t border-white/5">

        <button
          onClick={() => setActiveTab('referral')}
          className={`flex flex-col items-center justify-center p-2 haptic-feedback transition-all duration-300 ${activeTab === 'referral' ? 'text-indigo-300 bg-indigo-500/10 rounded-2xl px-6 py-2' : 'text-slate-400 hover:text-indigo-200'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'referral' ? "'FILL' 1" : "'FILL' 0" }}>group</span>
          <span className="font-['Inter'] text-[10px] font-medium uppercase tracking-widest mt-1">{t.tabReferral}</span>
        </button>

        {isFounder && (
          <button
            onClick={() => setActiveTab('founder')}
            className={`flex flex-col items-center justify-center p-2 haptic-feedback transition-all duration-300 ${activeTab === 'founder' ? 'text-indigo-300 bg-indigo-500/10 rounded-2xl px-6 py-2' : 'text-slate-400 hover:text-indigo-200'}`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'founder' ? "'FILL' 1" : "'FILL' 0" }}>dashboard</span>
            <span className="font-['Inter'] text-[10px] font-medium uppercase tracking-widest mt-1">{t.tabFounder}</span>
          </button>
        )}
      </nav>
    </>
  );
};

export default App;
