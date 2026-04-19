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

export default function ClientFaq({ lang }: { lang?: string }) {
    const [faqs, setFaqs] = useState<Faq[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        fetchFaqs();
    }, []);

    const fetchFaqs = async () => {
        setLoading(true);
        const { data } = await supabase.from('faq').select('*').order('created_at', { ascending: true });
        if (data) setFaqs(data);
        setLoading(false);
    };

    const getContent = (f: Faq) => {
        if (!lang || lang === 'ru') return f.content_ru;
        const key = `content_${lang}` as keyof Faq;
        return (f[key] as string) || f.content_ru;
    };

    const getTopic = (f: Faq) => {
        if (!lang || lang === 'ru') return f.topic;
        const key = `topic_${lang}` as keyof Faq;
        return (f[key] as string) || f.topic;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-pulse">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-on-surface-variant font-medium">Загрузка инструкций...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5">
                {faqs.map(f => (
                    <div 
                        key={f.id} 
                        className={`glass-card rounded-2xl overflow-hidden border border-white/5 transition-all duration-300 group ${expandedId === f.id ? 'ring-2 ring-primary/40 bg-surface-container-low/80' : 'hover:border-white/10 hover:bg-surface-container-low/30'}`}
                    >
                        <div 
                            className="cursor-pointer"
                            onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                        >
                            {f.image_url && (
                                <div className="aspect-[16/7] w-full relative overflow-hidden">
                                    <img 
                                        src={f.image_url} 
                                        alt={f.topic} 
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                                </div>
                            )}

                            <div className="p-5">
                                <div className="flex justify-between items-start gap-3">
                                    <h4 className={`text-lg font-headline font-bold leading-tight transition-colors ${expandedId === f.id ? 'text-primary' : 'text-on-surface'}`}>
                                        {getTopic(f)}
                                    </h4>
                                    <span className={`material-symbols-outlined transition-all duration-300 ${expandedId === f.id ? 'rotate-180 text-primary' : 'text-on-surface-variant'}`}>
                                        {expandedId === f.id ? 'keyboard_arrow_up' : 'expand_more'}
                                    </span>
                                </div>
                                
                                {expandedId !== f.id && (
                                    <p className="text-sm text-on-surface-variant mt-2 line-clamp-2 opacity-80 leading-snug">
                                        {getContent(f)}
                                    </p>
                                )}
                            </div>
                        </div>

                        {expandedId === f.id && (
                            <div className="px-5 pb-6 animate-in fade-in slide-in-from-top-2 duration-300 text-left">
                                <div className="h-px bg-white/10 mb-5" />
                                <div className="text-sm text-on-surface ring-1 ring-white/5 p-4 rounded-xl bg-black/20 leading-relaxed whitespace-pre-wrap">
                                    {getContent(f)}
                                </div>
                            </div>
                        )}
                        
                        {!f.image_url && expandedId !== f.id && (
                            <div className="px-5 pb-3">
                                <div className="flex items-center gap-1 text-primary/40">
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Читать далее</span>
                                    <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {faqs.length === 0 && (
                <div className="text-center py-20">
                    <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-4 opacity-20 text-on-surface">
                        <span className="material-symbols-outlined text-4xl">help_outline</span>
                    </div>
                    <p className="text-on-surface-variant text-sm font-medium">Инструкций пока нет</p>
                </div>
            )}
        </div>
    );
}
