# Pilar: aplicación móvil (React Native)

## Rol en el sistema
La app es la superficie de control y configuración del usuario, el puente a la nube del modo
supermercado y una de las dos salidas de voz. **No reconoce ómnibus**: desde el 2026-09-15 (#88) el
modo ómnibus corre entero en la placa. El modo lo decide el **botón físico** del dispositivo
(ADR 0007); la app lo refleja, lo anuncia y ofrece los mismos gestos en Inicio como versión de
desarrollo del botón.

La salida de audio es **elegible**: teléfono o dispositivo, para todo lo que suena (lecturas,
avisos de sistema, «Probar audio»; #83, #89, #90). En el dispositivo, el audio sale hoy por PWM
(`audremap`, pines 32/34, provisional) hacia un transductor de conducción ósea de 14 mm en la
carcasa; no hay DAC I2S. Separar canales también es una decisión de accesibilidad: el lector de
pantalla del sistema sigue en el teléfono y ViroVision puede hablar por el dispositivo.

## Offline-first (requisito duro)
Lo esencial funciona **sin internet** (ADR 0001, enmendado el 2026-08-10: la nube se permite como
acelerador opcional). El reparto por caso de uso es el del ADR 0006:

- **Ómnibus: en la placa, sin red.** Detector YOLO11n de dos clases (`bus`, `bus_sign`) dentro del
  sensor IMX500, OCR PP-OCRv5 (ONNX, `rapidocr`) en la Pi, catálogo STM, y la lectura llega a la app
  por BLE (`ReaderBridge`, `onRecognition`). Es vigilancia, no foto: anuncia presencia y línea una vez
  por ómnibus. La app conserva un OCR local (`services/ondevice/`, ExecuTorch, ~250 MB) que sólo usa
  el botón «Leer» de Inicio en modo ómnibus, sobre la foto entera del dispositivo.
- **Supermercado: en la nube.** El dispositivo saca la foto, la app la baja por WiFi y la manda al
  modelo de visión elegido en Ajustes a través del proxy de Supabase (ADR 0008). Sin internet o sin
  modelo **lo dice y no lee**: excepción explícita y acotada a este modo (ADR 0006, actualización
  2026-08-30). El respaldo local sigue pendiente.

`app/src/services/vision/` es el camino de producto del modo supermercado. El analizador estático
(`app/eslint.config.js`) prohíbe que `features/recognition` y `features/audio` importen
`services/vision`, `cloud`, `telemetry` o `evidence`. Desde el 2026-08-30 la app trae **un solo
runtime nativo de inferencia** (ExecuTorch, sólo OCR); el laboratorio del spike de visión local quedó
en la rama `spike/laboratorio-vision-local`.

## Herramientas
- **React Native con Expo** y **dev client propio** (BLE, WiFi y ExecuTorch no corren en Expo Go),
  TypeScript, **Nueva Arquitectura** (JSI, bridgeless). Expo SDK 57, RN 0.86, React 19.
- **Expo Router** con la barra de pestañas **nativa** (`NativeTabs`: Liquid Glass en iOS 26,
  Material en Android).

## Por qué React Native (de la tesis)
Elegido frente a Flutter y a nativo puro por cuatro criterios:
1. **Accesibilidad heredada**: dibuja componentes nativos reales, así que hereda buena parte del
   comportamiento de VoiceOver y TalkBack en lugar de reconstruirlo sobre un canvas (Flutter).
2. **Velocidad del equipo**: el equipo ya conoce JavaScript y React; ni Dart ni dos bases nativas.
3. **Ecosistema maduro para hardware**: `react-native-ble-plx` implementa el perfil GATT que se
   necesita para hablar con el dispositivo.
4. **Probado en producción a escala** (Meta/Instagram, Microsoft, Shopify).

## Nueva Arquitectura (JSI, bridgeless)
Desde 2024 RN reemplaza el «bridge» asíncrono de JSON por **JSI**: JavaScript llama métodos nativos
directo en memoria compartida, sin serializar. La menor latencia importa: la app reacciona casi en
tiempo real a las lecturas y maneja la respuesta auditiva.

## API de accesibilidad: el centro de la app
Se anotan componentes estándar con:
- `accessible`: marca un elemento (y sus hijos) como un único nodo accesible.
- `accessibilityLabel`: lo que anuncia el lector de pantalla (independiente del texto visible).
- `accessibilityRole`: la función del elemento (botón, imagen, encabezado), mapeada a
  `UIAccessibilityTraits` en iOS y a los roles de Android.
- `accessibilityHint`: pista sobre qué hace la interacción.

### La advertencia de Mascetti et al. (2020): guía toda la estrategia
«Developing Accessible Mobile Applications with Cross-Platform Development Frameworks» (ACM ASSETS
2020, arXiv:2005.06875): los frameworks multiplataforma exponen sólo un **subconjunto** de la
accesibilidad nativa; la paridad completa suele pedir **módulos nativos por plataforma**.
Consecuencias para ViroVision:
- **Preferir componentes estándar** de RN bien anotados: heredan el comportamiento esperado.
- **Evitar o minimizar la interfaz muy personalizada** (gráficos dibujados a mano, gestos no
  estándar); si es inevitable, un módulo nativo puntual.
- **Prueba formal con VoiceOver y TalkBack reales** como hito obligatorio, no como supuesto.
- **Complementar con pruebas de usabilidad** con personas ciegas o con baja visión: una API correcta
  es necesaria pero no suficiente.

## Enlace con el dispositivo (ADR 0003)
1. **Control por BLE (GATT), siempre vivo:** `react-native-ble-plx`, cliente real en
   `services/ble/bleClientPlx.ts` detrás del selector de `bleClient.ts` (stub tipado sólo donde no
   hay módulo nativo). Modo, gestos del botón, lecturas de ómnibus, avisos, batería, credenciales del
   AP. **Las operaciones GATT van en cola, una por vez, en el orden pedido** (#94,
   `services/ble/serialize.ts`): una escritura sin `await` le ganaba a la lectura de `wifi` y la app
   no podía unirse a la red de la placa.
2. **La foto (supermercado) va por WiFi:** la placa levanta un AP y sirve la foto por HTTP; la app se
   une sola con las credenciales que recibe por BLE (`services/wifi/`). La medición del 2026-09-05
   cerró el transporte.
3. **Audio:** la lectura de supermercado que va al dispositivo se sintetiza en la nube y se manda por
   WiFi (`services/audio/synthesis.ts`); ómnibus y los avisos de sistema son **clips pregrabados en
   la placa**, que se piden por BLE y no necesitan red.

### Sesión de audio y segundo plano (2026-09-11)
**Hay una sesión de audio explícita**: `services/audio/session.ts` (política aparte en
`audioMode.ts`, para afirmarla en un test sin dispositivo). Tres cosas que **no** se tocan sin leer
el ADR 0003:

- **`interruptionMode: 'mixWithOthers'`**, aunque la documentación de Expo recomiende `doNotMix` para
  audio en segundo plano. **VoiceOver es la interfaz de este usuario**: `doNotMix` lo interrumpe y
  `duckOthers` lo baja a mitad de frase. Verificado en el teléfono.
- **`shouldPlayInBackground` y un tono inaudible sostenido mientras dura la lectura.** iOS da unos
  pocos segundos al despertar por BLE; audio realmente sonando es lo que mantiene vivo el proceso.
- **`allowsRecording: false`**, que en iOS deja la sesión en `.playback` y no en `.playAndRecord`.
  La app no graba nada, y los permisos de micrófono se sacaron a mano del default del plugin de
  `expo-audio`.

**El pipeline de lectura no vive en un hook**: `features/reader/readingService.ts` es un módulo sin
React y `ReaderBridge` lo suscribe directo al cliente BLE, por encima del navegador. Es a propósito:
con el disparo del botón viajando por estado de React y servido por Inicio, el botón no hacía nada
con el teléfono bloqueado, que es el caso de uso entero. `useReader` es un `useSyncExternalStore`
sobre ese módulo.

### Dónde se escucha (Ajustes, 2026-09-11, ampliado el 2026-09-15 y el 2026-09-16)
El usuario elige teléfono o dispositivo en Ajustes (`features/audio/audioOutput.ts`,
`AudioOutputSelector`), y la elección vale para **todo lo que suena**: la lectura de supermercado,
la de ómnibus (#89), los avisos de sistema y «Probar audio» (#90).

Reglas que no se deducen del código:

1. **El envío a la placa se espera DENTRO de la sesión de audio.** Con la pantalla bloqueada iOS sólo
   deja correr a la app mientras el tono suena: fuera de esa ventana, el POST lo haría un proceso
   suspendido. El test fija **el orden**, no el resultado: `['begin', 'earcon', 'send', 'end']`.
2. **El teléfono es siempre el respaldo.** Todo camino que falle termina con el teléfono hablando; el
   motivo se **registra** (`audio.fallback`) y no se anuncia. El silencio es el único resultado
   prohibido. Las condiciones se chequean **antes** de sintetizar, porque la síntesis se paga.
3. **Lecturas y avisos tienen dos políticas puras distintas**: un aviso es un clip pregrabado y sólo
   necesita el enlace BLE, no WiFi ni nube. Y **el dispositivo no informa sus propias fallas** (#91):
   una queja de la placa no se devuelve a la placa.
4. **Una voz por vez** (#97, ADR 0003 act. 2026-09-18): quien empieza a hablar calla al otro. El
   teléfono manda `{"cmd":"hush"}` a la placa antes de hablar y llama a `stopSpeaking()` antes de
   mandarle un aviso.

Las políticas son puras y viven sin el módulo nativo (mismo criterio que `audioMode.ts`):
`readingService.ts` las importa, y su suite no necesita un mock de AsyncStorage para verificar una
decisión que no toca el disco.

### La frase de ómnibus (#104)
`features/recognition/format.ts` dice la línea **con su destino** cuando llegó, porque el destino es
lo que distingue dos ómnibus de la misma línea. Sin número dice el destino solo; sin nada dice «se
acerca un ómnibus»: un anuncio vacío es el único resultado que una interfaz de voz no puede tener.

## Errores (ADR 0011, 2026-10-06)
**El texto de un error nunca llega a la pantalla ni a la voz.** Se registra en la telemetría
(`events` en Supabase, `services/telemetry/`) y la persona escucha una frase fija de `i18n/es.ts`
que dice qué hacer. Un `ErrorBoundary` raíz (`app/_layout.tsx`) registra los errores de dibujo y
ofrece volver a empezar.

## Auth y backend (capa de cuenta): ARCHIVADA, la app NO tiene login
Decisión del 2026-07-20 (equipo y tutor): **la app se publica sin login** y abre directo en las
pestañas. El núcleo no necesita cuenta, y Apple no exige login. El código de auth por email de
Supabase (`features/auth/AuthContext.tsx`, `services/supabase/*`) está **archivado, no borrado**:
presente en el repo pero **sin montar** (`AuthProvider` no figura en `app/_layout.tsx`). Si el login
vuelve, es **email y contraseña** de Supabase (nunca Google ni OAuth). Ver ADR 0002. Supabase sí se
usa como infraestructura, sin cuentas: proxy de visión, telemetría y evidencia.

## Estado (2026-10-22)

- **Tres pestañas nativas**: Inicio, Dispositivo, Ajustes. No hay rutas sueltas de desarrollo.
  - **Inicio**: modo actual en texto, los dos botones de modo (mutan, no se reemplazan), «Leer»,
    resultado campo por campo y la foto del dispositivo. En modo ómnibus, las fotos de cada ómnibus
    (#118, `features/device/BusShots.tsx`): el cuadro donde se detectó y cada recorte del cartel con
    lo que leyó el OCR, que es exactamente el recorte que leyó, margen incluido. Temporal, de
    desarrollo, se va con `services/evidence/`.
  - **Dispositivo**: estado de la conexión, nombre y **batería en texto** (#110,
    `DeviceSummary.tsx`; aviso explícito bajo 20 %), leída del INA219 de la UPS HAT.
  - **Ajustes**: modelo de supermercado, salida de audio, qué reconoce el sistema y «Probar audio».
- **Design system con tokens verificados por tests.** `constants/theme.ts` y `theme.test.ts`
  comprueban contraste WCAG. Identidad según el manual de marca (skill `virovision-marca`),
  tipografías embebidas en el binario.
- **Un solo tema, el oscuro** (ADR 0010, 2026-09-14). La paleta clara sigue en `colors.js`,
  verificada, sin que nadie la renderice.
- **Enlace real** (BLE y WiFi) y salida de audio elegible, descritos arriba.
- **Telemetría** en `events` y **evidencia** del modo ómnibus en el bucket privado `evidence`
  (#114, `docs/supabase.md`).
- **Publicación**: PRs a `staging` (TestFlight interno y `.apk` por `android-apk.yml`); `main` es
  producción (TestFlight externo con enlace público). Google Play apagado (`PLAY_ENABLED`).
- **332 tests en 36 suites**, tsc y lint en verde (`npx jest`, al 2026-10-22).
