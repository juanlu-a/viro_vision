# CI/CD

Pipeline de GitHub Actions de la app de ViroVision. Dos ramas de larga vida: `staging` (la rama por
defecto; todo PR entra acá y cada merge publica a los testers internos) y `main` (producción; sólo
recibe PRs `staging → main`, y cada merge es una release).

## Workflows

| Workflow | Archivo | Disparo | Qué hace |
|----------|---------|---------|----------|
| **CI** | `.github/workflows/ci.yml` | PRs a `main` o a `staging`; pushes a cualquier rama que no sea esas dos | `npm ci`, lint, typecheck, tests, y después el bundle de iOS y Android como verificación de compilación, con el bundle como artefacto. |
| **TestFlight** | `.github/workflows/testflight.yml` | push a `staging` o `main` (cambios en `app/`), o manual desde cualquier rama | Runner macOS: lint, typecheck y tests, prebuild, archive, subida y asignación a un grupo de TestFlight. `staging` → grupo interno *Equipo ViroVision*, sin revisión; `main` → grupo externo *Testers ViroVision* con enlace público, donde el primer build de cada versión pasa por *Beta App Review*. Ver [`dev-build-ios.md`](dev-build-ios.md). |
| **Android APK (sideload)** | `.github/workflows/android-apk.yml` | push a `staging` (cambios en `app/`) mientras Play está apagado, o manual desde cualquier rama | Runner Linux: verificación de claves, prebuild y un `.apk` universal firmado con la clave de subida, como artefacto del run para instalar a mano. Es el equivalente Android del grupo interno de TestFlight (#79). No corre lint ni tests: `ci.yml` ya los exige para entrar a `staging`. Local: `bash scripts/apk.sh` desde `app/`. |
| **Google Play** | `.github/workflows/android-play.yml` | los mismos que TestFlight; **apagado** mientras `vars.PLAY_ENABLED` no sea `true` | Runner Linux: controles, prebuild, `.aab` firmado y Google Play Developer API. `staging` → *prueba interna*; `main` → *prueba cerrada (alpha)*. La cuenta de Play no está activa: ver [`android-play.md`](android-play.md). |
| **EAS Update (preview)** | `.github/workflows/eas-update.yml` | push a `main`, manual | Publica una actualización OTA de **EAS Update** a la rama `preview`. Apagado. |
| **EAS Build (iOS)** | `.github/workflows/eas-build-ios.yml` | manual (`workflow_dispatch`) | Lanza un build nativo de iOS en EAS Build. Apagado. |

CI corre sin configuración. Los dos workflows de EAS dependen de `vars.EAS_ENABLED == 'true'` y se
saltean (no fallan) mientras no esté: la distribución real no los usa.

## Protección de ramas sugerida (`staging` y `main`)

- Exigir un pull request antes de mergear; en `main`, sólo desde `staging`.
- Exigir que pasen los checks de **CI**: _Lint · Typecheck · Test_ y _Bundle (build check)_.
- (Opcional) exigir la rama al día antes de mergear.

## TestFlight

La distribución a testers va por **TestFlight con las herramientas de Xcode**, localmente
(`npm run ios:testflight`) o desde el workflow `TestFlight` en cada merge a `staging` (grupo interno)
o a `main` (grupo externo). Sin servicio de builds de terceros: la API key de App Store Connect vive
en los secrets del repo y la firma es manual, con el certificado y el perfil del equipo. Los
workflows de EAS quedan apagados y opcionales.

## Habilitar los workflows de EAS (opcional)

`app/eas.json` ya tiene tres perfiles de build, cada uno atado a un canal de EAS Update:

| Perfil | Canal | Distribución | iOS |
|---------|---------|--------------|-----|
| `development` | `development` | interna | simulador y dev client |
| `preview` | `preview` | interna | **simulador** (sin cuenta de Apple) |
| `production` | `production` | tienda | dispositivo (cuenta de Apple Developer, disponible desde 2026-08) |

Los canales se mapean a ramas de update, así que `eas update --branch preview` (el workflow de
deploy) llega a los builds del canal `preview`.

Puesta en marcha, una vez y en local (necesita el login de Expo):

1. `cd app && npx eas-cli login`
2. `npx eas-cli init`: crea el proyecto de EAS y escribe `extra.eas.projectId` en `app.json`.
3. `npx eas-cli update:configure`: instala `expo-updates` y fija `updates.url` y una política de
   `runtimeVersion` (fingerprint) para que las OTA resuelvan bien.
4. Crear un access token de Expo (expo.dev → cuenta → access tokens) y cargarlo como **secret**
   `EXPO_TOKEN`.
5. Poner la **variable** del repo `EAS_ENABLED` en `true`.
6. Sólo para builds de iOS de producción o en dispositivo: conectar la cuenta de Apple Developer para
   que EAS maneje la firma.

Después: los pushes a `main` publican una actualización de preview, y _Actions → EAS Build (iOS) →
Run workflow_ lanza un build de iOS.
