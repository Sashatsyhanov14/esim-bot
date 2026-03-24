# ИСПРАВЛЕННЫЙ Скрипт миграции
# Скрипт переезда Bot 1 на домен esim.ticaretai.tr

DOMAIN="esim.ticaretai.tr"
PORT=3001
# ПРОВЕРЬ ЭТОТ ТОКЕН ЕЩЕ РАЗ В BOTFATHER!
TOKEN="8343840480:AAE6TBVIRY78G6aUVoYPjZaNj7LOJZKwXKk"

echo "🚀 Начинаю повторную миграцию..."

# 1. Права на вложенный скрипт
chmod +x update1.sh

# 2. Обновляем Nginx (более надежный способ)
echo "2. Настраиваю Nginx..."
sudo bash -c "cat > /etc/nginx/sites-available/default <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:$PORT;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
    }
}
EOF"
sudo nginx -t && sudo systemctl reload nginx

# 3. SSL - попробуем принудительно установить
echo "3. Устанавливаю SSL..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m your@email.com

# 4. Webhook
echo "4. Пробуем привязать Webhook..."
RESPONSE=$(curl -s "https://api.telegram.org/bot$TOKEN/setWebhook?url=https://$DOMAIN/webhook")
echo "Результат Telegram: $RESPONSE"

# 5. Рестарт
./update1.sh

echo "✅ ВСЁ ГОТОВО! Бот 1 теперь живет на https://$DOMAIN"
pm2 status esim-bot-1
