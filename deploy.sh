#!/bin/bash
set -x

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install 18
nvm use 18

if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi

cd ~/
if [ ! -d "new_rfid_payment_system" ]; then
  git clone https://github.com/kawacukennedy/new_rfid_payment_system.git ~/new_rfid_payment_system
else
  cd ~/new_rfid_payment_system
  git checkout main
  git pull origin main
fi

cd ~/new_rfid_payment_system/backend

cat << 'EOF' > .env
TEAM_ID=kawacukennedy
PORT=3000
MQTT_BROKER=broker.benax.rw
MQTT_PORT=1883
NODE_ENV=production
MQTT_URL=mqtt://broker.benax.rw:1883
EOF

mkdir -p data
touch data/wallet.db
chmod 666 data/wallet.db

npm install
npm run build

pm2 delete rfid-backend || true
pm2 start dist/index.js --name rfid-backend
pm2 save
