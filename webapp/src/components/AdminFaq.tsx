import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Faq {
    id: string;
    topic: string;
    content_ru: string;
}

export default function AdminFaq() {
    const [faqs, setFaqs] = useState<Faq[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Faq>>({});

    useEffect(() => {
        fetchFaqs();
    }, []);

    const fetchFaqs = async () => {
        setLoading(true);
        const { data } = await supabase.from('faq').select('*').order('created_at', { ascending: true });
        if (data) setFaqs(data);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!formData.topic || !formData.content_ru) return;

        if (editingId === 'new') {
            await supabase.from('faq').insert([{ topic: formData.topic, content_ru: formData.content_ru }]);
        } else {
            await supabase.from('faq').update({ topic: formData.topic, content_ru: formData.content_ru }).eq('id', editingId);
        }
        setEditingId(null);
        setFormData({});
        fetchFaqs();
    };

    const handleDelete = async (id: string) => {
        if (confirm('Точно удалить этот вопрос?')) {
            await supabase.from('faq').delete().eq('id', id);
            fetchFaqs();
        }
    };

    if (loading) return <div className="text-center p-4 animate-pulse text-on-surface-variant">Загрузка FAQ...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center pl-1">
                <h3 className="text-lg font-headline font-bold text-on-surface">Управление FAQ</h3>
                <button
                    onClick={() => { setEditingId('new'); setFormData({}); }}
                    className="bg-primary/20 text-primary border border-primary/30 px-3 py-1.5 rounded-lg text-sm font-bold active:scale-95"
                >
                    + Добавить
                </button>
            </div>

            {editingId && (
                <div className="glass-card p-4 rounded-xl space-y-3 border border-primary/30">
                    <h4 className="font-bold text-primary mb-2">{editingId === 'new' ? 'Новый FAQ' : 'Редактировать'}</h4>
                    <input
                        type="text"
                        placeholder="Тема / Вопрос"
                        value={formData.topic || ''}
                        onChange={e => setFormData({ ...formData, topic: e.target.value })}
                        className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-3 text-sm text-on-surface mb-2"
                    />
                    <textarea
                        placeholder="Ответ (на русском)..."
                        value={formData.content_ru || ''}
                        onChange={e => setFormData({ ...formData, content_ru: e.target.value })}
                        className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-3 text-sm text-on-surface min-h-[120px]"
                    />

                    <div className="flex gap-2 pt-2">
                        <button onClick={handleSave} className="flex-1 bg-primary text-on-primary py-2 rounded-lg font-bold">Сохранить</button>
                        <button onClick={() => setEditingId(null)} className="flex-1 bg-surface-container-high text-on-surface py-2 rounded-lg font-bold">Отмена</button>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3">
                {faqs.map(f => (
                    <div key={f.id} className="glass-card p-4 rounded-xl relative">
                        <h4 className="font-headline font-bold text-on-surface mb-1 flex items-start justify-between pr-16">{f.topic}</h4>
                        <p className="text-sm text-on-surface-variant line-clamp-2 mt-2">{f.content_ru}</p>

                        <div className="absolute top-3 right-3 flex gap-2">
                            <button onClick={() => { setEditingId(f.id); setFormData(f); }} className="p-1.5 bg-surface-container-high text-on-surface rounded-lg">✏️</button>
                            <button onClick={() => handleDelete(f.id)} className="p-1.5 bg-error/10 text-error rounded-lg">🗑️</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
