#!/usr/bin/env bash
#
# Build del .aab de Android firmado con la upload key, para subir a Google Play.
#
# Espejo de testflight.sh para el otro lado del equipo (un dev con Android): mismo patrón —
# prebuild (android/ es un artefacto regenerable, gitignoreado), versionCode automático, firma
# inyectada por propiedades de Gradle sin tocar build.gradle, y el resultado listo para
# scripts/gplay.mjs. Requiere JDK 17 + Android SDK (los trae el runner ubuntu de GitHub; el Mac
# del equipo no tiene Java, por eso esto corre en CI).
#
# Uso, desde app/:
#   PLAY_KEYSTORE=~/.private_keys/virovision-upload.p12 PLAY_KEYSTORE_PASSWORD=… bash scripts/play.sh
#
# La upload key es un PKCS12 generado con openssl (válido hasta 2056; Google pide ≥ 25 años).
# Con Play App Signing, Google guarda la clave de firma real y esta sólo autentica las subidas:
# si se pierde, se rota desde la consola sin perder la app.
#
# versionCode = minutos desde 1970: crece siempre (Google rechaza repetidos o menores), entra en
# int32 hasta el año 6053, y no hay que commitear un contador. versionName sigue saliendo de
# `expo.version` en app.json.
set -euo pipefail

cd "$(dirname "$0")/.."

: "${PLAY_KEYSTORE:?Falta PLAY_KEYSTORE (ruta al .p12 de la upload key)}"
: "${PLAY_KEYSTORE_PASSWORD:?Falta PLAY_KEYSTORE_PASSWORD}"
VERSION_CODE="${VERSION_CODE:-$(( $(date +%s) / 60 ))}"

if [ ! -d android ]; then
  echo "› Prebuild Android…"
  npx expo prebuild --platform android --no-install
fi

# Expo escribe versionCode como literal en build.gradle; se reemplaza antes de compilar.
sed -i.bak -E "s/versionCode [0-9]+/versionCode $VERSION_CODE/" android/app/build.gradle && rm -f android/app/build.gradle.bak

echo "› bundleRelease (versionCode $VERSION_CODE)…"
(
  cd android
  ./gradlew :app:bundleRelease --no-daemon --quiet \
    -Pandroid.injected.signing.store.file="$PLAY_KEYSTORE" \
    -Pandroid.injected.signing.store.password="$PLAY_KEYSTORE_PASSWORD" \
    -Pandroid.injected.signing.key.alias=upload \
    -Pandroid.injected.signing.key.password="$PLAY_KEYSTORE_PASSWORD"
)

AAB=android/app/build/outputs/bundle/release/app-release.aab
[ -f "$AAB" ] || { echo "No apareció $AAB" >&2; exit 1; }
echo "✓ $AAB (versionCode $VERSION_CODE)"
echo "$VERSION_CODE" > android/app/build/outputs/bundle/release/VERSION_CODE
