#!/usr/bin/env bash
#
# Archive + subida a TestFlight con Xcode, sin servicios de terceros.
#
# Por qué existe: el proyecto está en el Apple Developer Program y el canal de distribución al
# equipo y a los testers es TestFlight. Xcode hace todo el trabajo (firma, certificado de
# distribución, subida) y este script deja el procedimiento reproducible y sin clicks en el
# Organizer. EAS queda como opción futura para compilar sin Mac; no hace falta para esto.
#
# Uso, desde app/:
#   npm run ios:testflight                       # archive + export del .ipa (sin subir)
#   ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_PATH=…/AuthKey_XXXX.p8 npm run ios:testflight
#                                                # archive + subida directa a App Store Connect
#
# La API key se crea una vez en App Store Connect → Users and Access → Integrations →
# App Store Connect API → Team Keys (rol App Manager alcanza). El .p8 se descarga UNA sola vez:
# guardarlo fuera del repo (p. ej. ~/.private_keys/). Sin la key, el .ipa queda en
# build/export/ y se sube con Xcode → Window → Organizer → Distribute App, o con Transporter.
#
# El build number es la fecha-hora (CFBundleVersion debe crecer en cada subida y App Store Connect
# rechaza repetidos): así no hay que tocar app.json ni commitear un contador. La versión visible
# (CFBundleShortVersionString) sigue saliendo de `expo.version` en app.json.
set -euo pipefail

cd "$(dirname "$0")/.."

WORKSPACE=ios/ViroVision.xcworkspace
SCHEME=ViroVision
BUILD_DIR=build
ARCHIVE="$BUILD_DIR/ViroVision.xcarchive"
EXPORT_DIR="$BUILD_DIR/export"
BUILD_NUMBER="$(date +%Y%m%d%H%M)"

if [ ! -d "$WORKSPACE" ]; then
  echo "No existe $WORKSPACE: corré primero 'npx expo prebuild -p ios'." >&2
  exit 1
fi

AUTH=()
DESTINATION=export
if [ -n "${ASC_KEY_ID:-}" ] && [ -n "${ASC_ISSUER_ID:-}" ] && [ -n "${ASC_KEY_PATH:-}" ]; then
  AUTH=(-authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID" -authenticationKeyPath "$ASC_KEY_PATH")
  DESTINATION=upload
fi

echo "› Archive (build $BUILD_NUMBER)…"
# Expo escribe CFBundleVersion como literal en Info.plist (no como $(CURRENT_PROJECT_VERSION)), así
# que pasar la build setting a xcodebuild no alcanza — medido: la primera subida salió como "1".
# ios/ es un artefacto regenerable, editarlo acá no ensucia el repo.
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" ios/ViroVision/Info.plist
rm -rf "$ARCHIVE"
xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  COMPILER_INDEX_STORE_ENABLE=NO \
  -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"} archive | tail -3

# El ExportOptions se genera acá para que 'destination' siga a la presencia de la key.
PLIST="$BUILD_DIR/ExportOptions.plist"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>$DESTINATION</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
PLIST

echo "› Export ($DESTINATION)…"
rm -rf "$EXPORT_DIR"
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist "$PLIST" \
  -exportPath "$EXPORT_DIR" -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"} | tail -5

if [ "$DESTINATION" = upload ]; then
  echo "✓ Build $BUILD_NUMBER subido a App Store Connect. Aparece en TestFlight en unos minutos (procesamiento de Apple)."
else
  echo "✓ IPA en $EXPORT_DIR. Subilo con Xcode → Window → Organizer → Distribute App, o exportá ASC_KEY_ID/ASC_ISSUER_ID/ASC_KEY_PATH para subir directo."
fi
