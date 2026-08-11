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

## Límites del provisioning gratuito

| Límite | Detalle |
|---|---|
| **Caducidad a los 7 días** | La app deja de abrir. Se arregla re-corriendo `npx expo run:ios --device`. |
| Máx. 3 apps por Apple ID | Simultáneamente instaladas con provisioning gratuito. |
| Sin push notifications, App Groups ni associated domains | **BLE central y cámara sí funcionan** — es lo que ViroVision necesita. |

Si la caducidad de 7 días se vuelve molesta, la salida es el **Apple Developer Program** (USD 99/año)
más un perfil `development-device` en `app/eas.json` **sin** `ios.simulator: true` (los perfiles
actuales sólo generan builds de simulador).

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
  desconectado, o falta aceptar *Confiar en esta computadora*.
