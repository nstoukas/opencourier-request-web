#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use --delete-prefix v20.20.2 >/dev/null 2>&1
cd /home/nstoukas/Documents/coding/open-courier/opencourier-request-web
exec node_modules/.bin/next dev -p 3090
