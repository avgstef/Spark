#!/usr/bin/env bash
# Builds a Linux AppImage into ./release
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js 18+ is required: https://nodejs.org"; exit 1; }
[ -d node_modules ] || npm install
npm run build
npx electron-builder --linux AppImage
echo "Done — see ./release"
