import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Share2, Users, Wallet, ArrowRightLeft, QrCode, TrendingUp, Key } from 'lucide-react';
import WithdrawModal from './components/WithdrawModal';

declare global {
  interface Window {
    Telegram: any;
  }
}

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [purchasedRefsCount, setPurchasedRefsCount] = useState(0);
  const [globalStats, setGlobalStats] = useState({ totalUsers: 0, totalOrders: 0, totalSales: 0 });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      const tgUser = tg.initDataUnsafe?.user;
      if (tgUser) {
        fetchUserData(tgUser.id);
      }
    } else {
      // For dev outside TG
      fetchUserData(12345678);
    }
  }, []);

  const fetchUserData = async (tgId: number) => {
    try {
      // 1. Get User
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tgId)
        .single();

      if (userData) {
        setUser(userData);

        // 2. Get Referrals
        const { data: refs } = await supabase
          .from('users')
          .select('telegram_id, username, created_at')
          .eq('referrer_id', tgId);

        setReferrals(refs || []);

        // 3. Get Referrals who made a purchase
        if (refs && refs.length > 0) {
          const refIds = refs.map((r: any) => r.telegram_id);
          const { data: orderedRefs } = await supabase
            .from('orders')
            .select('user_id')
            .in('user_id', refIds);

          // Count unique users who ordered
          const uniqueBuyers = new Set((orderedRefs || []).map((o: any) => o.user_id));
          setPurchasedRefsCount(uniqueBuyers.size);
        }

        // 4. If Founder, fetch global stats
        if (userData.role === 'founder') {
          const { count: uCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
          const { count: oCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
          // Note: we'd need a join to get total revenue easily, but let's just show counts for MVP
          setGlobalStats({
            totalUsers: uCount || 0,
            totalOrders: oCount || 0,
            totalSales: 0 // placeholder without complex query
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

  if (loading) return <div className="p-8 text-center text-tg-text">Загрузка данных...</div>;

  if (user?.role === 'founder') {
    return (
      <div className="p-4 max-w-md mx-auto space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-tg-text">Админ-панель 👑</h1>
          <p className="opacity-70 text-tg-hint">Сводка по всему боту</p>
        </header>

        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4 flex flex-col items-center justify-center space-y-2">
            <Users className="w-8 h-8 text-blue-500" />
            <span className="text-2xl font-bold">{globalStats.totalUsers}</span>
            <span className="text-xs opacity-70">Всего юзеров</span>
          </div>
          <div className="card p-4 flex flex-col items-center justify-center space-y-2">
            <TrendingUp className="w-8 h-8 text-green-500" />
            <span className="text-2xl font-bold">{globalStats.totalOrders}</span>
            <span className="text-xs opacity-70">Всего заказов</span>
          </div>
        </div>

        <div className="card p-4 space-y-4 text-center">
          <Key className="w-8 h-8 mx-auto text-purple-500" />
          <p className="text-sm">Ты вошел как <b>Основатель</b>. Здесь в будущем появятся графики и детальная выгрузка по тарифам.</p>
        </div>
      </div>
    );
  }

  // Normal User View
  return (
    <div className="p-4 max-w-md mx-auto space-y-6 pb-20">
      <header className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-tg-text">Рефералка 🎁</h1>
        <p className="opacity-70 text-tg-hint">Приглашай и зарабатывай!</p>
      </header>

      {/* Balance Card */}
      <div className="card flex items-center justify-between p-6">
        <div className="space-y-1">
          <p className="text-sm opacity-70">Бонусный баланс</p>
          <p className="text-3xl font-bold">{user?.balance || 0} ₽</p>
        </div>
        <div className="bg-blue-100 p-3 rounded-full">
          <Wallet className="w-6 h-6 text-blue-600" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 text-center space-y-1 bg-gray-50 dark:bg-zinc-800/50">
          <span className="text-2xl font-bold text-tg-text">{referrals.length}</span>
          <p className="text-xs opacity-70">Приглашено</p>
        </div>
        <div className="card p-4 text-center space-y-1 bg-gray-50 dark:bg-zinc-800/50">
          <span className="text-2xl font-bold text-green-500">{purchasedRefsCount}</span>
          <p className="text-xs opacity-70">Купили eSIM</p>
        </div>
      </div>

      {/* QR Code and Link */}
      <div className="card space-y-4 flex flex-col items-center text-center">
        <div className="flex items-center gap-2 self-start mb-2">
          <QrCode className="w-5 h-5 text-purple-500" />
          <h2 className="font-semibold text-tg-text">Твой QR-код</h2>
        </div>

        <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(refLink)}&margin=10`}
            alt="Реферальный QR"
            className="w-44 h-44 rounded-lg"
          />
        </div>

        <p className="text-sm opacity-70 text-tg-hint w-full text-left mt-2">Дай отсканировать этот код другу или отправь ссылку.</p>

        <button
          onClick={copyRefLink}
          className="w-full flex items-center justify-center gap-2 mt-2"
        >
          <Share2 className="w-4 h-4" />
          Копировать ссылку
        </button>
      </div>

      {/* Withdrawal Action (Fixed Bottom) */}
      <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto">
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full py-4 bg-green-600 flex items-center justify-center gap-2 shadow-lg hover:shadow-green-500/20"
        >
          <ArrowRightLeft className="w-5 h-5" />
          Вывести средства
        </button>
      </div>

      <WithdrawModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        balance={user?.balance || 0}
      />
    </div>
  );
};

export default App;
