import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import WithdrawModal from './components/WithdrawModal';

declare global {
  interface Window {
    Telegram: any;
  }
}

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loginInputId, setLoginInputId] = useState('');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [purchasedRefsCount, setPurchasedRefsCount] = useState(0);
  const [globalStats, setGlobalStats] = useState({ totalUsers: 0, totalOrders: 0, totalSales: 0 });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newManagerId, setNewManagerId] = useState('');

  // Navigation active state
  const [activeTab, setActiveTab] = useState<'referral' | 'founder'>('referral');

  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    if (tg && tg.initDataUnsafe?.user) {
      tg.ready();
      tg.expand();
      fetchUserData(tg.initDataUnsafe.user.id);
    } else {
      setLoading(false); // Вне телеграма просто показываем экран входа
    }
  }, []);

  const fetchUserData = async (tgId: number) => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tgId)
        .single();

      if (userData) {
        setUser(userData);
        if (userData.role === 'founder') {
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
            .in('user_id', refIds);

          const uniqueBuyers = new Set((orderedRefs || []).map((o: any) => o.user_id));
          setPurchasedRefsCount(uniqueBuyers.size);
        }

        if (userData.role === 'founder') {
          const { count: uCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
          const { count: oCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
          setGlobalStats({
            totalUsers: uCount || 0,
            totalOrders: oCount || 0,
            totalSales: 0
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refLink = user ? `https://t.me/esim_bot?start=${user.telegram_id}` : '';

  const copyRefLink = () => {
    navigator.clipboard.writeText(refLink);
    tg?.showAlert('Ссылка скопирована!');
  };

  const handleAddManager = async () => {
    if (!newManagerId) return;
    const tgId = parseInt(newManagerId);

    const { data: existingUser } = await supabase.from('users').select('*').eq('telegram_id', tgId).single();
    if (!existingUser) {
      tg?.showAlert('ОШИБКА: Этот пользователь еще ни разу не запускал бота! Пусть нажмет /start в боте.');
      return;
    }

    const { error } = await supabase
      .from('users')
      .update({ role: 'manager' })
      .eq('telegram_id', tgId);

    if (!error) {
      tg?.showAlert(`Успех! ID ${tgId} теперь Менеджер.`);
      setNewManagerId('');
    } else {
      tg?.showAlert('Ошибка при добавлении менеджера.');
    }
  };

  const handleManualLogin = async () => {
    if (!loginInputId) return;
    setLoading(true);
    await fetchUserData(parseInt(loginInputId));
  };

  if (loading) return <div className="p-8 text-center text-on-surface-variant font-body animate-pulse mt-20">Загрузка данных...</div>;

  if (!user) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center p-6">
        <div className="glass-card p-6 rounded-2xl w-full max-w-sm space-y-6 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary-container/20 border border-primary/20 rounded-full mx-auto flex items-center justify-center mb-4 neon-glow">
              <span className="material-symbols-outlined text-primary text-3xl">login</span>
            </div>
            <h1 className="text-2xl font-headline font-bold text-slate-100">Вход в панель</h1>
            <p className="text-sm font-body text-on-surface-variant">Открыто вне Telegram. Введите свой Telegram ID для доступа.</p>
          </div>
          <div className="space-y-4">
            <input
              type="number"
              value={loginInputId}
              onChange={(e) => setLoginInputId(e.target.value)}
              placeholder="Введите ID (например, 12345678)"
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 text-on-surface focus:outline-none focus:border-primary/50 text-center font-mono"
            />
            <button
              onClick={handleManualLogin}
              className="w-full bg-primary/20 text-primary border border-primary/30 py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(208,188,255,0.1)] hover:bg-primary/30 transition-all active:scale-95"
            >
              Войти
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isFounder = user?.role === 'founder';

  const renderAdminHeader = () => (
    <header className="bg-[#131315]/60 dark:bg-[#131315]/60 backdrop-blur-xl flex justify-between items-center px-6 py-4 w-full z-50 sticky top-0 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-high border border-outline-variant/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-2xl">shield_person</span>
        </div>
        <div className="flex flex-col">
          <h1 className="font-headline font-bold tracking-tight text-slate-100 text-lg leading-tight">Панель Основателя 👑</h1>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-medium">Глобальная статистика</p>
        </div>
      </div>
      <button className="text-indigo-400 hover:opacity-80 transition-opacity scale-95 active:scale-90 duration-200">
        <span className="material-symbols-outlined">settings</span>
      </button>
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-b from-slate-100/10 to-transparent h-[1px]"></div>
    </header>
  );

  const renderUserHeader = () => (
    <header className="bg-[#131315]/60 dark:bg-[#131315]/60 backdrop-blur-xl flex justify-between items-center px-6 py-4 w-full z-50 sticky top-0 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-secondary-container/20 border border-secondary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-secondary text-2xl">card_giftcard</span>
        </div>
        <div className="flex flex-col">
          <h1 className="font-headline font-bold tracking-tight text-slate-100 text-lg leading-tight">Рефералка 🎁</h1>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-medium">Твоя статистика</p>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-b from-slate-100/10 to-transparent h-[1px]"></div>
    </header>
  );

  const renderAdminContent = () => (
    <>
      <section className="relative">
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-primary-container/20 rounded-full blur-[60px]"></div>
        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-secondary-container/10 rounded-full blur-[40px]"></div>
        <div className="relative z-10 space-y-2">
          <h2 className="text-display-md font-headline font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
            Обзор проекта
          </h2>
          <p className="text-on-surface-variant font-body text-sm">Все пользователи и активные заказы.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Metric 1 */}
        <div className="glass-card p-6 rounded-xl flex flex-col justify-between h-40 group hover:bg-surface-container-high transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <span className="material-symbols-outlined text-primary">group</span>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">Всего юзеров</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-headline font-extrabold text-on-surface">{globalStats.totalUsers}</span>
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-card p-6 rounded-xl flex flex-col justify-between h-40 group hover:bg-surface-container-high transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="bg-secondary/10 p-2.5 rounded-xl">
              <span className="material-symbols-outlined text-secondary">shopping_bag</span>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">Всего продаж</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-headline font-extrabold text-on-surface">{globalStats.totalOrders}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Assignment Card */}
      <section className="space-y-4">
        <h3 className="text-lg font-headline font-bold text-on-surface pl-1">Управление Менеджерами</h3>
        <div className="glass-card p-4 rounded-xl space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-surface-container-lowest rounded-full flex items-center justify-center border border-outline-variant/10">
              <span className="material-symbols-outlined text-tertiary">person_add</span>
            </div>
            <div>
              <p className="font-headline font-semibold text-on-surface text-sm">Назначить сотрудника</p>
              <p className="text-xs text-on-surface-variant">Введите Telegram ID пользователя</p>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <input
              type="number"
              value={newManagerId}
              onChange={(e) => setNewManagerId(e.target.value)}
              className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-2 text-sm text-on-surface focus:outline-none focus:border-primary/50"
              placeholder="e.g. 12345678"
            />
            <button onClick={handleAddManager} className="bg-primary/20 text-primary border border-primary/30 px-4 py-2 rounded-lg text-sm font-bold shadow-[0_0_15px_rgba(208,188,255,0.1)] hover:bg-primary/30 transition-colors">
              Добавить
            </button>
          </div>
        </div>
      </section>
    </>
  );

  const renderUserContent = () => (
    <>
      <section className="relative">
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-secondary-container/20 rounded-full blur-[60px]"></div>
        <div className="relative z-10 space-y-2">
          <h2 className="text-display-md font-headline font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-secondary to-primary">
            Твой бонусный баланс
          </h2>
          <div className="flex items-end gap-3 pt-2">
            <span className="text-5xl font-bold font-headline text-on-surface">{user?.balance || 0} ₽</span>
            <button onClick={() => setIsModalOpen(true)} className="mb-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-[0_0_15px_rgba(208,188,255,0.1)]">
              Вывести
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-xl flex flex-col justify-between h-32 group hover:bg-surface-container-high transition-all">
          <span className="material-symbols-outlined text-secondary">group</span>
          <div className="mt-2">
            <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Приглашено</p>
            <span className="text-3xl font-headline font-extrabold text-on-surface">{referrals.length}</span>
          </div>
        </div>
        <div className="glass-card p-5 rounded-xl flex flex-col justify-between h-32 group hover:bg-surface-container-high transition-all">
          <span className="material-symbols-outlined text-green-400">shopping_bag</span>
          <div className="mt-2">
            <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Купили eSIM</p>
            <span className="text-3xl font-headline font-extrabold text-on-surface">{purchasedRefsCount}</span>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-headline font-bold text-on-surface pl-1">Пригласить друга</h3>

        <div className="glass-card p-4 rounded-xl flex items-center justify-between gap-3">
          <div className="truncate flex-1 bg-surface-container-lowest px-3 py-2.5 rounded-lg text-xs text-on-surface-variant border border-outline-variant/10 font-mono">
            {refLink || 'Загрузка...'}
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
      />
    </>
  );

  return (
    <>
      {activeTab === 'founder' ? renderAdminHeader() : renderUserHeader()}

      <main className="px-6 pt-8 space-y-8 max-w-2xl mx-auto">
        {activeTab === 'founder' ? renderAdminContent() : renderUserContent()}
      </main>

      <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-3 bg-[#353437]/60 dark:bg-[#353437]/60 backdrop-blur-2xl rounded-t-[1.5rem] shadow-[0_-10px_30px_rgba(0,0,0,0.5)] border-t border-slate-100/10">

        <button
          onClick={() => setActiveTab('referral')}
          className={`flex flex-col items-center justify-center p-2 haptic-feedback transition-all duration-300 ${activeTab === 'referral' ? 'text-indigo-300 bg-indigo-500/10 rounded-2xl px-5' : 'text-slate-400 hover:text-indigo-200'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'referral' ? "'FILL' 1" : "'FILL' 0" }}>group</span>
          <span className="font-['Inter'] text-[10px] font-medium uppercase tracking-widest mt-1">Рефералка</span>
        </button>

        {isFounder && (
          <button
            onClick={() => setActiveTab('founder')}
            className={`flex flex-col items-center justify-center p-2 haptic-feedback transition-all duration-300 ${activeTab === 'founder' ? 'text-indigo-300 bg-indigo-500/10 rounded-2xl px-5' : 'text-slate-400 hover:text-indigo-200'}`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'founder' ? "'FILL' 1" : "'FILL' 0" }}>dashboard</span>
            <span className="font-['Inter'] text-[10px] font-medium uppercase tracking-widest mt-1">Основатель</span>
          </button>
        )}
      </nav>
    </>
  );
};

export default App;
