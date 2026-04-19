import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Faq {
    id: string;
    topic: string;
    content_ru: string;
    image_url?: string;
}

export default function ClientFaq() {
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
            <div className="grid grid-cols-1 gap-4">
                {faqs.map(f => (
                    <div 
                        key={f.id} 
                        className={`glass-card rounded-2xl overflow-hidden border border-white/5 transition-all duration-300 ${expandedId === f.id ? 'ring-2 ring-primary/50' : 'hover:border-white/10'}`}
                    >
                        <div 
                            className="cursor-pointer"
                            onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                        >
                            {f.image_url ? (
                                <div className="aspect-[16/9] w-full relative overflow-hidden">
                                    <img 
                                        src={f.image_url} 
                                        alt={f.topic} 
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-4">
                                        <h4 className="text-lg font-headline font-bold text-white leading-tight">{f.topic}</h4>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-5 flex items-center justify-between">
                                    <h4 className="text-lg font-headline font-bold text-on-surface">{f.topic}</h4>
                                    <span className={`material-symbols-outlined transition-transform duration-300 ${expandedId === f.id ? 'rotate-180' : ''}`}>
                                        expand_more
                                    </span>
                                </div>
                            )}
                        </div>

                        {expandedId === f.id && (
                            <div className="p-5 pt-0 animate-in fade-in slide-in-from-top-2 duration-300">
                                {!f.image_url && <div className="h-px bg-white/5 mb-4" />}
                                <div className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                                    {f.content_ru}
                                </div>
                            </div>
                        )}
                        
                        {f.image_url && expandedId !== f.id && (
                            <div className="px-4 py-2 bg-surface-container-low/50 flex justify-center">
                                <span className="material-symbols-outlined text-primary/40 text-[20px]">expand_more</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {faqs.length === 0 && (
                <div className="text-center py-20">
                    <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-4 opacity-20">
                        <span className="material-symbols-outlined text-4xl">help_outline</span>
                    </div>
                    <p className="text-on-surface-variant text-sm font-medium">Инструкций пока нет</p>
                </div>
            )}
        </div>
    );
}
