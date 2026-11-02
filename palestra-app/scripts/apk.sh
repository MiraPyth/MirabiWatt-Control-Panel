#!/usr/bin/env bash
# MirabiWatt Palestra · costruisce l'APK di debug (02/11/2026): test, www, Capacitor, Gradle. Risultato in dist/.
set -euo pipefail
cd "$(dirname "$0")/.."
. "$HOME/android-dev/env.sh"
node scripts/prepara.js
npm test --silent
npx cap sync android
(cd android && ./gradlew assembleDebug -q --console=plain)
mkdir -p dist
VER=$(node -p "require('./package.json').version")
cp android/app/build/outputs/apk/debug/app-debug.apk "dist/mw-palestra-$VER.apk"
apksigner verify "dist/mw-palestra-$VER.apk" && echo "APK: dist/mw-palestra-$VER.apk"
