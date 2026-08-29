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
cable ni Mac, y llegan a todo el equipo y a los testers externos (Luciano, UNCU) con un link.

El camino es **EAS Build + EAS Submit**, que compila en la nube y gestiona certificados y perfiles
solo. Los pasos que piden credenciales son interactivos; en una sesión de Claude, con el prefijo `!`:

```bash
cd app
npx eas-cli login                                   # cuenta de Expo (una vez)
npx eas-cli init                                    # crea el proyecto EAS y escribe extra.eas.projectId en app.json (una vez)
npx eas-cli build --platform ios --profile production   # pide el login de Apple la primera vez; registra el bundle ID y crea la app en App Store Connect si no existe
npx eas-cli submit --platform ios --latest          # sube el último build a TestFlight
```

`production` tiene `autoIncrement` con `appVersionSource: remote`: el `buildNumber` lo lleva EAS, no
`app.json`. `submit.production` ya trae `appleId` y `appleTeamId`; el `ascAppId` se completa la
primera vez que exista la app en App Store Connect (EAS lo pregunta).

Testers en App Store Connect → TestFlight:

- **Internos** (hasta 100, usuarios de App Store Connect): reciben cada build **sin revisión**,
  minutos después de subirlo. Es el canal del equipo.
- **Externos** (hasta 10 000, por link público): el **primer** build de cada versión pasa por *Beta
  App Review* (~1 día); los siguientes entran solos. Es el canal para la validación con usuarios.

El dev build por cable de arriba sigue siendo el ciclo de desarrollo (Metro, fast refresh); ya no
caduca a los 7 días. Con `npx eas-cli build --profile development` se obtiene el mismo dev client
firmado por EAS, instalable en los iPhones registrados con `npx eas-cli device:create`.

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
