#!/bin/bash
# --- MEGA SETUP SCRIPT: 4 BOTS ON 1 VPS ---
# This script configures Nginx and SSL for all your bots.

echo "🚀 Starting Mega Setup for all 4 bots..."

# 1. Configuration
EMAILS="your@email.com" # Change this for certbot
DS=("/etc/nginx/sites-available/default")

# Bot 1: eSIM (Port 3001)
D1="esim.ticaretai.tr"
P1=3001

# Bot 2: Tour (Port 3002)
D2="tour.ticaretai.tr"
P2=3002

# Bot 3: Car (Port 3003)
D3="car.ticaretai.tr"
P3=3003

# Bot 4: Info (Port 3004)
D4="info.ticaretai.tr"
P4=3004

echo "📦 1. Overwriting Nginx configuration..."

sudo bash -c "cat > $DS <<EOF
# --- BOT 1: eSIM ---
server {
    listen 80;
    server_name $D1;
    location / {
        proxy_pass http://localhost:$P1;
        include proxy_params;
    }
}

# --- BOT 2: Tour ---
server {
    listen 80;
    server_name $D2;
    location / {
        proxy_pass http://localhost:$P2;
        include proxy_params;
    }
}

# --- BOT 3: Car ---
server {
    listen 80;
    server_name $D3;
    location / {
        proxy_pass http://localhost:$P3;
        include proxy_params;
    }
}

# --- BOT 4: Info ---
server {
    listen 80;
    server_name $D4;
    location / {
        proxy_pass http://localhost:$P4;
        include proxy_params;
    }
}
EOF"

echo "✅ Nginx config updated. Validating..."
sudo nginx -t && sudo systemctl reload nginx

echo "🔒 2. Requesting SSL for all domains (this may take a minute)..."
sudo certbot --nginx -d $D1 -d $D2 -d $D3 -d $D4 --non-interactive --agree-tos -m $EMAILS

echo "---------------------------------------------------"
echo "✅ MEGA SETUP COMPLETE!"
echo "---------------------------------------------------"
echo "Next steps:"
echo "1. Clone each bot to ~/bots/bot[1-4]"
echo "2. Set PORT=[3001-3004] in each bot/.env"
echo "3. Update Telegram Webhooks for each bot!"
echo "---------------------------------------------------"
