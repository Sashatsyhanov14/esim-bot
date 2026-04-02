import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Tariff {
    id: string;
    sort_number: number;
    country: string;
    data_gb: string;
    validity_period: string;
    price_usd: number;
    is_active: boolean;
}

export default function ClientCatalog({ lang }: { lang: string }) {
    const [tariffs, setTariffs] = useState<Tariff[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

    const tg = window.Telegram?.WebApp;

    useEffect(() => {
        fetchTariffs();
    }, []);

    const fetchTariffs = async () => {
        setLoading(true);
        const { data } = await supabase.from('tariffs').select('*').eq('is_active', true).order('sort_number', { ascending: true });
        if (data) setTariffs(data);
        setLoading(false);
    };

    const handleBuy = (tariffId: string) => {
        if (!tg) {
            alert(lang === 'ru' ? 'Откройте WebApp через Telegram' : 'Open WebApp via Telegram');
            return;
        }

        try {
            tg.sendData(JSON.stringify({ action: 'buy', tariffId }));
        } catch (e) {
            // Fallback to deeplink if sendData not supported (e.g., inline button context)
            tg.openTelegramLink(`https://t.me/emedeoesimworld_bot?start=buy_${tariffId}`);
            tg.close();
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-pulse">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-on-surface-variant font-medium">Загрузка тарифов...</p>
            </div>
        );
    }

    // Group by country
    const grouped = tariffs.reduce((acc: Record<string, Tariff[]>, tariff) => {
        if (!acc[tariff.country]) acc[tariff.country] = [];
        acc[tariff.country].push(tariff);
        return acc;
    }, {});

    const countries = Object.keys(grouped).filter(c => c.toLowerCase().includes(searchQuery.toLowerCase()));

    // Translations
    const lblSearch = lang === 'ru' ? 'Поиск страны...' : (lang === 'tr' ? 'Ülke ara...' : 'Search country...');
    const lblCatalog = lang === 'ru' ? 'Каталог eSIM' : (lang === 'tr' ? 'eSIM Kataloğu' : 'eSIM Catalog');
    const lblBack = lang === 'ru' ? 'Назад' : (lang === 'tr' ? 'Geri' : 'Back');
    const lblBuy = lang === 'ru' ? 'КУПИТЬ' : (lang === 'tr' ? 'SATIN AL' : 'BUY NOW');
    const lblTraffic = lang === 'ru' ? 'Трафик' : (lang === 'tr' ? 'İnternet' : 'Data');
    const lblValidity = lang === 'ru' ? 'Срок' : (lang === 'tr' ? 'Süre' : 'Validity');
    const lblEmpty = lang === 'ru' ? 'Ничего не найдено' : (lang === 'tr' ? 'Bulunamadı' : 'Nothing found');

    if (selectedCountry) {
        const countryTariffs = grouped[selectedCountry] || [];
        return (
            <div className="space-y-4 animate-fade-in pb-8">
                <button 
                    onClick={() => setSelectedCountry(null)}
                    className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors text-sm font-bold bg-surface-container p-2 rounded-xl border border-white/5 w-fit"
                >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    {lblBack}
                </button>
                
                <h2 className="text-2xl font-headline font-extrabold text-slate-100 flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-primary text-3xl">public</span>
                    {selectedCountry}
                </h2>

                <div className="grid grid-cols-1 gap-4">
                    {countryTariffs.map(tData => (
                        <div key={tData.id} className="glass-card p-5 rounded-2xl relative overflow-hidden group shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] -z-10 translate-x-1/3 -translate-y-1/3 transition-all group-hover:bg-primary/20 pointer-events-none"></div>
                            
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-headline font-bold text-slate-100 text-lg">{selectedCountry}</h3>
                                <span className="text-2xl font-extrabold text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]">${tData.price_usd}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-5">
                                <div className="bg-surface-container-lowest/50 p-3 rounded-xl border border-outline-variant/10 flex items-center gap-3">
                                    <div className="bg-primary/10 p-1.5 rounded-lg flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary text-[18px]">wifi</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-on-surface-variant font-extrabold tracking-wider uppercase">{lblTraffic}</span>
                                        <span className="text-slate-100 font-bold">{tData.data_gb}</span>
                                    </div>
                                </div>
                                <div className="bg-surface-container-lowest/50 p-3 rounded-xl border border-outline-variant/10 flex items-center gap-3">
                                    <div className="bg-secondary/10 p-1.5 rounded-lg flex items-center justify-center">
                                        <span className="material-symbols-outlined text-secondary text-[18px]">schedule</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-on-surface-variant font-extrabold tracking-wider uppercase">{lblValidity}</span>
                                        <span className="text-slate-100 font-bold">{tData.validity_period}</span>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={() => handleBuy(tData.id)}
                                className="w-full bg-primary text-on-primary py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(208,188,255,0.2)] hover:bg-primary/90 active:scale-95 transition-all outline-none"
                            >
                                <span className="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>
                                {lblBuy}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5 animate-fade-in pb-8">
            <h2 className="text-3xl font-headline font-extrabold text-slate-100 flex items-center gap-3 ml-2">
                <span className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center border border-primary/30 shadow-[0_0_15px_rgba(208,188,255,0.2)]">
                    <span className="material-symbols-outlined text-primary text-[24px]">storefront</span>
                </span>
                {lblCatalog}
            </h2>

            <div className="relative mx-1">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
                <input
                    type="text"
                    placeholder={lblSearch}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-on-surface focus:border-primary/50 focus:outline-none transition-all shadow-lg"
                />
            </div>

            <div className="grid grid-cols-2 gap-3 mx-1">
                {countries.map(c => (
                    <button
                        key={c}
                        onClick={() => setSelectedCountry(c)}
                        className="glass-card flex flex-col items-center justify-center p-5 rounded-2xl relative overflow-hidden group border border-outline-variant/10 hover:border-primary/30 active:scale-95 transition-all text-center h-28"
                    >
                        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors"></div>
                        <span className="material-symbols-outlined text-secondary text-3xl mb-2 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all">public</span>
                        <span className="font-headline font-bold text-slate-200 text-sm leading-tight text-balance group-hover:text-primary transition-colors">{c}</span>
                    </button>
                ))}
                
                {countries.length === 0 && (
                    <div className="col-span-2 text-center p-8 text-on-surface-variant border border-dashed border-outline-variant/20 rounded-2xl">
                        {lblEmpty}
                    </div>
                )}
            </div>
        </div>
    );
}
