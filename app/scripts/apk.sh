#!/usr/bin/env bash
#
# Build of an installable Android .apk, to be handed out by hand (sideload) with no store.
#
# Why it exists next to play.sh: Google Play takes an .aab, and an .aab CANNOT be installed on a
# phone — it is a publishing format that the store re-splits per device. To put the app on the phone
# of somebody who is standing next to you, the only thing that works is a signed universal .apk,
# which is what `assembleRelease` produces. Everything else is the same as play.sh: prebuild
# (android/ is a regenerable, gitignored artefact), automatic versionCode, and signing injected
# through Gradle properties without touching build.gradle.
#
# Usage, from app/:
#   APK_KEYSTORE=~/.private_keys/virovision-upload.p12 APK_KEYSTORE_PASSWORD=… bash scripts/apk.sh
#
# Without a keystore it still produces an installable .apk: the Expo template signs the release build
# type with the template's debug key. It is fine for a demo, but every machine's key is the same one,
# so prefer passing the upload key (the CI workflow does).
#
# ⚠️ An .apk signed with our key and an .apk installed from Google Play have DIFFERENT signatures
#    (Play App Signing re-signs with the key Google keeps). The day the app is published, whoever
#    got this .apk has to uninstall it before installing the store one — Android refuses to replace
#    an app with one signed by another key. It costs the app's local data, nothing else.
#
# versionCode = minutes since 1970, as in play.sh: it always grows, so a newer .apk installs OVER the
# previous one instead of being rejected as a downgrade. versionName comes from `expo.version`.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION_CODE="${VERSION_CODE:-$(( $(date +%s) / 60 ))}"

if [ ! -d android ]; then
  echo "› Prebuild Android…"
  npx expo prebuild --platform android --no-install
fi

# Expo writes versionCode as a literal in build.gradle; it is replaced before compiling.
sed -i.bak -E "s/versionCode [0-9]+/versionCode $VERSION_CODE/" android/app/build.gradle && rm -f android/app/build.gradle.bak

SIGNING=()
if [ -n "${APK_KEYSTORE:-}" ]; then
  : "${APK_KEYSTORE_PASSWORD:?APK_KEYSTORE_PASSWORD missing (APK_KEYSTORE was given)}"
  SIGNING=(
    -Pandroid.injected.signing.store.file="$APK_KEYSTORE"
    -Pandroid.injected.signing.store.password="$APK_KEYSTORE_PASSWORD"
    -Pandroid.injected.signing.key.alias="${APK_KEYSTORE_ALIAS:-upload}"
    -Pandroid.injected.signing.key.password="$APK_KEYSTORE_PASSWORD"
  )
else
  echo "› No APK_KEYSTORE: the release build type falls back to the template's debug key."
fi

echo "› assembleRelease (versionCode $VERSION_CODE)…"
(
  cd android
  ./gradlew :app:assembleRelease --no-daemon --quiet "${SIGNING[@]}"
)

APK=android/app/build/outputs/apk/release/app-release.apk
[ -f "$APK" ] || { echo "$APK did not show up" >&2; exit 1; }
echo "✓ $APK (versionCode $VERSION_CODE)"
echo "$VERSION_CODE" > android/app/build/outputs/apk/release/VERSION_CODE
