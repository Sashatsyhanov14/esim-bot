import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Faq {
    id: string;
    topic: string;
    content_ru: string;
    content_tr?: string;
    content_en?: string;
    content_de?: string;
    content_pl?: string;
    content_ar?: string;
    content_fa?: string;
    topic_en?: string;
    topic_tr?: string;
    topic_de?: string;
    topic_pl?: string;
    topic_ar?: string;
    topic_fa?: string;
    image_url?: string;
}

export default function AdminFaq({ t }: { t: any }) {
    const [faqs, setFaqs] = useState<Faq[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Faq>>({});
    const [uploading, setUploading] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);

    useEffect(() => {
        fetchFaqs();
    }, []);

    const fetchFaqs = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('faq').select('*').order('created_at', { ascending: true });
        if (error) {
            console.error('[FETCH FAQ ERROR]', error);
            alert('Ошибка загрузки FAQ: ' + error.message);
        }
        if (data) setFaqs(data);
        setLoading(false);
    };

    const handleAutoTranslate = async () => {
        if (!formData.content_ru) return;
        setIsTranslating(true);

        const langs = ['tr', 'en', 'de', 'pl', 'ar', 'fa'];
        const newFormData = { ...formData };
        
        for (const lang of langs) {
            try {
                // Translate Content
                const resC = await fetch('/api/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: formData.content_ru, targetLang: lang })
                });
                const dataC = await resC.json();
                if (dataC.translatedText) {
                    (newFormData as any)[`content_${lang}`] = dataC.translatedText;
                }

                // Translate Topic
                if (formData.topic) {
                    const resT = await fetch('/api/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: formData.topic, targetLang: lang })
                    });
                    const dataT = await resT.json();
                    if (dataT.translatedText) {
                        (newFormData as any)[`topic_${lang}`] = dataT.translatedText;
                    }
                }
            } catch (e) {
                console.error(`Translation failed for ${lang}`, e);
            }
        }
        setFormData(newFormData);
        setIsTranslating(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `faq/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('images')
                .getPublicUrl(filePath);

            setFormData({ ...formData, image_url: publicUrl });
        } catch (error: any) {
            alert('Error uploading image: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.topic || !formData.content_ru) return;

        const payload = { 
            topic: formData.topic, 
            topic_en: formData.topic_en || formData.topic,
            topic_tr: formData.topic_tr || formData.topic,
            topic_de: formData.topic_de || formData.topic,
            topic_pl: formData.topic_pl || formData.topic,
            topic_ar: formData.topic_ar || formData.topic,
            topic_fa: formData.topic_fa || formData.topic,
            content_ru: formData.content_ru,
            content_tr: formData.content_tr || formData.content_ru,
            content_en: formData.content_en || formData.content_ru,
            content_de: formData.content_de || formData.content_ru,
            content_pl: formData.content_pl || formData.content_ru,
            content_ar: formData.content_ar || formData.content_ru,
            content_fa: formData.content_fa || formData.content_ru,
            image_url: formData.image_url 
        };

        let res;
        if (editingId === 'new') {
            // Explicitly set created_at for insert
            (payload as any).created_at = new Date().toISOString();
            res = await supabase.from('faq').insert([payload]);
        } else {
            res = await supabase.from('faq').update(payload).eq('id', editingId);
        }

        if (res.error) {
            console.error('[FAQ SAVE ERROR]', res.error);
            alert('Ошибка сохранения: ' + res.error.message);
            return;
        }

        setEditingId(null);
        setFormData({});
        fetchFaqs();
    };

    const handleDelete = async (id: string) => {
        if (confirm(t.deleteFaqConfirm)) {
            await supabase.from('faq').delete().eq('id', id);
            fetchFaqs();
        }
    };

    if (loading) return <div className="text-center p-4 animate-pulse text-on-surface-variant">Загрузка FAQ...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center pl-1">
                <h3 className="text-lg font-headline font-bold text-on-surface">{t.manageFaq}</h3>
                <button
                    onClick={() => { setEditingId('new'); setFormData({}); }}
                    className="flex items-center gap-1 bg-primary/20 text-primary border border-primary/30 px-3 py-1.5 rounded-lg text-sm font-bold active:scale-95 transition-all hover:bg-primary/30"
                >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    {t.addFaq}
                </button>
            </div>

            {editingId && (
                <div className="glass-card p-4 rounded-xl space-y-3 border border-primary/30 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] -z-10 translate-x-1/2 -translate-y-1/2"></div>

                    <h4 className="font-bold text-primary mb-3 text-lg flex items-center gap-2">
                        <span className="material-symbols-outlined">{editingId === 'new' ? 'add_circle' : 'edit_square'}</span>
                        {editingId === 'new' ? t.newFaq : t.editFaq}
                    </h4>

                    <div>
                        <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider pl-1 mb-1 block">Фото (Supabase Storage)</label>
                        <div className="flex flex-col gap-2">
                            {formData.image_url && (
                                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/10">
                                    <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                                    <button 
                                        onClick={() => setFormData({ ...formData, image_url: undefined })}
                                        className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full text-white hover:bg-black/80 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                    </button>
                                </div>
                            )}
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                    className="hidden"
                                    id="faq-image-upload"
                                />
                                <label 
                                    htmlFor="faq-image-upload"
                                    className={`w-full flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl transition-all cursor-pointer ${uploading ? 'bg-surface-container-high border-primary/20 opacity-50' : 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/40 hover:bg-surface-container-low'}`}
                                >
                                    <span className="material-symbols-outlined text-primary">
                                        {uploading ? 'sync' : 'add_photo_alternate'}
                                    </span>
                                    <span className="text-xs font-bold text-on-surface-variant">
                                        {uploading ? 'Загрузка...' : 'Загрузить фото'}
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider pl-1 mb-1 block">Тема / Topic</label>
                        <input
                            type="text"
                            placeholder={t.faqTopic}
                            value={formData.topic || ''}
                            onChange={e => setFormData({ ...formData, topic: e.target.value })}
                            className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-3 text-sm text-on-surface focus:border-primary/50 focus:outline-none transition-colors mb-2"
                        />
                    </div>

                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider pl-1 block">Инструкция (RU)</label>
                                {isTranslating && <span className="text-[10px] text-primary animate-pulse flex items-center gap-1 font-bold">✨ Переводим...</span>}
                            </div>
                            <textarea
                                placeholder={t.faqContent}
                                value={formData.content_ru || ''}
                                onChange={e => setFormData({ ...formData, content_ru: e.target.value })}
                                onBlur={() => { if(formData.content_ru) handleAutoTranslate(); }}
                                className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-3 text-sm text-on-surface min-h-[150px] focus:border-primary/50 focus:outline-none transition-colors shadow-inner"
                            />
                            {!isTranslating && formData.content_ru && (
                                <div className="mt-1 flex items-center gap-1.5 pl-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                                    <span className="text-[10px] text-on-surface-variant font-medium uppercase tracking-tight">Переводы активны (EN, TR, DE, PL, AR, FA)</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-3">
                        <button onClick={() => setEditingId(null)} className="flex-1 bg-surface-container-high text-on-surface py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors hover:bg-surface-container-highest">
                            {t.cancelBtn}
                        </button>
                        <button onClick={handleSave} className="flex-1 bg-primary text-on-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(208,188,255,0.3)] hover:brightness-110 active:scale-95 disabled:opacity-50" disabled={uploading || isTranslating}>
                            <span className="material-symbols-outlined text-[20px]">save</span>
                            {t.saveBtn}
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3">
                {faqs.map(f => (
                    <div key={f.id} className="glass-card p-4 rounded-xl relative overflow-hidden group hover:border-white/10 transition-colors">
                        <div className="flex gap-4">
                            {f.image_url && (
                                <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-white/5">
                                    <img src={f.image_url} alt="" className="w-full h-full object-cover" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <h4 className="font-headline font-bold text-on-surface truncate">{f.topic}</h4>
                                <p className="text-sm text-on-surface-variant line-clamp-2 mt-1">{f.content_ru}</p>
                            </div>
                        </div>

                        <div className="absolute top-3 right-3 flex gap-2">
                            <button onClick={() => { setEditingId(f.id); setFormData(f); }} className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center transition-colors hover:bg-surface-container-highest active:scale-90 opacity-80 hover:opacity-100">
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button onClick={() => handleDelete(f.id)} className="w-8 h-8 rounded-lg bg-error/10 text-error flex items-center justify-center transition-all hover:bg-error hover:text-white active:scale-90 opacity-80 hover:opacity-100">
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
