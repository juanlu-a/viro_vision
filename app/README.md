# ViroVision: aplicación móvil

Aplicación React Native (Expo) de ViroVision. Se vincula por BLE con el dispositivo (Raspberry Pi
Zero 2 W con la AI Camera), refleja el modo que eligió el botón físico, recibe las lecturas y las
dice en voz alta. **La accesibilidad es un requisito duro**: la aplicación está pensada para personas
ciegas o con baja visión, la voz es la interfaz, y todo se construye y se prueba con VoiceOver y
TalkBack.

## Stack

- **Expo SDK 57** · React Native 0.86 · React 19 · TypeScript (`app/package.json`)
- **Nueva Arquitectura** (JSI, bridgeless) habilitada
- **Expo Router** (rutas por archivo en `src/app/`), con la barra de pestañas **nativa** (`NativeTabs`)
- **react-native-ble-plx**: canal de control BLE (GATT) con el dispositivo (ADR 0003)
- **react-native-wifi-reborn**: unión automática al punto de acceso de la placa, por donde baja la foto
- **expo-speech** y **expo-audio**: voz en el teléfono, sesión de audio y tono de mantenimiento
- **react-native-executorch**: OCR local en el teléfono (sólo el botón «Leer» de la app en modo ómnibus)
- **@supabase/supabase-js**: cliente de la capa de cuenta, archivada (ver abajo)
- **NativeWind**: estilos con los tokens de marca (`constants/theme.ts`, `colors.js`)

> Los módulos nativos (BLE, WiFi, ExecuTorch) necesitan un **dev client propio**: no corren en Expo
> Go. Ver [`docs/dev-build-ios.md`](../docs/dev-build-ios.md).

## Primeros pasos

```bash
npm install
cp .env.example .env      # proxy de visión, telemetría; ver los comentarios del archivo
npx expo start            # servidor de desarrollo, contra un dev client ya instalado

# Dev client con los módulos nativos:
npx expo run:ios --device # o: npx expo run:android
```

Verificación mínima antes de un PR (la misma que corre CI):

```bash
npm run lint && npm run typecheck && npm test
```

## Estructura

```
src/
  app/                  # rutas de Expo Router
    _layout.tsx         # providers, telemetría, sesión de audio, ErrorBoundary raíz
    (tabs)/             # pestañas nativas: index (Inicio), connect (Dispositivo), settings (Ajustes)
  components/           # primitivos accesibles sin dominio (accessible-button, card, screen, themed-*)
  constants/            # tokens de tema y su test de contraste WCAG
  features/
    audio/              # announcer, salida elegida (audioOutput), avisos de sistema, selector
    auth/               # AuthContext: capa de cuenta archivada, no montada (ADR 0002)
    device/             # DeviceProvider (enlace BLE + WiFi), perfil GATT, DeviceSummary, BusShots
    reader/             # pipeline de lectura por modo (readingService), modos, selector de modelo
    recognition/        # modelo de dominio y frase en español de cada reconocimiento
  hooks/                # use-theme
  i18n/                 # es.ts: claves en inglés, valores en español (todo texto visible o hablado)
  services/
    audio/              # sesión de audio, TTS, síntesis a archivo
    ble/                # BleClient: implementación real (bleClientPlx) + cola de operaciones GATT
    camera/             # descarga de la foto del dispositivo por HTTP
    cloud/              # transporte al proxy de Supabase (ADR 0008)
    evidence/           # fotos del modo ómnibus: bajada, cola de subida, galería (temporal)
    ondevice/           # OCR local (ExecuTorch)
    storage/            # preferencias en AsyncStorage (salida de audio, modelo, último dispositivo)
    supabase/           # cliente de auth por email (archivado)
    telemetry/          # cola y envío de eventos a la tabla `events`
    vision/             # modo supermercado: proveedores de visión en la nube, esquema, cuota
    wifi/               # unión a la red de la placa y HTTP contra ella
  types/                # reexportaciones de los tipos de dominio
```

## Arquitectura

**Núcleo sin internet** (ADR 0001, ADR 0006). El modo ómnibus corre entero en la placa desde el
2026-09-15 (#88): vigila con la cámara, detecta el ómnibus y su cartel, lee con OCR y manda la lectura
por BLE; la app la anuncia si la salida elegida es el teléfono. El enlace y los avisos de sistema
tampoco dependen de la red. El analizador estático impide que `features/recognition` y
`features/audio` importen `services/vision`, `cloud`, `telemetry` o `evidence` (`eslint.config.js`).

**Modo supermercado en la nube** (ADR 0006, ADR 0008). Con dos clicks el dispositivo saca la foto, la
app la baja por WiFi y la manda al modelo de visión elegido en Ajustes a través del proxy de
Supabase. Sin internet o sin modelo, la app lo dice y no lee.

**Capa de cuenta archivada** (ADR 0002). La autenticación es por email y contraseña de Supabase (sin
Google ni OAuth), pero **el login no está montado**: `AuthProvider` no figura en `_layout.tsx` y la
app abre directo en las pestañas. El código se conserva para una eventual sincronización opcional.

## Estado (al 2026-10-22)

- **Tres pestañas**: Inicio (modos, botón «Leer», resultado y foto; en modo ómnibus, las fotos de cada
  ómnibus con el recorte exacto que leyó el OCR, #118), Dispositivo (conexión, nombre y batería en
  texto, #110) y Ajustes (modelo de supermercado, salida de audio, qué reconoce y «Probar audio»).
- **Enlace real**: BLE desde el 2026-09-04, conexión y reconexión automáticas, unión sola a la WiFi
  de la placa. Las operaciones GATT van en cola, una por vez (#94, `services/ble/serialize.ts`).
- **Salida de audio elegible**, teléfono o dispositivo, para todo lo que suena (#83, #89, #90). La
  única excepción es el botón «Leer» en modo ómnibus: ese OCR corre en el teléfono, se dice siempre
  en el teléfono y, si la síntesis está habilitada, manda además una copia a la placa. El
  teléfono es siempre el respaldo y hay **una voz por vez** (#97). Los avisos de sistema son clips
  pregrabados en la placa.
- **Un solo tema, el oscuro** (ADR 0010).
- **Los errores van a la telemetría, nunca al usuario** (ADR 0011): la persona escucha una frase fija
  de `i18n/es.ts` que dice qué hacer.
- **Pruebas**: 332 tests en 36 suites (`npx jest`, al 2026-10-22).

## Publicación

Los PRs van a `staging` (rama por defecto): cada merge publica al grupo interno de TestFlight y deja
un `.apk` como artefacto (`android-apk.yml`). `main` es producción y sólo recibe PRs
`staging → main`: publica al grupo externo de TestFlight, con enlace público. Google Play está
apagado (`PLAY_ENABLED`). Detalle en [`docs/ci-cd.md`](../docs/ci-cd.md).

## Estrategia de accesibilidad

Siguiendo a Mascetti et al. (2020), los frameworks multiplataforma exponen sólo un subconjunto de la
accesibilidad nativa. Por eso la app: (1) prefiere **componentes estándar** de RN bien anotados con
`accessibilityLabel`, `accessibilityRole` y `accessibilityHint`; (2) evita la interfaz muy
personalizada (la barra de pestañas es la nativa); (3) trata la **prueba real con VoiceOver y
TalkBack** y la **prueba de usabilidad con personas ciegas** como pasos obligatorios, no como
supuestos. Ver `.claude/skills/virovision/references/app.md` y `references/convenciones.md`.
