#!/bin/bash
# Скрипт переезда Bot 1 на домен esim.ticaretai.tr

DOMAIN="esim.ticaretai.tr"
PORT=3001
TOKEN="8343840480:AAE6TBVIRy78G6aUVoYPjZaNj7L0JZKuXKk"

echo "🚀 Начинаю миграцию на $DOMAIN..."

# 1. Обновляем .env на сервере
echo "1. Обновляю переменные в .env..."
# Проверяем есть ли строки, если нет - добавим, если есть - заменим
grep -q "WEBHOOK_URL=" bot/.env && sed -i "s|WEBHOOK_URL=.*|WEBHOOK_URL=https://$DOMAIN|g" bot/.env || echo "WEBHOOK_URL=https://$DOMAIN" >> bot/.env
grep -q "WEBAPP_URL=" bot/.env && sed -i "s|WEBAPP_URL=.*|WEBAPP_URL=https://$DOMAIN|g" bot/.env || echo "WEBAPP_URL=https://$DOMAIN" >> bot/.env

# 2. Настраиваем Nginx
echo "2. Настраиваю Nginx сервер..."
# Создаем чистый конфиг для поддомена
sudo bash -c "cat > /etc/nginx/sites-available/default <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_cache_bypass \\\$http_upgrade;
    }
}
EOF"

sudo nginx -t && sudo systemctl reload nginx

# 3. SSL (Certbot)
echo "3. Получаю SSL сертификат..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m your@email.com

# 4. Telegram Webhook
echo "4. Регистрирую Webhook в Telegram..."
curl -s "https://api.telegram.org/bot$TOKEN/setWebhook?url=https://$DOMAIN/webhook"

# 5. Обновление кода и рестарт
echo "5. Запускаю обновление и PM2..."
./update1.sh

echo "✅ ВСЁ ГОТОВО! Бот 1 теперь живет на https://$DOMAIN"
pm2 status esim-bot-1
