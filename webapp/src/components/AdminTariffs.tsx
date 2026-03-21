import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Tariff {
    id: string;
    sort_number: number;
    country: string;
    data_gb: string;
    validity_period: string;
    price_usd: number;
    payment_link?: string;
    payment_qr_url?: string;
    is_active: boolean;
}

export default function AdminTariffs() {
    const [tariffs, setTariffs] = useState<Tariff[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Tariff>>({});

    useEffect(() => {
        fetchTariffs();
    }, []);

    const fetchTariffs = async () => {
        setLoading(true);
        const { data } = await supabase.from('tariffs').select('*').order('sort_number', { ascending: true });
        if (data) setTariffs(data);
        setLoading(false);
    };

    const handleSave = async () => {
        if (editingId === 'new') {
            await supabase.from('tariffs').insert([formData]);
        } else {
            await supabase.from('tariffs').update(formData).eq('id', editingId);
        }
        setEditingId(null);
        setFormData({});
        fetchTariffs();
    };

    const handleDelete = async (id: string) => {
        if (confirm('Точно удалить тариф?')) {
            await supabase.from('tariffs').delete().eq('id', id);
            fetchTariffs();
        }
    };

    if (loading) return <div className="text-center p-4 animate-pulse text-on-surface-variant">Загрузка тарифов...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center pl-1">
                <h3 className="text-lg font-headline font-bold text-on-surface">Управление тарифами</h3>
                <button
                    onClick={() => { setEditingId('new'); setFormData({ is_active: true, sort_number: tariffs.length + 1 }); }}
                    className="bg-primary/20 text-primary border border-primary/30 px-3 py-1.5 rounded-lg text-sm font-bold active:scale-95"
                >
                    + Добавить
                </button>
            </div>

            {editingId && (
                <div className="glass-card p-4 rounded-xl space-y-3 border border-primary/30">
                    <h4 className="font-bold text-primary mb-2">{editingId === 'new' ? 'Новый тариф' : 'Редактировать'}</h4>
                    <input type="number" placeholder="Сортировка (1, 2...)" value={formData.sort_number || ''} onChange={e => setFormData({ ...formData, sort_number: parseInt(e.target.value) })} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-2 text-sm text-on-surface mb-2" />
                    <input type="text" placeholder="Страна (Turkiye, Europe)" value={formData.country || ''} onChange={e => setFormData({ ...formData, country: e.target.value })} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-2 text-sm text-on-surface mb-2" />
                    <input type="text" placeholder="Трафик (1 Gb, unlimited)" value={formData.data_gb || ''} onChange={e => setFormData({ ...formData, data_gb: e.target.value })} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-2 text-sm text-on-surface mb-2" />
                    <input type="text" placeholder="Срок (7 days)" value={formData.validity_period || ''} onChange={e => setFormData({ ...formData, validity_period: e.target.value })} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-2 text-sm text-on-surface mb-2" />
                    <input type="number" placeholder="Цена USD (10.50)" value={formData.price_usd || ''} onChange={e => setFormData({ ...formData, price_usd: parseFloat(e.target.value) })} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-2 text-sm text-on-surface mb-2" />
                    <input type="text" placeholder="QR ссылка (https://...)" value={formData.payment_qr_url || ''} onChange={e => setFormData({ ...formData, payment_qr_url: e.target.value })} className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-2 text-sm text-on-surface mb-2" />

                    <label className="flex items-center gap-2 text-sm text-on-surface">
                        <input type="checkbox" checked={formData.is_active || false} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} className="rounded bg-surface-container-lowest border-outline-variant" />
                        Активен
                    </label>

                    <div className="flex gap-2 pt-2">
                        <button onClick={handleSave} className="flex-1 bg-primary text-on-primary py-2 rounded-lg font-bold">Сохранить</button>
                        <button onClick={() => setEditingId(null)} className="flex-1 bg-surface-container-high text-on-surface py-2 rounded-lg font-bold">Отмена</button>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3">
                {tariffs.map(t => (
                    <div key={t.id} className={`glass-card p-4 rounded-xl relative ${!t.is_active ? 'opacity-50' : ''}`}>
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <span className="text-[10px] bg-secondary/20 text-secondary px-2 py-0.5 rounded font-bold uppercase mr-2.5">#{t.sort_number}</span>
                                <span className="font-headline font-bold text-on-surface text-lg">{t.country}</span>
                            </div>
                            <span className="font-headline font-extrabold text-green-400">${t.price_usd}</span>
                        </div>
                        <div className="text-sm text-on-surface-variant flex gap-3">
                            <span>🛜 {t.data_gb}</span>
                            <span>⏳ {t.validity_period}</span>
                        </div>
                        {t.payment_qr_url && <div className="text-[10px] text-tertiary mt-1 truncate">QR: {t.payment_qr_url.substring(0, 30)}...</div>}

                        <div className="absolute bottom-3 right-3 flex gap-2">
                            <button onClick={() => { setEditingId(t.id); setFormData(t); }} className="p-1.5 bg-surface-container-high text-on-surface rounded-lg">✏️</button>
                            <button onClick={() => handleDelete(t.id)} className="p-1.5 bg-error/10 text-error rounded-lg">🗑️</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
