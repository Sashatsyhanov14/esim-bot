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
    payment_link?: string;
}

export default function ClientCatalog({ lang, telegramId }: { lang: string, telegramId?: string | null }) {
    const [tariffs, setTariffs] = useState<Tariff[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [buyLoading, setBuyLoading] = useState<string | null>(null);

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

    const handleBuy = async (tData: Tariff) => {
        if (!tg) {
            alert(lang === 'ru' ? 'Откройте WebApp через Telegram' : 'Open WebApp via Telegram');
            return;
        }

        setBuyLoading(tData.id);

        try {
            // First notify the backend to register the order silently
            if (telegramId) {
                await fetch('/api/catalog-buy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ telegramId, tariffId: tData.id })
                });
            }

            // Immediately redirect user to payment link
            if (tData.payment_link) {
                tg.openLink(tData.payment_link);
            } else {
                tg.openTelegramLink(`https://t.me/emedeoesimworld_bot?start=buy_${tData.id}`);
            }
            // Close the catalog webapp cleanly right after redirect triggers
            setTimeout(() => tg.close(), 500); 
        } catch (e) {
            console.error(e);
            tg.openTelegramLink(`https://t.me/emedeoesimworld_bot?start=buy_${tData.id}`);
            tg.close();
        } finally {
            setBuyLoading(null);
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

    // DB localization helper
    const loc = (field: string, tData: any) => {
        if (!lang || lang === 'en') return tData[field];
        if (field === 'country') {
            const localized = tData[`country_${lang}`];
            return localized && localized.trim() !== '' ? localized : tData.country;
        }
        return tData[field]; // data_gb and validity_period are now English-only
    };

    // Group by localized country
    const grouped = tariffs.reduce((acc: Record<string, Tariff[]>, tariff) => {
        const c = loc('country', tariff) || tariff.country;
        if (!acc[c]) acc[c] = [];
        acc[c].push(tariff);
        return acc;
    }, {});

    const countries = Object.keys(grouped).filter(c => c.toLowerCase().includes(searchQuery.toLowerCase()));

    const translations: Record<string, Record<string, string>> = {
        ru: { search: 'Поиск страны...', catalog: 'Каталог eSIM', back: 'Назад', buy: 'КУПИТЬ', traffic: 'Трафик', validity: 'Срок', empty: 'Ничего не найдено', loading: 'Загрузка тарифов...', open_tg: 'Откройте WebApp через Telegram' },
        en: { search: 'Search country...', catalog: 'eSIM Catalog', back: 'Back', buy: 'BUY NOW', traffic: 'Data', validity: 'Validity', empty: 'Nothing found', loading: 'Loading plans...', open_tg: 'Open WebApp via Telegram' },
        de: { search: 'Land suchen...', catalog: 'eSIM-Katalog', back: 'Zurück', buy: 'KAUFEN', traffic: 'Daten', validity: 'Gültigkeit', empty: 'Nichts gefunden', loading: 'Tarife laden...', open_tg: 'Öffne WebApp über Telegram' },
        pl: { search: 'Szukaj kraju...', catalog: 'Katalog eSIM', back: 'Wstecz', buy: 'KUP TERAZ', traffic: 'Internet', validity: 'Ważność', empty: 'Nic nie znaleziono', loading: 'Ładowanie taryf...', open_tg: 'Otwórz WebApp przez Telegram' },
        ar: { search: 'ابحث عن بلد...', catalog: 'كتالوج eSIM', back: 'خلف', buy: 'اشتر الآن', traffic: 'بيانات', validity: 'صلاحية', empty: 'لا شيء وجد', loading: 'جارٍ تحميل الخطط...', open_tg: 'افتح WebApp عبر تيليجرام' },
        fa: { search: 'جستجوی کشور...', catalog: 'کاتالوگ eSIM', back: 'بازگشت', buy: 'خرید', traffic: 'داده', validity: 'اعتبار', empty: 'چیزی یافت نشد', loading: 'در حال بارگذاری طرح‌ها...', open_tg: 'تگرام را باز کنید' },
        tr: { search: 'Ülke ara...', catalog: 'eSIM Kataloğu', back: 'Geri', buy: 'SATIN AL', traffic: 'İnternet', validity: 'Süre', empty: 'Bulunamadı', loading: 'Tarifeler yükleniyor...', open_tg: 'WebApp\'i Telegram üzerinden açın' }
    };
    
    // Safely fallback to 'en'
    const t = translations[lang as string] || translations['en'];
    const isRtl = lang === 'ar' || lang === 'fa';

    const getFlag = (countryName: string) => {
        const c = countryName.toLowerCase();
        // Countries & Regions
        if (c.includes('turk') || c.includes('турц') || c.includes('türkiye') || c.includes('türkiye') || c.includes('alanya') || c.includes('antalya') || c.includes('istanbul') || c.includes('side') || c.includes('kemer') || c.includes('belek') || c.includes('fethiye') || c.includes('marmaris') || c.includes('bodrum') || c.includes('cappadocia') || c.includes('аланья') || c.includes('анталья') || c.includes('стамбул') || c.includes('сиде') || c.includes('кемер') || c.includes('белек') || c.includes('фетхие') || c.includes('мармарис') || c.includes('бодрум') || c.includes('каппадокия')) return '🇹🇷';
        if (c.includes('europ') || c.includes('европ') || c.includes('avrupa')) return '🇪🇺';
        if (c.includes('usa') || c.includes('сша') || c.includes('abd')) return '🇺🇸';
        if (c.includes('thai') || c.includes('таил')) return '🇹🇭';
        if (c.includes('viet') || c.includes('вьет')) return '🇻🇳';
        if (c.includes('isra') || c.includes('изра') || c.includes('israil')) return '🇮🇱';
        if (c.includes('emir') || c.includes('оаэ') || c.includes('bae')) return '🇦🇪';
        if (c.includes('egypt') || c.includes('егип') || c.includes('mısır')) return '🇪🇬';
        if (c.includes('georg') || c.includes('груз') || c.includes('gürcistan')) return '🇬🇪';
        if (c.includes('armen') || c.includes('армен') || c.includes('ermenistan')) return '🇦🇲';
        if (c.includes('kazak') || c.includes('казак')) return '🇰🇿';
        if (c.includes('azer') || c.includes('азер') || c.includes('azerbaycan')) return '🇦🇿';
        if (c.includes('uzbek') || c.includes('узбек') || c.includes('özbekistan')) return '🇺🇿';
        if (c.includes('russia') || c.includes('росси') || c.includes('rusya')) return '🇷🇺';
        if (c.includes('montene') || c.includes('черногор') || c.includes('karadağ')) return '🇲🇪';
        if (c.includes('cyprus') || c.includes('кипр') || c.includes('kıbrıs')) return '🇨🇾';
        if (c.includes('france') || c.includes('франц') || c.includes('fransa')) return '🇫🇷';
        if (c.includes('italy') || c.includes('итали') || c.includes('italya')) return '🇮🇹';
        if (c.includes('spain') || c.includes('испан') || c.includes('ispanya')) return '🇪🇸';
        if (c.includes('greece') || c.includes('греци') || c.includes('yunanistan')) return '🇬🇷';
        if (c.includes('china') || c.includes('китай') || c.includes('çin')) return '🇨🇳';
        if (c.includes('japan') || c.includes('япон') || c.includes('japonya')) return '🇯🇵';
        if (c.includes('uk') || c.includes('brit') || c.includes('британ') || c.includes('ingiltere')) return '🇬🇧';
        if (c.includes('germany') || c.includes('герман') || c.includes('almanya')) return '🇩🇪';
        if (c.includes('poland') || c.includes('польш') || c.includes('polonya')) return '🇵🇱';
        if (c.includes('baltic') || c.includes('балти')) return '🇪🇪';
        if (c.includes('swiss') || c.includes('швейц') || c.includes('isviçre')) return '🇨🇭';
        if (c.includes('indones') || c.includes('индонез')) return '🇮🇩';
        if (c.includes('malays') || c.includes('малайз')) return '🇲🇾';
        return null;
    };

    if (selectedCountry) {
        const countryTariffs = grouped[selectedCountry] || [];
        return (
            <div className={`space-y-4 animate-fade-in pb-8 ${isRtl ? 'rtl text-right' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
                <button 
                    onClick={() => setSelectedCountry(null)}
                    className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors text-sm font-bold bg-surface-container p-2 rounded-xl border border-white/5 w-fit"
                >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    {t.back}
                </button>
                
                <h2 className="text-2xl font-headline font-extrabold text-slate-100 flex items-center gap-2 mb-4">
                    <span className="text-3xl filter drop-shadow-sm">
                        {getFlag(selectedCountry) || '🏳️'}
                    </span>
                    {selectedCountry}
                </h2>

                <div className="grid grid-cols-1 gap-4">
                    {countryTariffs.map(tData => (
                        <div key={tData.id} className="glass-card p-5 rounded-2xl relative overflow-hidden group shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] -z-10 translate-x-1/3 -translate-y-1/3 transition-all group-hover:bg-primary/20 pointer-events-none"></div>
                            
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-headline font-bold text-slate-100 text-lg">{loc('country', tData)}</h3>
                                <span className="text-2xl font-extrabold text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]">${tData.price_usd}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-5">
                                <div className="bg-surface-container-lowest/50 p-3 rounded-xl border border-outline-variant/10 flex items-center gap-3">
                                    <div className="bg-primary/10 p-1.5 rounded-lg flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary text-[18px]">wifi</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-on-surface-variant font-extrabold tracking-wider uppercase">{t.traffic}</span>
                                        <span className="text-slate-100 font-bold">{loc('data_gb', tData)}</span>
                                    </div>
                                </div>
                                <div className="bg-surface-container-lowest/50 p-3 rounded-xl border border-outline-variant/10 flex items-center gap-3">
                                    <div className="bg-secondary/10 p-1.5 rounded-lg flex items-center justify-center">
                                        <span className="material-symbols-outlined text-secondary text-[18px]">schedule</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-on-surface-variant font-extrabold tracking-wider uppercase">{t.validity}</span>
                                        <span className="text-slate-100 font-bold">{loc('validity_period', tData)}</span>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={() => handleBuy(tData)}
                                disabled={buyLoading === tData.id}
                                className="w-full bg-primary text-on-primary py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(208,188,255,0.2)] hover:bg-primary/90 active:scale-95 transition-all outline-none disabled:opacity-70 disabled:active:scale-100"
                            >
                                {buyLoading === tData.id ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>
                                        {t.buy}
                                    </>
                                )}
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
                {t.catalog}
            </h2>

            <div className="relative mx-1">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
                <input
                    type="text"
                    placeholder={t.search}
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
                        <span className="text-3xl mb-2 opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all filter drop-shadow-sm">
                            {getFlag(c) || '🏳️'}
                        </span>
                        <span className="font-headline font-bold text-slate-200 text-sm leading-tight text-balance group-hover:text-primary transition-colors">{c}</span>
                    </button>
                ))}
                
                {countries.length === 0 && (
                    <div className="col-span-2 text-center p-8 text-on-surface-variant border border-dashed border-outline-variant/20 rounded-2xl">
                        {t.empty}
                    </div>
                )}
            </div>
        </div>
    );
}
