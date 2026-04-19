-- Refined Tables for eSIM Bot MVP (Template Edition)

-- Очистка старых таблиц для применения новой структуры
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS chat_history CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tariffs CASCADE;

-- 1. Tariffs table
CREATE TABLE tariffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sort_number INTEGER, -- Номер (столбец A)
    country TEXT NOT NULL, -- Страна (столбец Country)
    data_gb TEXT NOT NULL, -- Количество гигов (1 Gb, unlimited)
    validity_period TEXT NOT NULL, -- Период (7 days)
    price_usd DECIMAL(10, 2) NOT NULL, -- Цена в USD
    payment_link TEXT, -- Ссылка на оплату
    payment_qr_url TEXT, -- Прямая ссылка на картинку с QR-кодом
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Users table
CREATE TABLE users (
    telegram_id BIGINT PRIMARY KEY,
    username TEXT,
    referrer_id BIGINT REFERENCES users(telegram_id),
    balance DECIMAL(10, 2) DEFAULT 0.00,
    lang_code TEXT DEFAULT 'ru',
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'founder', 'manager')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Chat History table (renamed from messages)
CREATE TABLE chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    tariff_id UUID REFERENCES tariffs(id),
    price_usd DECIMAL(10, 2), -- Цена на момент покупки
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_users_referrer ON users(referrer_id);
CREATE INDEX idx_chat_history_user ON chat_history(user_id);

-- 5. FAQ / Knowledge Base table
CREATE TABLE faq (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic TEXT NOT NULL,
    content_ru TEXT NOT NULL,
    content_tr TEXT NOT NULL,
    content_en TEXT,
    content_de TEXT,
    content_pl TEXT,
    content_ar TEXT,
    content_fa TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
