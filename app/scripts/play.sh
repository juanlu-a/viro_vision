#!/usr/bin/env bash
#
# Build of the Android .aab signed with the upload key, to be uploaded to Google Play.
#
# A mirror of testflight.sh for the other side of the team (a dev on Android): same pattern —
# prebuild (android/ is a regenerable, gitignored artefact), automatic versionCode, signing injected
# through Gradle properties without touching build.gradle, and the result ready for
# scripts/gplay.mjs. It requires JDK 17 + Android SDK (GitHub's ubuntu runner brings them; the team's
# Mac has no Java, which is why this runs in CI).
#
# Usage, from app/:
#   PLAY_KEYSTORE=~/.private_keys/virovision-upload.p12 PLAY_KEYSTORE_PASSWORD=… bash scripts/play.sh
#
# The upload key is a PKCS12 generated with openssl (valid until 2056; Google asks for ≥ 25 years).
# With Play App Signing, Google keeps the real signing key and this one only authenticates uploads:
# if it is lost, it is rotated from the console without losing the app.
#
# versionCode = minutes since 1970: it always grows (Google rejects duplicates or lower ones), fits
# in int32 until the year 6053, and there is no counter to commit. versionName still comes from
# `expo.version` in app.json.
set -euo pipefail

cd "$(dirname "$0")/.."

: "${PLAY_KEYSTORE:?PLAY_KEYSTORE missing (path to the upload key .p12)}"
: "${PLAY_KEYSTORE_PASSWORD:?PLAY_KEYSTORE_PASSWORD missing}"
VERSION_CODE="${VERSION_CODE:-$(( $(date +%s) / 60 ))}"

if [ ! -d android ]; then
  echo "› Prebuild Android…"
  npx expo prebuild --platform android --no-install
fi

# Expo writes versionCode as a literal in build.gradle; it is replaced before compiling.
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
[ -f "$AAB" ] || { echo "$AAB did not show up" >&2; exit 1; }
echo "✓ $AAB (versionCode $VERSION_CODE)"
echo "$VERSION_CODE" > android/app/build/outputs/bundle/release/VERSION_CODE
