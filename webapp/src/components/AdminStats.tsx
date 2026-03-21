import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function AdminStats({ t, globalStats }: { t: any, globalStats: any }) {
    const [activeTab, setActiveTab] = useState<'orders' | 'users'>('orders');
    const [isOrdersExpanded, setIsOrdersExpanded] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [usersInfo, setUsersInfo] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);

        // Fetch orders with users and tariffs info
        const { data: ordersData } = await supabase
            .from('orders')
            .select(`
        id, created_at, status, price_usd, assigned_manager,
        users:user_id (telegram_id, username),
        tariffs:tariff_id (country, data_gb, validity_period)
      `)
            .order('created_at', { ascending: false });

        if (ordersData) setOrders(ordersData);

        // Prepare users aggregation if tab is active or just prepare it anyway
        const { data: allUsers } = await supabase.from('users').select('telegram_id, username, referrer_id, balance');

        if (allUsers && ordersData) {
            const uMap: Record<string, any> = {};
            allUsers.forEach((u: any) => {
                uMap[u.telegram_id] = { ...u, invitedCount: 0, ordersCount: 0, totalSpend: 0 };
            });

            allUsers.forEach((u: any) => {
                if (u.referrer_id && uMap[u.referrer_id]) {
                    uMap[u.referrer_id].invitedCount++;
                }
            });

            ordersData.forEach((o: any) => {
                const userObj = o.users as any;
                const uId = userObj?.telegram_id ? userObj.telegram_id : (Array.isArray(userObj) ? userObj[0]?.telegram_id : null);

                if (uId && uMap[uId] && o.status === 'paid') {
                    uMap[uId].ordersCount++;
                    uMap[uId].totalSpend += (Number(o.price_usd) || 0);
                }
            });

            const sortedUsers = Object.values(uMap)
                .filter((u: any) => u.invitedCount > 0 || u.ordersCount > 0 || u.balance > 0)
                .sort((a: any, b: any) => b.totalSpend - a.totalSpend);

            setUsersInfo(sortedUsers);
        }

        setLoading(false);
    };

    const filteredOrders = orders.filter((o: any) => statusFilter === 'all' || o.status === statusFilter);

    return (
        <div className="space-y-6">
            <section className="grid grid-cols-2 gap-3">
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
                        <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">{t.totalSales || 'Продажи'}</p>
                    </div>
                    <span className="text-3xl font-headline font-extrabold text-on-surface">${globalStats.totalSales.toFixed(2)}</span>
                </div>
            </section>

            <div className="flex gap-2 p-1 bg-surface-container-lowest rounded-xl">
                <button onClick={() => setActiveTab('orders')} className={`flex-1 py-1.5 rounded-lg text-sm font-bold ${activeTab === 'orders' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant'}`}>Заказы</button>
                <button onClick={() => setActiveTab('users')} className={`flex-1 py-1.5 rounded-lg text-sm font-bold ${activeTab === 'users' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant'}`}>Юзеры</button>
            </div>

            {loading ? (
                <div className="text-center p-4 animate-pulse text-on-surface-variant">Анализ базы...</div>
            ) : activeTab === 'orders' ? (
                <div className="space-y-4">
                    <div className="flex gap-2 overflow-x-auto pb-2 clean-scrollbar">
                        {['all', 'paid', 'pending', 'awaiting_qr', 'cancelled'].map(st => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${statusFilter === st ? 'bg-secondary/20 text-secondary border border-secondary/30' : 'bg-surface-container-low text-on-surface-variant'}`}
                            >
                                {st.toUpperCase().replace('_', ' ')}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col gap-3">
                        {filteredOrders.length === 0 ? <div className="text-sm text-center text-on-surface-variant mt-4">Нет заказов</div> : null}
                        {filteredOrders.slice(0, isOrdersExpanded ? undefined : 6).map((o: any) => {
                            const u = o.users as any;
                            const uObj = Array.isArray(u) ? u[0] : u;

                            return (
                                <div key={o.id} className="glass-card p-4 rounded-xl relative border-l-4 border-l-primary/30 text-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold text-on-surface flex items-center gap-2">
                                            {uObj?.username ? `@${uObj.username}` : uObj?.telegram_id || 'Unknown'}
                                        </div>
                                        <b className="text-green-400">${o.price_usd}</b>
                                    </div>

                                    <div className="text-on-surface-variant text-xs space-y-1 mb-2">
                                        <p>📦 {o.tariffs ? `${o.tariffs.country} | ${o.tariffs.data_gb} | ${o.tariffs.validity_period}` : 'Удаленный тариф'}</p>
                                        <p>📅 {new Date(o.created_at).toLocaleString()}</p>
                                    </div>

                                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-outline-variant/10">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${o.status === 'paid' ? 'bg-green-500/20 text-green-400' : o.status === 'pending' ? 'bg-orange-500/20 text-orange-400' : o.status === 'awaiting_qr' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {o.status}
                                        </span>
                                        {o.assigned_manager && <span className="text-[10px] text-on-surface-variant">Manager ID: {o.assigned_manager}</span>}
                                    </div>
                                </div>
                            );
                        })}

                        {filteredOrders.length > 6 && (
                            <button
                                onClick={() => setIsOrdersExpanded(!isOrdersExpanded)}
                                className="w-full py-3 mt-1 bg-surface-container-high hover:bg-surface-container-highest rounded-xl text-primary text-sm font-bold active:scale-95 transition-all text-center border border-white/5"
                            >
                                {isOrdersExpanded ? 'Скрыть ⬆' : `Показать все (${filteredOrders.length}) ⬇`}
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {usersInfo.map(u => (
                        <div key={u.telegram_id} className="glass-card p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <p className="font-headline font-semibold text-on-surface text-sm">{u.username ? `@${u.username}` : u.telegram_id}</p>
                                <div className="text-[10px] text-on-surface-variant uppercase mt-1 flex gap-3">
                                    <span>ПРИГЛАСИЛ: <b className="text-primary">{u.invitedCount}</b></span>
                                    <span>ПОКУПОК: <b className="text-secondary">{u.ordersCount}</b></span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-on-surface-variant">Потратил</p>
                                <p className="font-headline font-bold text-green-400">${u.totalSpend.toFixed(2)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
