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

# El proyecto nativo lo genera expo prebuild a partir del nombre de la app, que en la variante
# beta es otro (app.config.js): se descubre en vez de asumirlo.
WORKSPACE=$(ls -d ios/*.xcworkspace 2>/dev/null | head -1 || true)
SCHEME=$(basename "${WORKSPACE:-ViroVision.xcworkspace}" .xcworkspace)
BUILD_DIR=build
ARCHIVE="$BUILD_DIR/ViroVision.xcarchive"
EXPORT_DIR="$BUILD_DIR/export"
# Sobreescribible desde CI, que lo necesita después para asignar el build a su grupo.
BUILD_NUMBER="${BUILD_NUMBER:-$(date +%Y%m%d%H%M)}"

if [ -z "$WORKSPACE" ] || [ ! -d "$WORKSPACE" ]; then
  echo "No hay ios/*.xcworkspace: corré primero 'npx expo prebuild -p ios'." >&2
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
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" "ios/$SCHEME/Info.plist"
rm -rf "$ARCHIVE"
mkdir -p "$BUILD_DIR"
# El log completo va a archivo y a la pantalla sólo el cierre; si falla, se muestran las últimas
# líneas ANTES de salir — un `| tail -3` a secas se comió el error real dos veces (2026-08-30).
# En CI el archive va SIN firmar y firma el export (que usa la distribución cloud, una sola y
# reusable). El porqué, aprendido a golpes el 2026-08-30: la firma automática de archive usa
# identidad de desarrollo, y en un runner efímero eso creaba un certificado de desarrollo nuevo por
# corrida hasta el tope de la cuenta ("maximum number of certificates"; hubo que revocar 16);
# forzar CODE_SIGN_IDENTITY="Apple Distribution" tampoco sirve — Xcode lo rechaza como conflicto
# con la firma automática. Sólo aplica con API key; en el Mac se firma como siempre.
DIST=()
if [ "${#AUTH[@]}" -gt 0 ]; then
  DIST=(CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO)
fi
if ! xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  COMPILER_INDEX_STORE_ENABLE=NO \
  ${DIST[@]+"${DIST[@]}"} \
  -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"} archive > "$BUILD_DIR/xcodebuild-archive.log" 2>&1; then
  echo "✗ Archive falló; últimas líneas del log:" >&2
  tail -80 "$BUILD_DIR/xcodebuild-archive.log" >&2
  exit 65
fi
tail -3 "$BUILD_DIR/xcodebuild-archive.log"

# Con el archive sin firmar (camino CI), exportArchive no puede deducir el equipo del archive y
# falla con "No Team Found in Archive" (run del 2026-08-30): hay que declararlo en el
# ExportOptions. Se lee del pbxproj —lo fija plugins/withDevelopmentTeam.js en el prebuild— para
# que el ID viva en un solo lugar. En el Mac el archive va firmado y el teamID coincide: es inocuo.
TEAM_ID=$(sed -n 's/.*DEVELOPMENT_TEAM = \([A-Z0-9]*\);.*/\1/p' "ios/$SCHEME.xcodeproj/project.pbxproj" | head -1)
if [ -z "$TEAM_ID" ]; then
  echo "No hay DEVELOPMENT_TEAM en el pbxproj: el prebuild no corrió plugins/withDevelopmentTeam.js." >&2
  exit 64
fi

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
  <key>teamID</key><string>$TEAM_ID</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
PLIST

echo "› Export ($DESTINATION)…"
rm -rf "$EXPORT_DIR"
if ! xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist "$PLIST" \
  -exportPath "$EXPORT_DIR" -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"} > "$BUILD_DIR/xcodebuild-export.log" 2>&1; then
  echo "✗ Export falló; últimas líneas del log:" >&2
  tail -80 "$BUILD_DIR/xcodebuild-export.log" >&2
  exit 70
fi
tail -5 "$BUILD_DIR/xcodebuild-export.log"

if [ "$DESTINATION" = upload ]; then
  echo "✓ Build $BUILD_NUMBER subido a App Store Connect. Aparece en TestFlight en unos minutos (procesamiento de Apple)."
else
  echo "✓ IPA en $EXPORT_DIR. Subilo con Xcode → Window → Organizer → Distribute App, o exportá ASC_KEY_ID/ASC_ISSUER_ID/ASC_KEY_PATH para subir directo."
fi
