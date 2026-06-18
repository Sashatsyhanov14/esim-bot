# eSIM Bot - Мультиязычный Telegram-бот для продажи eSIM

Telegram-бот с Mini App каталогом для продажи виртуальных SIM-карт (eSIM) по всему миру. Включает AI-консультанта, систему оплаты и админ-панель.

## 🎯 Описание проекта

Полнофункциональный бот для автоматизации продаж eSIM карт с возможностью масштабирования под любую географию.

### Ключевые особенности:
- 📱 **Telegram Mini App** - веб-каталог тарифов внутри бота
- 🤖 **AI-консультант** - многоязычный помощник на базе OpenAI
- 💳 **Система оплаты** - интеграция через QR-коды и платежные ссылки
- 🌍 **Мультиязычность** - RU, EN, TR, DE, PL, AR, FA
- 👥 **Реферальная система** - приглашение друзей с балансом
- 📊 **Админ-панель** - управление заказами, поддержка клиентов
- 🗄️ **Supabase на VPS** - собственная база данных

## Технологический стек

### Bot
- **Node.js** + Telegraf
- **OpenAI API** - AI-консультант
- **Supabase** (PostgreSQL) - база данных на VPS
- **Express** - API сервер

### Mini App (Webapp)
- **Vite** + **React** + **TypeScript**
- **Tailwind CSS**
- **Telegram WebApp API**

## Структура базы данных

```sql
tariffs (
  country, data_gb, validity_period, price_usd,
  payment_link, payment_qr_url
)

users (
  telegram_id, username, referrer_id, balance,
  lang_code, role (client/admin/manager),
  is_support_mode, manager_contact_id
)

orders (
  user_id, tariff_id, price_usd,
  status (pending/paid/cancelled)
)

chat_history (
  user_id, role (user/assistant), content
)

faq (
  topic, content_ru, content_tr, content_en, 
  content_de, content_pl, content_ar, content_fa
)
```

## Установка и запуск

### Требования
- Node.js 18+
- PostgreSQL / Supabase
- OpenAI API ключ
- Telegram Bot Token

### Установка

```bash
git clone https://github.com/Sashatsyhanov14/esim-bot.git
cd esim-bot
npm install  # Установит зависимости для bot/ и webapp/
```

### Конфигурация

**bot/.env:**
```env
BOT_TOKEN=your_telegram_bot_token
MANAGER_ID=your_telegram_id

# Supabase (на VPS или облако)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# OpenAI
OPENAI_API_KEY=your_openai_key

# Webapp URL
WEBAPP_URL=https://your-domain.com
```

**webapp/.env:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_key
```

### Инициализация базы данных

```bash
# Выполните в Supabase SQL Editor
psql -f database_schema.sql
psql -f faq_seed.sql
```

### Запуск

**Development:**
```bash
# Bot
cd bot
npm start

# Webapp (отдельный терминал)
cd webapp
npm run dev
```

**Production (VPS через PM2):**
```bash
pm2 start ecosystem.config.js
```

## Deployment на VPS

### Структура на сервере:
```
/var/www/esim-bot/
├── bot/          # Telegram bot (PM2)
└── webapp/       # Mini App (Nginx)
```

### Настройка:
```bash
# 1. Установите Supabase на VPS
# 2. Загрузите код
# 3. Установите зависимости
npm install

# 4. Соберите webapp
cd webapp && npm run build

# 5. Настройте Nginx для webapp
# 6. Запустите bot через PM2
pm2 start ecosystem.config.js
```

## Функционал

### Для клиентов:
- 🌍 Просмотр каталога тарифов по странам
- 💬 AI-консультант (отвечает на вопросы)
- 🎫 Выбор тарифа и получение ссылки/QR на оплату
- 📱 Инструкции по активации eSIM
- 🔗 Реферальная система (пригласи друга)

### Для админов:
- 📊 Просмотр всех заказов
- 💬 Поддержка клиентов (прямые сообщения)
- ✅ Подтверждение оплаты вручную
- 👥 Управление менеджерами
- 📈 Статистика продаж

## Мультиязычность

Бот автоматически определяет язык пользователя по `language_code` Telegram и поддерживает:
- 🇷🇺 Русский
- 🇬🇧 Английский
- 🇹🇷 Турецкий
- 🇩🇪 Немецкий
- 🇵🇱 Польский
- 🇸🇦 Арабский
- 🇮🇷 Персидский (Фарси)

AI-консультант переводит ответы в реальном времени через OpenAI.

## Платежная система

### Текущая реализация:
- Админ вручную добавляет `payment_link` и `payment_qr_url` для каждого тарифа
- После оплаты клиент отправляет подтверждение в бот
- Админ проверяет и активирует заказ

### Возможные интеграции:
- ЮKassa / Stripe для автоматических платежей
- Crypto payments
- Telegram Stars

## Скрипты для управления

```bash
# Проверка переменных окружения
node bot/check_env.js

# Список админов
node bot/list_admins.js

# Проверка тарифов
node bot/check_tariffs.js

# Перевод FAQ
node bot/translate_faq.js
```

## Особенности реализации

### AI-консультант
- Использует историю чата (последние 10 сообщений)
- Имеет доступ к FAQ базе знаний
- Адаптирует ответы под язык клиента

### Mini App каталог
- Открывается через кнопку в боте
- Фильтрация по странам
- QR-коды для оплаты прямо в приложении
- Адаптивный дизайн

### Реферальная система
- Уникальная ссылка для каждого пользователя
- Баланс за приглашенных друзей
- Статистика рефералов

## Статус проекта

**Что работает:**
- ✅ Telegram bot с командами
- ✅ Mini App каталог
- ✅ AI-консультант (мультиязычный)
- ✅ Админ-панель
- ✅ Supabase на VPS
- ✅ Реферальная система

**В разработке:**
- ⏳ Автоматическая оплата (ЮKassa)
- ⏳ Email уведомления
- ⏳ Аналитика продаж

**Статус монетизации:** 🚧 Проект развернут, база заполнена, ожидает трафик.

## Лицензия

Proprietary

## Контакты

- **GitHub**: [@Sashatsyhanov14](https://github.com/Sashatsyhanov14)
- **Email**: alexandertsyhanov@gmail.com
