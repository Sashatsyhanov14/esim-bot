import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function AdminStats({ t, globalStats }: { t: any, globalStats: any }) {
    const { user } = globalStats;
    const [activeTab, setActiveTab] = useState<'orders' | 'users'>('orders');
    const [isOrdersExpanded, setIsOrdersExpanded] = useState(false);
    const [isUsersExpanded, setIsUsersExpanded] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [usersInfo, setUsersInfo] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [refOrders, setRefOrders] = useState<any[]>([]);
    const [refOrdersLoading, setRefOrdersLoading] = useState(false);

    const getFlag = (searchStr: string) => {
        if (!searchStr) return '';
        const s = searchStr.toLowerCase();
        if (s.includes('turk') || s.includes('турц')) return '🇹🇷';
        if (s.includes('viet') || s.includes('вьет')) return '🇻🇳';
        if (s.includes('thai') || s.includes('таи')) return '🇹🇭';
        if (s.includes('indo') || s.includes('индо')) return '🇮🇩';
        if (s.includes('kazakh') || s.includes('казах')) return '🇰🇿';
        if (s.includes('azer') || s.includes('азер')) return '🇦🇿';
        if (s.includes('georg') || s.includes('груз')) return '🇬🇪';
        if (s.includes('usa') || s.includes('сша')) return '🇺🇸';
        if (s.includes('germ') || s.includes('герм')) return '🇩🇪';
        if (s.includes('egypt') || s.includes('егип')) return '🇪🇬';
        if (s.includes('china') || s.includes('кита')) return '🇨🇳';
        if (s.includes('korea') || s.includes('коре')) return '🇰🇷';
        if (s.includes('japan') || s.includes('япон')) return '🇯🇵';
        if (s.includes('monten') || s.includes('черног')) return '🇲🇪';
        if (s.includes('serb') || s.includes('серб')) return '🇷🇸';
        if (s.includes('euro') || s.includes('евро')) return '🇪🇺';
        if (s.includes('saudi') || s.includes('сауд')) return '🇸🇦';
        if (s.includes('dubai') || s.includes('uae') || s.includes('оаэ') || s.includes('emir')) return '🇦🇪';
        if (s.includes('global') || s.includes('глобал') || s.includes('world') || s.includes('мир')) return '🌎';
        if (s.includes('asia') || s.includes('азия')) return '🌏';
        if (s.includes('africa') || s.includes('африка')) return '🌍';
        if (s.includes('middle east') || s.includes('восток')) return '🏜️';
        return '';
    };

    const [newManagerId, setNewManagerId] = useState('');
    const [newManagerRole, setNewManagerRole] = useState<'manager' | 'admin'>('manager');
    const [managersList, setManagersList] = useState<any[]>([]);
    const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
    const [noteValue, setNoteValue] = useState('');
    const tg = window.Telegram?.WebApp;

    const isAdmin = user?.role === 'founder' || user?.role === 'admin';

    useEffect(() => {
        fetchData();
    }, []);

    const fetchManagers = async () => {
        const { data: mUsers } = await supabase.from('users').select('*').in('role', ['manager', 'admin', 'founder']);
        if (mUsers) setManagersList(mUsers);
    };

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

        const { data: allUsers } = await supabase.from('users').select('telegram_id, username, referrer_id, balance, custom_note');
        const { data: allPayouts } = await supabase.from('chat_history').select('user_id, content, created_at').eq('role', 'assistant').like('content', 'PAYOUT_RECORD:%').order('created_at', { ascending: false });

        if (allUsers && ordersData) {
            const uMap: Record<string, any> = {};
            allUsers.forEach((u: any) => {
                uMap[String(u.telegram_id)] = { ...u, invitedCount: 0, invitedUserIds: [], ordersCount: 0, totalSpend: 0, refOrdersCount: 0, refTotalVolume: 0, earnedBonuses: 0, payouts: [] };
            });

            if (allPayouts) {
                allPayouts.forEach((p: any) => {
                    const pkId = String(p.user_id);
                    if (uMap[pkId]) uMap[pkId].payouts.push(p);
                });
            }

            allUsers.forEach((u: any) => {
                const refId = String(u.referrer_id);
                if (u.referrer_id && uMap[refId]) {
                    uMap[refId].invitedCount++;
                    uMap[refId].invitedUserIds.push(String(u.telegram_id));
                }
            });

            ordersData.forEach((o: any) => {
                const userObj = o.users as any;
                const rawId = userObj?.telegram_id ?? (Array.isArray(userObj) ? userObj[0]?.telegram_id : null);
                const uId = rawId ? String(rawId) : null;

                if (uId && uMap[uId] && o.status === 'paid') {
                    uMap[uId].ordersCount++;
                    uMap[uId].totalSpend += (Number(o.price_usd) || 0);

                    const refId = String(uMap[uId].referrer_id);
                    if (uMap[uId].referrer_id && uMap[refId]) {
                        uMap[refId].refOrdersCount++;
                        uMap[refId].refTotalVolume += (Number(o.price_usd) || 0);
                        uMap[refId].earnedBonuses += (Number(o.price_usd) * 0.20 || 0);
                    }
                }
            });

            let sortedUsers = Object.values(uMap)
                .filter((u: any) => u.invitedCount > 0 || u.ordersCount > 0 || u.balance > 0)
                .sort((a: any, b: any) => b.earnedBonuses - a.earnedBonuses);

            const isOnlyManager = user?.role === 'manager';
            if (isOnlyManager) {
                // Manager only sees their own referral stats
                sortedUsers = sortedUsers.filter((u: any) => String(u.telegram_id) === String(user.telegram_id));
            }
            
            setOrders(ordersData);

            setUsersInfo(sortedUsers);
        }

        await fetchManagers();

        setLoading(false);
    };

    const handleAddManager = async () => {
        if (!newManagerId || !isAdmin) return;
        
        let query = supabase.from('users').select('*');
        const input = newManagerId.trim();
        
        if (/^\d+$/.test(input)) {
            query = query.eq('telegram_id', parseInt(input));
        } else {
            const username = input.startsWith('@') ? input.substring(1) : input;
            query = query.eq('username', username);
        }

        const { data: existingUser } = await query.single();
        
        if (!existingUser) {
            tg?.showAlert(t.managerAddError || 'Пользователь не найден.');
            return;
        }

        const { error: upErr } = await supabase.from('users').update({ role: newManagerRole }).eq('telegram_id', existingUser.telegram_id);
        
        if (upErr) {
            tg?.showAlert(t.managerAddFail || 'Ошибка обновления: ' + upErr.message);
        } else {
            tg?.showAlert(t.successTitle || "Успешно!");
            fetchManagers();
            setNewManagerId('');
        }
    };

    const handleRemoveManager = async (tgId: number) => {
        const { error } = await supabase.from('users').update({ role: 'client' }).eq('telegram_id', tgId);
        if (!error) {
            fetchManagers();
            tg?.showAlert(t.managerRemoveSuccess?.replace('{id}', String(tgId)) || `Удален`);
        }
    };

    const handleUpdateRole = async (tgId: number, newRole: 'manager' | 'admin') => {
        const { error } = await supabase.from('users').update({ role: newRole }).eq('telegram_id', tgId);
        if (!error) {
            fetchManagers();
            tg?.showAlert("✅ Роль обновлена");
        }
    };

    const handleMarkPaid = async (tgId: number, currentBalance: number) => {
        if (!window.confirm(t.confirmPayout?.replace('{amount}', currentBalance.toFixed(2)) || `Payout $${currentBalance.toFixed(2)}?`)) return;
        
        const { error: insErr } = await supabase.from('chat_history').insert({
            id: window.crypto.randomUUID(),
            user_id: tgId,
            role: 'assistant',
            content: `PAYOUT_RECORD:${currentBalance.toFixed(2)}`,
            created_at: new Date().toISOString()
        });

        if (insErr) {
            alert(t.promoError || "Error saving history: " + insErr.message);
            return;
        }

        const { error: upErr } = await supabase.from('users').update({ balance: 0 }).eq('telegram_id', tgId);
        
        if (upErr) {
            alert(t.errorTitle || "Ошибка: " + upErr.message);
        } else {
            alert(t.successTitle || "Успешно!");
            fetchData(); // reload
        }
    };

    const handleSaveNote = async (tgId: number) => {
        const { error } = await supabase.from('users').update({ custom_note: noteValue }).eq('telegram_id', tgId);
        if (!error) {
            setUsersInfo(prev => prev.map(u => u.telegram_id === tgId ? { ...u, custom_note: noteValue } : u));
            fetchManagers();
            setEditingNoteId(null);
            tg?.showAlert ? tg.showAlert(t.promoSuccess || "Заметка сохранена!") : alert(t.promoSuccess || "Saved!");
        }
    };

    const filteredOrders = orders.filter((o: any) => statusFilter === 'all' || o.status === statusFilter);

    const openRefDrilldown = async (user: any) => {
        setSelectedUser(user);
        if (!user.invitedUserIds || user.invitedUserIds.length === 0) {
            setRefOrders([]);
            return;
        }
        setRefOrdersLoading(true);
        const { data } = await supabase
            .from('orders')
            .select(`id, created_at, status, price_usd, users:user_id (telegram_id, username), tariffs:tariff_id (country, data_gb, validity_period)`)
            .in('user_id', user.invitedUserIds)
            .order('created_at', { ascending: false });
        setRefOrders(data || []);
        setRefOrdersLoading(false);
    };

    const closeRefDrilldown = () => {
        setSelectedUser(null);
        setRefOrders([]);
    };

    return (
        <div className="space-y-6">
            {isAdmin && (
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
                    <div className="flex flex-col gap-3 pt-2">
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={newManagerId}
                                onChange={(e) => setNewManagerId(e.target.value)}
                                className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 min-h-[42px] text-sm text-on-surface focus:outline-none focus:border-primary/50"
                                placeholder="12345678"
                            />
                            <button onClick={handleAddManager} className="whitespace-nowrap bg-primary/20 text-primary border border-primary/30 w-[42px] h-[42px] min-w-[42px] flex items-center justify-center rounded-lg shadow-[0_0_15px_rgba(208,188,255,0.1)] hover:bg-primary/30 transition-all active:scale-95">
                                <span className="material-symbols-outlined font-bold text-xl">add</span>
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-4 bg-surface-container-lowest/50 p-2 px-3 rounded-lg border border-outline-variant/10">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{t.roleLabel}</span>
                            <div className="flex gap-2 flex-1">
                                <button 
                                    onClick={() => setNewManagerRole('manager')}
                                    className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${newManagerRole === 'manager' ? 'bg-secondary/20 text-secondary border border-secondary/30' : 'bg-surface-container-high text-on-surface-variant'}`}
                                >
                                    {t.selectManager}
                                </button>
                                <button 
                                    onClick={() => setNewManagerRole('admin')}
                                    className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${newManagerRole === 'admin' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-on-surface-variant'}`}
                                >
                                    {t.selectAdmin}
                                </button>
                            </div>
                        </div>
                    </div>

                    {managersList.length > 0 && (
                        <div className="pt-4 mt-4 border-t border-outline-variant/10 space-y-2">
                            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">{t.activeEmployees}</p>
                            {managersList.map((m) => (
                                <div key={m.telegram_id} className="flex flex-col bg-surface-container-lowest p-2 px-3 rounded-lg border border-outline-variant/10 gap-2">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[16px] text-tertiary">
                                                {m.role === 'founder' ? 'shield_person' : (m.role === 'admin' ? 'manage_accounts' : 'badge')}
                                            </span>
                                            <span className="text-sm text-on-surface font-medium truncate max-w-[120px]">@{m.username || String(m.telegram_id)}</span>
                                            {m.role === 'founder' ? (
                                                <span className="text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm font-bold bg-primary/20 text-primary">
                                                    {t.ownerBadge}
                                                </span>
                                            ) : (
                                                <div className="flex bg-surface-container-high p-0.5 rounded border border-outline-variant/10">
                                                    <button 
                                                        onClick={() => handleUpdateRole(m.telegram_id, 'manager')}
                                                        className={`px-1.5 py-0.5 rounded-sm text-[8px] font-bold uppercase transition-all ${m.role === 'manager' ? 'bg-tertiary/20 text-tertiary' : 'text-on-surface-variant hover:text-on-surface'}`}
                                                    >
                                                        M
                                                    </button>
                                                    <button 
                                                        onClick={() => handleUpdateRole(m.telegram_id, 'admin')}
                                                        className={`px-1.5 py-0.5 rounded-sm text-[8px] font-bold uppercase transition-all ${m.role === 'admin' ? 'bg-secondary/20 text-secondary' : 'text-on-surface-variant hover:text-on-surface'}`}
                                                    >
                                                        A
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {m.role !== 'founder' && (
                                            <button onClick={() => handleRemoveManager(m.telegram_id)} className="text-error hover:bg-error/10 p-1.5 rounded-md transition-colors active:scale-95 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-[16px]">person_remove</span>
                                            </button>
                                        )}
                                    </div>

                                    {editingNoteId === m.telegram_id ? (
                                        <div className="flex gap-2">
                                            <input 
                                                type="text"
                                                value={noteValue}
                                                onChange={(e) => setNoteValue(e.target.value)}
                                                className="flex-1 bg-surface-container-high border border-outline-variant/20 rounded px-2 py-1 text-xs text-on-surface focus:outline-none"
                                                placeholder="Имя менеджера..."
                                                autoFocus
                                            />
                                            <button onClick={() => handleSaveNote(m.telegram_id)} className="bg-primary/20 text-primary p-1 rounded">
                                                <span className="material-symbols-outlined text-[14px]">check</span>
                                            </button>
                                            <button onClick={() => setEditingNoteId(null)} className="bg-error/20 text-error p-1 rounded">
                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                            </button>
                                        </div>
                                    ) : (
                                        m.custom_note && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
                                                    {m.custom_note}
                                                </span>
                                                <button 
                                                    onClick={() => {
                                                        setEditingNoteId(m.telegram_id);
                                                        setNoteValue(m.custom_note || '');
                                                    }}
                                                    className="text-on-surface-variant hover:text-primary transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">edit_note</span>
                                                </button>
                                            </div>
                                        ) || (
                                            <button 
                                                onClick={() => {
                                                    setEditingNoteId(m.telegram_id);
                                                    setNoteValue('');
                                                }}
                                                className="text-[10px] text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">add_notes</span>
                                                Добавить заметку
                                            </button>
                                        )
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
            )}

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
                                            <span>
                                                {o.tariffs ? (
                                                    <>
                                                        <span className="mr-1">{getFlag(o.tariffs.country)}</span>
                                                        {o.tariffs.country} | {o.tariffs.data_gb} | {o.tariffs.validity_period}
                                                    </>
                                                ) : t.deletedTariff}
                                            </span>
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
                                    <div className="flex items-center gap-2">
                                        <p className="font-headline font-semibold text-on-surface text-sm">{u.username ? `@${u.username}` : u.telegram_id}</p>
                                        {u.custom_note && (
                                            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
                                                {u.custom_note}
                                            </span>
                                        )}
                                        {editingNoteId !== u.telegram_id && (
                                            <button 
                                                onClick={() => {
                                                    setEditingNoteId(u.telegram_id);
                                                    setNoteValue(u.custom_note || '');
                                                }}
                                                className="text-on-surface-variant hover:text-primary transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">edit_note</span>
                                            </button>
                                        )}
                                    </div>
                                    {editingNoteId === u.telegram_id && (
                                        <div className="flex gap-2 mt-2">
                                            <input 
                                                type="text"
                                                value={noteValue}
                                                onChange={(e) => setNoteValue(e.target.value)}
                                                className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded px-2 py-1 text-xs text-on-surface focus:outline-none"
                                                placeholder={t.notePlaceholder || "Name or note..."}
                                                autoFocus
                                            />
                                            <button onClick={() => handleSaveNote(u.telegram_id)} className="bg-primary/20 text-primary p-1 rounded">
                                                <span className="material-symbols-outlined text-[14px]">check</span>
                                            </button>
                                            <button onClick={() => setEditingNoteId(null)} className="bg-error/20 text-error p-1 rounded">
                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                            </button>
                                        </div>
                                    )}
                                    <div className="text-[10px] text-on-surface-variant uppercase mt-1 flex flex-col gap-1">
                                        <div className="flex gap-3">
                                            <span>{t.invitedLabelStats || 'INVITED:'} <b className="text-primary">{u.invitedCount}</b></span>
                                            <span>{t.refDealsLabel || 'REF DEALS:'} <b className="text-secondary">{u.refOrdersCount}</b></span>
                                        </div>
                                        <div className="flex gap-3 mt-1 pt-1 border-t border-white/5">
                                            <span>{t.ownPurchasesLabel || 'OWN PURCHASES:'} <b className="text-on-surface">{u.ordersCount}</b></span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end pl-2 gap-2">
                                    <div>
                                        <p className="text-[10px] text-on-surface-variant uppercase">{t.refVolumeLabel || 'REF VOLUME'}</p>
                                        <p className="font-headline font-bold text-blue-400 mt-[-2px]">${(u.refTotalVolume || 0).toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-on-surface-variant uppercase">{t.commissionLabelAdmin || 'COMMISSION'}</p>
                                        <p className="font-headline font-bold text-green-400 mt-[-2px]">${u.earnedBonuses.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>

                            {u.invitedCount > 0 && (
                                <button
                                    onClick={() => openRefDrilldown(u)}
                                    className="w-full py-2 text-[11px] font-bold uppercase tracking-wider bg-secondary/10 text-secondary border border-secondary/20 rounded-lg flex items-center justify-center gap-1.5 hover:bg-secondary/20 active:scale-95 transition-all"
                                >
                                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                    {t.viewRefDealsBtn || 'View referral deals'}
                                </button>
                            )}

                            {/* Payouts Section */}
                            <div className="bg-surface-container-low rounded-lg p-3 border border-white/5">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[14px] text-tertiary">account_balance_wallet</span>
                                        <span className="text-xs font-bold text-on-surface uppercase tracking-widest">{t.balance || 'Balance'}: <span className="text-tertiary">${(u.balance || 0).toFixed(2)}</span></span>
                                    </div>
                                    {(u.balance || 0) > 0 && (
                                        <button onClick={() => handleMarkPaid(u.telegram_id, u.balance)} className="bg-tertiary/20 text-tertiary border border-tertiary/30 px-3 py-1 text-[10px] rounded-md font-bold uppercase tracking-wider hover:bg-tertiary/30 active:scale-95 transition-all">
                                            {t.payoutBtn || 'Payout'}
                                        </button>
                                    )}
                                </div>
                                
                                {u.payouts && u.payouts.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-outline-variant/10">
                                        <p className="text-[9px] text-on-surface-variant font-bold uppercase mb-1">{t.payoutHistoryLabel || 'Payout history:'}</p>
                                        <div className="flex flex-col gap-1 max-h-24 overflow-y-auto clean-scrollbar pr-1">
                                            {u.payouts.map((p: any, idx: number) => (
                                                <div key={idx} className="flex justify-between text-[10px] items-center bg-surface-container-lowest px-2 py-1 rounded">
                                                    <span className="text-on-surface-variant">{new Date(p.created_at).toLocaleDateString()} {new Date(p.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    <span className="font-bold text-error">-${Number(p.content.split(':')[1]).toFixed(2)}</span>
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
        {/* Referral Drilldown Modal */}
        {selectedUser && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={closeRefDrilldown}>
                <div className="bg-[#1a1a1f] w-full max-w-lg max-h-[82vh] rounded-t-2xl p-4 overflow-y-auto flex flex-col gap-3" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                        <div>
                            <p className="font-headline font-bold text-on-surface text-base">
                                рџ”— {t.refDealsTitle || 'Referral deals'} @{selectedUser.username || selectedUser.telegram_id}
                            </p>
                            <p className="text-[11px] text-on-surface-variant mt-0.5">
                                РџСЂРёРіР»Р°С€РµРЅРѕ: <b className="text-primary">{selectedUser.invitedCount}</b>
                                &nbsp;В·&nbsp; РЎРґРµР»РѕРє: <b className="text-secondary">{selectedUser.refOrdersCount}</b>
                                &nbsp;В·&nbsp; РћР±СЉС‘Рј: <b className="text-green-400">${(selectedUser.refTotalVolume || 0).toFixed(2)}</b>
                            </p>
                        </div>
                        <button onClick={closeRefDrilldown} className="text-on-surface-variant hover:text-on-surface p-1">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {refOrdersLoading ? (
                        <div className="text-center text-on-surface-variant text-sm py-4 animate-pulse">{t.loading}</div>
                    ) : refOrders.length === 0 ? (
                        <div className="text-center text-on-surface-variant text-sm py-4">{t.noOrders}</div>
                    ) : refOrders.map((o: any) => {
                        const u = o.users as any;
                        const uObj = Array.isArray(u) ? u[0] : u;
                        return (
                            <div key={o.id} className="glass-card p-3 rounded-xl border-l-4 border-l-secondary/30 text-sm">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-on-surface">{uObj?.username ? `@${uObj.username}` : uObj?.telegram_id || '?'}</span>
                                    <div className="text-right">
                                        <b className="text-green-400">${o.price_usd}</b>
                                        <p className="text-[10px] text-yellow-400 font-bold">+${(Number(o.price_usd) * 0.20).toFixed(2)} {t.commissionLabel || 'РєРѕРјРёСЃСЃРёСЏ'}</p>
                                    </div>
                                </div>
                                <div className="text-xs text-on-surface-variant space-y-0.5">
                                    <div>{o.tariffs ? `${o.tariffs.country} | ${o.tariffs.data_gb} | ${o.tariffs.validity_period}` : 'вЂ”'}</div>
                                    <div className="flex justify-between items-center">
                                        <span>{new Date(o.created_at).toLocaleString()}</span>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                            o.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                                            o.status === 'pending' ? 'bg-orange-500/20 text-orange-400' :
                                            'bg-red-500/20 text-red-400'
                                        }`}>{t.statuses ? (t.statuses[o.status] || o.status) : o.status}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
        </div>
    );
}

