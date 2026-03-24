#!/bin/bash
# ФИНАЛЬНЫЙ Скрипт миграции Bot 1

DOMAIN="esim.ticaretai.tr"
PORT=3001
TOKEN="8343840480:AAE6TBVIRY78G6aUVoYPjZaNj7LOJZKwXKk"

echo "🚀 ЗАПУСК МИГРАЦИИ..."

# 1. Права
chmod +x update1.sh

# 2. Создаем конфиг Nginx (ПЕРЕЗАПИСЫВАЕМ С НУЛЯ)
echo "2. Настройка Nginx под $DOMAIN..."
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

# Перезагружаем Nginx, чтобы Certbot увидел домен
sudo nginx -t && sudo systemctl reload nginx

# 3. SSL (Certbot)
echo "3. Получение SSL..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m your@email.com

# 4. Webhook Telegram (с новым токеном)
echo "4. Привязка Webhook..."
RESPONSE=$(curl -s "https://api.telegram.org/bot$TOKEN/setWebhook?url=https://$DOMAIN/webhook")
echo "Результат Telegram: $RESPONSE"

# 5. Рестарт бота
echo "5. Обновление кода и рестарт..."
./update1.sh

echo "✅ ГОТОВО! Проверяй бота по адресу: https://$DOMAIN"
pm2 status esim-bot-1
