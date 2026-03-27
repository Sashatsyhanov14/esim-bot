import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function AdminStats({ t, globalStats }: { t: any, globalStats: any }) {
    const [activeTab, setActiveTab] = useState<'orders' | 'users'>('orders');
    const [isOrdersExpanded, setIsOrdersExpanded] = useState(false);
    const [isUsersExpanded, setIsUsersExpanded] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [usersInfo, setUsersInfo] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const [newManagerId, setNewManagerId] = useState('');
    const [managersList, setManagersList] = useState<any[]>([]);
    const tg = window.Telegram?.WebApp;

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);

        const { data: ordersData } = await supabase
            .from('orders')
            .select(`
        id, created_at, status, price_usd, assigned_manager,
        users:user_id (telegram_id, username),
        tariffs:tariff_id (country, data_gb, validity_period)
      `)
            .order('created_at', { ascending: false });

        if (ordersData) setOrders(ordersData);

        const { data: allUsers } = await supabase.from('users').select('telegram_id, username, referrer_id, balance');
        const { data: allPayouts } = await supabase.from('chat_history').select('user_id, content, created_at').eq('role', 'payout').order('created_at', { ascending: false });

        if (allUsers && ordersData) {
            const uMap: Record<string, any> = {};
            allUsers.forEach((u: any) => {
                uMap[u.telegram_id] = { ...u, invitedCount: 0, ordersCount: 0, totalSpend: 0, refOrdersCount: 0, earnedBonuses: 0, payouts: [] };
            });

            if (allPayouts) {
                allPayouts.forEach((p: any) => {
                    const pkId = p.user_id;
                    if (uMap[pkId]) {
                        uMap[pkId].payouts.push(p);
                    }
                });
            }

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

                    const refId = uMap[uId].referrer_id;
                    if (refId && uMap[refId]) {
                        uMap[refId].refOrdersCount++;
                        uMap[refId].earnedBonuses += (Number(o.price_usd) * 0.20 || 0);
                    }
                }
            });

            const sortedUsers = Object.values(uMap)
                .filter((u: any) => u.invitedCount > 0 || u.ordersCount > 0 || u.balance > 0)
                .sort((a: any, b: any) => b.totalSpend - a.totalSpend);

            setUsersInfo(sortedUsers);
        }

        const { data: mUsers } = await supabase.from('users').select('*').in('role', ['manager', 'founder']);
        if (mUsers) setManagersList(mUsers);

        setLoading(false);
    };

    const handleAddManager = async () => {
        if (!newManagerId) return;
        const tgId = parseInt(newManagerId);

        const { data: existingUser } = await supabase.from('users').select('*').eq('telegram_id', tgId).single();
        if (!existingUser) {
            tg?.showAlert(t.managerAddError);
            return;
        }

        const { error } = await supabase.from('users').update({ role: 'manager' }).eq('telegram_id', tgId);

        if (!error) {
            setManagersList(prev => {
                if (prev.find(m => m.telegram_id === tgId)) return prev;
                return [...prev, { ...existingUser, role: 'manager' }];
            });
            tg?.showAlert(t.managerAddSuccess?.replace('{id}', String(tgId)) || `Success!`);
            setNewManagerId('');
        } else {
            tg?.showAlert(t.managerAddFail);
        }
    };

    const handleRemoveManager = async (tgId: number) => {
        const { error } = await supabase.from('users').update({ role: 'user' }).eq('telegram_id', tgId);
        if (!error) {
            setManagersList(prev => prev.filter(m => m.telegram_id !== tgId));
            tg?.showAlert(t.managerRemoveSuccess?.replace('{id}', String(tgId)) || `Removed`);
        }
    };

    const handleMarkPaid = async (tgId: number, currentBalance: number) => {
        if (!window.confirm(`Выплатить $${currentBalance.toFixed(2)} пользователю?\nБаланс будет обнулен, а в историю будет добавлена запись о выплате.`)) return;
        
        const { error: insErr } = await supabase.from('chat_history').insert({
            id: window.crypto.randomUUID(),
            user_id: tgId,
            role: 'payout',
            content: `${currentBalance.toFixed(2)}`,
            created_at: new Date().toISOString()
        });

        if (insErr) {
            alert("Ошибка сохранения истории: " + insErr.message);
            return;
        }

        const { error: upErr } = await supabase.from('users').update({ balance: 0 }).eq('telegram_id', tgId);
        
        if (upErr) {
            alert("Ошибка обнуления баланса: " + upErr.message);
        } else {
            alert("Выплата успешно зафиксирована!");
            fetchData(); // reload
        }
    };

    const filteredOrders = orders.filter((o: any) => statusFilter === 'all' || o.status === statusFilter);

    return (
        <div className="space-y-6">
            <section className="space-y-4 mb-2 border-b border-white/5 pb-6">
                <h3 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">engineering</span>
                    {t.manageManagers}
                </h3>
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
                            className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 min-h-[42px] text-sm text-on-surface focus:outline-none focus:border-primary/50"
                            placeholder="12345678"
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
                        <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">{t.totalSales}</p>
                    </div>
                    <span className="text-3xl font-headline font-extrabold text-on-surface">${globalStats.totalSales.toFixed(2)}</span>
                </div>
            </section>

            <div className="flex gap-2 p-1 bg-surface-container-lowest rounded-xl">
                <button onClick={() => setActiveTab('orders')} className={`flex-1 py-1.5 rounded-lg text-sm font-bold ${activeTab === 'orders' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant'}`}>{t.tabOrders}</button>
                <button onClick={() => setActiveTab('users')} className={`flex-1 py-1.5 rounded-lg text-sm font-bold ${activeTab === 'users' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant'}`}>{t.tabUsers}</button>
            </div>

            {loading ? (
                <div className="text-center p-4 animate-pulse text-on-surface-variant">{t.analyzing}</div>
            ) : activeTab === 'orders' ? (
                <div className="space-y-4">
                    <div className="flex gap-2 overflow-x-auto pb-2 clean-scrollbar">
                        {['all', 'paid', 'pending', 'awaiting_qr', 'cancelled'].map(st => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold whitespace-nowrap ${statusFilter === st ? 'bg-secondary/20 text-secondary border border-secondary/30' : 'bg-surface-container-low text-on-surface-variant'}`}
                            >
                                {t.statuses ? (t.statuses[st] || st.toUpperCase().replace('_', ' ')) : st.toUpperCase().replace('_', ' ')}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col gap-3">
                        {filteredOrders.length === 0 ? <div className="text-sm text-center text-on-surface-variant mt-4">{t.noOrders}</div> : null}
                        {filteredOrders.slice(0, isOrdersExpanded ? undefined : 6).map((o: any) => {
                            const u = o.users as any;
                            const uObj = Array.isArray(u) ? u[0] : u;

                            return (
                                <div key={o.id} className="glass-card p-4 rounded-xl relative border-l-4 border-l-primary/30 text-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold text-on-surface flex items-center gap-2">
                                            {uObj?.username ? `@${uObj.username}` : uObj?.telegram_id || t.unknownUser}
                                        </div>
                                        <b className="text-green-400">${o.price_usd}</b>
                                    </div>

                                    <div className="text-on-surface-variant text-xs space-y-1.5 mb-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                                            <span>{o.tariffs ? `${o.tariffs.country} | ${o.tariffs.data_gb} | ${o.tariffs.validity_period}` : t.deletedTariff}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                            <span>{new Date(o.created_at).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-outline-variant/10">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${o.status === 'paid' ? 'bg-green-500/20 text-green-400' : o.status === 'pending' ? 'bg-orange-500/20 text-orange-400' : o.status === 'awaiting_qr' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {t.statuses ? (t.statuses[o.status] || o.status) : o.status}
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
                                {isOrdersExpanded ? t.hideAll : t.showAll.replace('{count}', filteredOrders.length)}
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {usersInfo.slice(0, isUsersExpanded ? undefined : 6).map(u => (
                        <div key={u.telegram_id} className="glass-card p-4 rounded-xl flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="font-headline font-semibold text-on-surface text-sm">{u.username ? `@${u.username}` : u.telegram_id}</p>
                                    <div className="text-[10px] text-on-surface-variant uppercase mt-1 flex flex-col gap-1">
                                        <div className="flex gap-3">
                                            <span>{t.invitedLabelStats || 'ПРИГЛАСИЛ:'} <b className="text-primary">{u.invitedCount}</b></span>
                                            <span>ПОКУПОК ПО РЕФКЕ: <b className="text-secondary">{u.refOrdersCount}</b></span>
                                        </div>
                                        <div className="flex gap-3 mt-1 pt-1 border-t border-white/5">
                                            <span>{t.purchasesLabel || 'СВОИ ПОКУПКИ:'} <b className="text-on-surface">{u.ordersCount}</b></span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end pl-2">
                                    <div className="mb-2">
                                        <p className="text-[10px] text-on-surface-variant uppercase">{t.spentLabel || 'ПОТРАТИЛ'}</p>
                                        <p className="font-headline font-bold text-red-400 mt-[-2px]">${u.totalSpend.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-on-surface-variant uppercase">ЗАРАБОТАЛ</p>
                                        <p className="font-headline font-bold text-green-400 mt-[-2px]">${u.earnedBonuses.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Payouts Section */}
                            <div className="bg-surface-container-low rounded-lg p-3 border border-white/5">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[14px] text-tertiary">account_balance_wallet</span>
                                        <span className="text-xs font-bold text-on-surface uppercase tracking-widest">Баланс: <span className="text-tertiary">${(u.balance || 0).toFixed(2)}</span></span>
                                    </div>
                                    {(u.balance || 0) > 0 && (
                                        <button onClick={() => handleMarkPaid(u.telegram_id, u.balance)} className="bg-tertiary/20 text-tertiary border border-tertiary/30 px-3 py-1 text-[10px] rounded-md font-bold uppercase tracking-wider hover:bg-tertiary/30 active:scale-95 transition-all">
                                            Выплатить
                                        </button>
                                    )}
                                </div>
                                
                                {u.payouts && u.payouts.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-outline-variant/10">
                                        <p className="text-[9px] text-on-surface-variant font-bold uppercase mb-1">История выплат:</p>
                                        <div className="flex flex-col gap-1 max-h-24 overflow-y-auto clean-scrollbar pr-1">
                                            {u.payouts.map((p: any, idx: number) => (
                                                <div key={idx} className="flex justify-between text-[10px] items-center bg-surface-container-lowest px-2 py-1 rounded">
                                                    <span className="text-on-surface-variant">{new Date(p.created_at).toLocaleDateString()} {new Date(p.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    <span className="font-bold text-error">-${Number(p.content).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {usersInfo.length > 6 && (
                        <button
                            onClick={() => setIsUsersExpanded(!isUsersExpanded)}
                            className="w-full py-3 mt-1 bg-surface-container-high hover:bg-surface-container-highest rounded-xl text-primary text-sm font-bold active:scale-95 transition-all text-center border border-white/5"
                        >
                            {isUsersExpanded ? t.hideAll : t.showAll.replace('{count}', usersInfo.length)}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
