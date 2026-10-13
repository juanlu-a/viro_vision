# Android: Google Play testing (internal + closed)

Espejo de [`dev-build-ios.md`](dev-build-ios.md) para el dev del equipo con Android. Misma
filosofía: sin servicios de terceros, la consola de la tienda hace el trabajo, y el repo tiene un
script por paso.

## Cuenta

**Google Play Console**, cuenta **personal** (USD 25 una sola vez, no renueva; verificación de
identidad con documento, horas a 1–2 días). Cuentas personales nuevas necesitan 12 testers durante
14 días en closed testing **antes de producción** — no aplica a internal testing, que es lo que
usa el equipo.

## Una app, dos pistas

| Rama | Pista de Google Play | Revisión de Google | Quién la recibe |
|---|---|---|---|
| `staging` | **Internal testing** | ninguna, minutos | hasta 100 testers por email (los devs) |
| `main` (release: PR `staging → main`) | **Closed testing — Alpha** | la primera release | testers por lista o **link de opt-in** |

## Pasos únicos (consola, sólo por web)

1. Crear la app: Play Console → *Crear app* → nombre **ViroVision**, idioma español
   (Latinoamérica), *App*, *Gratis*, aceptar declaraciones. El package name es
   `com.virovision.app` (lo fija el primer `.aab`).
2. **Play App Signing**: al subir el primer `.aab` Google genera y guarda la clave de firma real;
   nuestra *upload key* (`~/.private_keys/virovision-upload.p12`, PKCS12 generado con `openssl`,
   válido hasta 2056) sólo autentica las subidas. Si se pierde, se rota desde la consola.
3. **Service account** para subir desde CI: Play Console → *Configuración → Acceso a la API* →
   vincular un proyecto de Google Cloud → crear service account → en *Usuarios y permisos* darle
   el permiso *Releases* (lanzar a pistas de prueba). Descargar el JSON de la clave → secret
   `PLAY_SERVICE_ACCOUNT_JSON`; poner la variable `PLAY_ENABLED=true`.
4. Testers: *Internal testing → Testers → crear lista* con los emails (cuenta de Google del
   teléfono); *Closed testing → Alpha → Testers* → activar el **link de opt-in** y copiarlo.

Google exige que el **primer `.aab` se suba por la consola** (la API no puede crear la app): el
workflow deja el `.aab` como artefacto del run para arrastrarlo a *Internal testing* la primera
vez; a partir de ahí todo va por API.

## Cada build

`.github/workflows/android-play.yml` (runner Linux, gratis): lint + typecheck + tests → prebuild →
`scripts/play.sh` (Gradle `bundleRelease` con la upload key inyectada por propiedades
`android.injected.signing.*`, `versionCode` = minutos desde 1970, `versionName` = `expo.version`)
→ `scripts/gplay.mjs` (edits.insert → bundles.upload → tracks.update → commit, con service
account y JWT RS256 en `node:crypto`). A mano no se puede: el Mac del equipo no tiene JDK.

Secrets: `PLAY_UPLOAD_KEYSTORE_B64`, `PLAY_UPLOAD_KEYSTORE_PASSWORD` (ya cargados),
`PLAY_SERVICE_ACCOUNT_JSON` (pendiente de la cuenta). Variable: `PLAY_ENABLED`.

## Mientras tanto: el `.apk` a mano (sideload)

Un `.aab` **no se instala en un teléfono** — es formato de publicación, Google lo re-parte por
dispositivo. Así que hasta que exista la cuenta de Play, poner la app en el Android de alguien que
está al lado tuyo se hace con un `.apk` universal firmado. Es el equivalente Android del grupo
interno de TestFlight.

`.github/workflows/android-apk.yml` (runner Linux, gratis) →
`scripts/apk.sh` (Gradle `assembleRelease` con la upload key inyectada, mismo `versionCode` =
minutos desde 1970) → artefacto `virovision-apk` del run, con el `.apk` nombrado
`virovision-<versión>-<versionCode>.apk`.

| Cuándo corre | Qué deja |
|---|---|
| push a `staging` con cambios en `app/` | un `.apk` fresco como artefacto, listo para bajar y mandar |
| *Actions → Android APK (sideload) → Run workflow* | lo mismo desde **cualquier rama**, sin mergear |

El disparo por push se apaga solo cuando `PLAY_ENABLED=true`: ahí *internal testing* hace ese
trabajo y el workflow queda sólo manual.

Bajarlo: *Actions → el run → Artifacts*, o `gh run download <run-id> -n virovision-apk`. GitHub
entrega los artefactos **en un .zip**, hay que descomprimir antes de mandar el `.apk`.

Para instalarlo, el teléfono tiene que permitir orígenes desconocidos: al abrir el archivo Android
pregunta y manda a *Instalar apps desconocidas* → habilitar la app desde la que se abre (Archivos,
WhatsApp, Drive). Google Play Protect avisa que no reconoce la app: *Instalar de todos modos*.
Un `.apk` posterior se instala **encima** del anterior sin desinstalar, porque el `versionCode`
siempre crece y la firma es la misma.

> ⚠️ **Firma.** Este `.apk` va firmado con nuestra upload key; el que salga de Google Play va
> firmado con la clave que guarda Google (Play App Signing). Son firmas distintas: el día que la app
> se publique, quien tenga este `.apk` **tiene que desinstalarlo** antes de instalar el de la tienda.
> Se pierden los datos locales de la app, nada más.
