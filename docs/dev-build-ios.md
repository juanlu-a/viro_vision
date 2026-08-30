# Correr ViroVision en un iPhone físico (development build)

Guía del camino **gratis**: firmar con un Apple ID personal, sin Apple Developer Program.

## Por qué no alcanza Expo Go

Expo Go es un binario fijo con un set cerrado de módulos nativos. `react-native-ble-plx`, la cámara
y cualquier módulo que agreguemos no están adentro, y los config plugins de `app.json` ni se aplican.
Para BLE, cámara o modelos on-device hace falta un **development build**: se compila *nuestra* app
con *nuestros* módulos nativos, se instala una vez en el teléfono, y a partir de ahí el desarrollo
sigue igual que con Expo Go — Metro, fast refresh y todo.

## Requisitos

- macOS con **Xcode** instalado (probado con Xcode 26.6).
- Un **Apple ID** cualquiera. No hace falta el Apple Developer Program (USD 99/año).
- El iPhone conectado por cable, desbloqueado y con el Mac marcado como *Confiar en esta computadora*.
- Node 20.19.4+ / 22.13+ (RN 0.86 lo exige; con versiones menores npm avisa `EBADENGINE`).

## Pasos

### 1. Identificador de la app

Ya está fijado en `app/app.json`: `ios.bundleIdentifier` y `android.package` = `com.virovision.app`.
Si al firmar Xcode se queja de que el identificador está tomado, sufijalo (`com.virovision.app.jl`)
en `app.json` y volvé a correr el prebuild.

### 2. Generar el proyecto nativo

```bash
cd app
npx expo prebuild --clean -p ios
```

`app/ios/` está gitignoreado a propósito (continuous native generation): es un artefacto, se
regenera cuando cambia `app.json` o se agrega un módulo nativo. Nunca lo edites a mano esperando
que sobreviva.

### 3. Firmar con el Apple ID personal (una sola vez)

```bash
open ios/ViroVision.xcworkspace
```

En Xcode:

1. **Xcode → Settings → Accounts → +** → añadí tu Apple ID.
2. Seleccioná el target **ViroVision** → pestaña **Signing & Capabilities**.
3. Marcá **Automatically manage signing** y elegí tu *Personal Team*.

### 4. Instalar en el teléfono

```bash
cd app
npx expo run:ios --device
```

Elegí el iPhone en la lista. La primera compilación tarda varios minutos.

La primera vez, el teléfono se niega a abrir la app: es un certificado de desarrollador que iOS no
conoce todavía. Hay que confiar en él a mano:

**Ajustes → General → VPN y gestión de dispositivos → \<tu Apple ID\> → Confiar**

### 5. Ciclo normal de desarrollo

```bash
cd app
npx expo start --dev-client
```

Sólo hay que re-instalar (repetir el paso 4) cuando cambian los módulos nativos, cambia `app.json`,
o cuando la app caduca (ver abajo).

## TestFlight (desde 2026-08: hay Apple Developer Program)

El Apple ID del proyecto está inscripto en el **Apple Developer Program** como cuenta **Individual**
(sirve para ViroVision y para cualquier otra app del mismo ID; el team `VPNXQ8K2P8` se conserva).
Eso habilita **TestFlight**: builds que duran **90 días**, se instalan desde la app TestFlight sin
cable ni Mac, y llegan al equipo y a los testers por invitación o por link.

**Sin servicios de terceros**: Xcode firma, crea el certificado de distribución y sube. El
procedimiento está en `scripts/testflight.sh` (`npm run ios:testflight`), para no depender de
clicks en el Organizer. EAS queda como opción futura si alguien sin Mac necesita compilar; los
perfiles siguen en `eas.json`, gateados.

### Una sola vez

1. **Crear la app en App Store Connect** (<https://appstoreconnect.apple.com> → Apps → **+** → Nueva
   app): plataforma iOS, nombre *ViroVision*, idioma español, bundle ID `com.virovision.app` (ya
   está en el team), SKU `virovision`. Sin esto, la subida falla con "No suitable application
   records were found".
2. **API key de App Store Connect** para subir desde la terminal: Users and Access → Integrations →
   App Store Connect API → Team Keys → **+** (rol *App Manager*). Anotar **Key ID** e **Issuer ID** y
   guardar el `.p8` fuera del repo (se descarga una sola vez), p. ej. `~/.private_keys/`.
   Sin key también funciona: el script deja el `.ipa` y se sube con Xcode → Window → Organizer →
   Distribute App → *TestFlight & App Store*.

### Cada build

```bash
cd app
ASC_KEY_ID=XXXXXXXXXX ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
ASC_KEY_PATH=~/.private_keys/AuthKey_XXXXXXXXXX.p8 npm run ios:testflight
```

Archive en Release, export con `method: app-store-connect` y subida. El **build number es la
fecha-hora** (`CURRENT_PROJECT_VERSION`), así cada subida es única sin tocar `app.json`; la versión
visible sigue siendo `expo.version`. Apple procesa el build en 5–15 min y aparece en TestFlight.

Dos detalles aprendidos en la primera subida (2026-08-29):

- **La API key tiene que ser de rol Administración.** Con *Gestor de apps* la subida funciona pero
  crear el certificado de distribución desde la terminal falla con `Cloud signing permission error`.
- `app.json` declara `ITSAppUsesNonExemptEncryption: false` (la app sólo usa HTTPS, que está
  exento): sin eso, cada build queda en TestFlight con "Falta el cumplimiento de exportación" hasta
  que alguien responde la pregunta a mano, y no llega a los testers.

### Automatizado: `staging` → prueba interna, `main` → link público

`.github/workflows/testflight.yml` corre en un runner macOS de GitHub (gratis: el repo es público):
lint + typecheck + tests, prebuild, archive, subida, y la distribución
(`scripts/testflight-distribute.mjs`: espera el procesamiento de Apple, carga "qué probar", y según
el destino asigna al grupo y envía a Beta App Review, o no).

**Una sola app en App Store Connect, dos grupos de TestFlight.** En el teléfono hay un ViroVision;
la app TestFlight muestra todos los builds a los que uno tiene acceso y se elige cuál instalar.

| Rama | Grupo de TestFlight | Tipo | Revisión de Apple | Quién la recibe |
|---|---|---|---|---|
| `staging` — donde van todos los PRs | *Equipo ViroVision* | **interna** | **ninguna**: llega en minutos | los devs (usuarios de App Store Connect) y algún allegado invitado |
| `main` — producción; se llega por PR `staging → main` (= *promover*) | *Testers ViroVision* | **externa**, link público <https://testflight.apple.com/join/jbE7GDqV> | Beta App Review del primer build de cada versión; los siguientes, minutos | cualquiera con el link |

*Actions → TestFlight → Run workflow* permite además publicar cualquier rama al destino que se
elija. Apple admite **un solo build por versión en revisión a la vez** (el script lo trata como
aviso). Un build tarda ~30 min de runner + 5–15 de procesamiento de Apple.

Se evaluó publicar la β como **app aparte** (`com.virovision.app.beta`, `app.config.js` con
`APP_VARIANT=beta`) para tener las dos instaladas a la vez, y se descartó: exige otra ficha en App
Store Connect y otra revisión, a cambio de algo que tres devs no necesitan. Queda reservado.

**Pruebas internas vs. externas** (Apple): internas = hasta 100 usuarios de App Store Connect,
nunca pasan por revisión, sin link público; externas = hasta 10 000 personas por link o email,
Beta App Review del primer build de cada versión. Para sumar un dev (o un allegado) a la prueba
interna: App Store Connect → Usuarios y acceso → invitarlo (rol *Desarrollador* para devs,
*Atención al cliente* para un allegado: no ve nada) → TestFlight → grupo *Equipo ViroVision* →
agregarlo. También se hace por API con `scripts/asc.mjs`.

Si algo llegó a `staging` y no va a producción, se revierte en `staging` con un PR de revert antes
del release: `staging` es la antesala de `main`, no un cajón de pruebas sueltas.

Secrets del repo: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (el contenido del `.p8`, rol
Administración), `EXPO_PUBLIC_GEMINI_API_KEY`, `EXPO_PUBLIC_ANTHROPIC_API_KEY` (opcional);
variable: `EXPO_PUBLIC_SIMULATE_DEVICE` — espejo del `.env` local, para que el build de CI sea el
mismo que el del Mac.

### Testers (App Store Connect → la app → TestFlight)

| | Internos | Externos |
|---|---|---|
| Quiénes | Usuarios de App Store Connect (invitar en *Users and Access*, rol *Customer Support* alcanza), hasta 100 | Cualquiera, hasta 10 000 |
| Cómo llegan | Invitación por email a TestFlight | **Link público** del grupo, o email |
| Revisión de Apple | **Ninguna**: cada build les llega en minutos | El **primer** build de cada versión pasa por *Beta App Review* (liviana, ~1 día); los siguientes entran solos |
| Para qué | El equipo y los allegados que prueban seguido | Validación con usuarios (Luciano, UNCU) y compartir un link |

El dev build por cable de arriba sigue siendo el ciclo de desarrollo (Metro, fast refresh); ya no
caduca a los 7 días.

### Lo que ya no aplica: límites del provisioning gratuito

Quedan documentados por si alguien clona el repo con un Apple ID sin programa pago: caducidad a los
7 días (se reinstala con `npx expo run:ios --device`), máximo 3 apps por Apple ID, sin push
notifications ni App Groups. BLE central y cámara funcionan igual.

## Android

Nada del código de la app es iOS-only. Cuando haga falta:

```bash
cd app
npx expo run:android   # requiere Android Studio + SDK
```

o un APK por EAS, que no requiere toolchain local ni cuenta paga.

## Problemas conocidos

- **`xcodebuild` no encuentra destino de simulador**: pasaba el 2026-07-18 porque el runtime
  instalado era iOS 26.2 y Xcode esperaba 26.5. Se resolvió instalando el runtime que falta
  (Xcode → Settings → Components, o `xcodebuild -downloadPlatform iOS`).
- **El iPhone aparece como `unavailable`** en `xcrun devicectl list devices`: está bloqueado,
  desconectado, o falta aceptar *Confiar en esta computadora*. Cuando pasa a
  `connected (no DDI)`, Xcode todavía está montando la imagen de desarrollo — esperá a que
  termine el *"Preparing iPhone…"* en Window → Devices and Simulators.

- **`Communication with Apple failed` / `No profiles for 'com.virovision.app' were found`** en
  Signing & Capabilities: el texto que importa es *"Your team has no devices"*. Con provisioning
  gratuito el perfil se emite **atado a un dispositivo**, así que no existe hasta que haya uno
  registrado. Conectá el iPhone, elegilo como destino y compilá — `xcodebuild` lo registra y
  genera el perfil solo. El botón *Try Again* no alcanza.

- **`Error: EPERM: operation not permitted, uv_cwd`** al correr cualquier comando de npm dentro
  del repo: es **TCC de macOS** bloqueando la carpeta Documentos, no permisos Unix (verificalo con
  `ls -ld ~/Documents` — si dice `drwx------` de tu usuario, los permisos del filesystem están
  bien). El síntoma característico es que `cd` funciona pero `getcwd()` falla.

  ```sh
  tccutil reset SystemPolicyDocumentsFolder com.apple.Terminal
  ```

  Después **⌘Q en Terminal** y volvé a abrirlo: al entrar al repo aparece el diálogo de permiso.
  **Abrir una pestaña o ventana nueva NO sirve** — siguen siendo hijas del mismo proceso
  `Terminal.app`, y TCC se evalúa cuando arranca la app. Alternativa gráfica: Ajustes del Sistema
  → Privacidad y seguridad → Archivos y carpetas (o Acceso a disco completo).

  Xcode tiene su propio permiso, así que aunque la terminal esté bloqueada podés compilar con
  **⌘R** desde Xcode. Ocurrió el 2026-07-18 y otra vez el 2026-08-10.
