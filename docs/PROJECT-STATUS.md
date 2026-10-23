# ViroVision: estado del proyecto y traspaso entre sesiones

_Documento vivo del estado vigente. Última actualización: 2026-10-22._

Resume dónde está el proyecto para que cualquiera (una persona nueva o una sesión nueva con la skill
`virovision`) pueda continuar. Describe el presente; la historia, con el porqué de cada cambio, vive
en [`SESSION-LOG.md`](SESSION-LOG.md), y el plan en [`ROADMAP.md`](ROADMAP.md).

---

## Estado de las ramas

- `staging` es la rama por defecto y de integración: cada PR va ahí, y cada merge publica al grupo
  interno de TestFlight y deja un `.apk` como artefacto. `main` es producción y sólo recibe PRs
  `staging → main` (= release), que publican al link público de TestFlight. El último release a
  producción fue el PR #115 (2026-10-13).
- Ramas con trabajo real fuera de `staging`:
  - `feat/case-v0-10-slim`: la carcasa v0.10 a v0.12. No está pusheada y la v0.12 todavía no está
    commiteada; vive en el worktree `viro_vision-case`.
  - `feat/volume-button`: un segundo botón de volumen, con un "ADR 0010" que choca con el 0010 vigente
    (tema oscuro); habría que renumerarlo.
  - `feat/carcasa-modelo-3d`: la carcasa v1, reemplazada por VIA Clara; se puede archivar.
- El pipeline de ómnibus vive en el repo de Magalí, `bus-banner-recognizer`, entero en un solo PR (#7,
  rama `feat/bus-line-reader`). La placa se instala desde un checkout de esa rama.

## Qué es ViroVision

Proyecto de fin de carrera (Ingeniería en Telemática, Facultad de Ingeniería, Montevideo, 2026; Juan
Lucas Abreu, Magalí Dellapiazza y Francisco Tauber). Un sistema de asistencia para personas ciegas o
con baja visión que identifica **líneas de ómnibus metropolitanas** y **alimentos en la góndola**
(alcance ampliado el 2026-09-11; la canasta básica queda como conjunto de evaluación) y da
**retroalimentación auditiva en tiempo real**, con un dispositivo con cámara en la patilla de unos
lentes y una aplicación móvil emparejada. El desarrollo apunta a mediados de noviembre de 2026; la
fecha límite es el **30 de noviembre de 2026**.

## Estructura del repositorio

```
app/          aplicación React Native (Expo)
hardware/     Raspberry Pi Zero 2 W + AI Camera (IMX500) + Waveshare UPS HAT (C)
  raspi/        daemon Python: periférico BLE, cámara, modos, ómnibus, AP, batería (ADR 0003)
  raspi/boot/   scripts de arranque de la microSD
  case-via-clara/  carcasa en OpenSCAD (v0.9 en staging)
ml/           sólo un README: el pipeline de ómnibus vive en bus-banner-recognizer
supabase/     funciones vision (proxy de claves), telemetry y evidence
docs/         tesis, arquitectura, ADRs, mediciones, guías de QA y operación
docs/tesis/   capítulos del informe (fuente de verdad del texto)
.claude/skills/virovision/   la base de conocimiento del proyecto
```

## Decisiones vigentes (ADRs en `docs/architecture/adr/`)

- **0001 Offline-first** (enmendado 2026-08-10): lo esencial funciona sin internet; la nube se admite
  como acelerador opcional, nunca como único camino.
- **0002 Supabase** (actualizado): la app se publica **sin login**; el código de autenticación por
  email queda archivado.
- **0003 Enlace placa ↔ teléfono**: BLE siempre vivo como plano de control, la foto por el AP WiFi de
  la placa (medido: BLE 4,5 s contra WiFi 0,3 s). Actualizado el 2026-10-22 con el hardware real, el
  audio PWM y el arranque en 16 s.
- **0004 Runtime on-device**: superado por el 0006.
- **0006 Pipelines por caso de uso**:
  - Ómnibus corre entero en la placa: detector YOLO11n de dos clases dentro del sensor IMX500,
    reentrenado en la V100 con ~500 fotos, zoom digital, recorte con márgenes 18/6/6, OCR PP-OCRv5
    por ONNX y catálogo del STM.
  - Supermercado usa un LLM con visión en la nube: `gpt-5.6-luna` por defecto y `qwen/qwen3.8-27b`
    en Groq.
- **0007 Botón y modos**: 1 click ómnibus, 2 clicks supermercado (y otra lectura si ya está en
  supermercado), click largo a reposo. En ómnibus, un click repite el último anuncio.
- **0008 Proxy propio** para las claves de nube (Supabase Edge Function).
- **0009** código en inglés, documentación en español. **0010** un solo tema, oscuro.
  **0011** los errores van a la telemetría, nunca al usuario.

## Stack de la app

Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript 6 · New Architecture · Expo Router.
Dependencias clave: `react-native-ble-plx`, `expo-speech`, `expo-audio`, `@supabase/supabase-js`,
`@react-native-async-storage/async-storage`; tests con `jest-expo`.

## Estado por pilar

### Aplicación (`app/`)

- **Pantallas**: pestañas Inicio, Dispositivo y Ajustes, sin login y sólo en modo oscuro.
  - Inicio muestra el modo y la última lectura, con la foto del supermercado o las del ómnibus.
  - Dispositivo tiene la única línea de estado y la batería de la placa.
  - Ajustes tiene el modelo, dónde se escucha y qué reconoce.
- **Enlace**: cliente BLE real con cola de operaciones GATT (#94). La foto baja por el AP de la
  placa (`GET /photos/latest`). La reconexión es rápida y no pide permiso de nuevo.
- **Audio**: el usuario elige la salida, teléfono o dispositivo, y vale para todo lo que suena; el
  teléfono es siempre el respaldo. Una sola voz por vez (#97). Funciona con la pantalla bloqueada.
- **Lectura**: supermercado va a la nube por el proxy; ómnibus llega ya leído desde la placa, con la
  frase que incluye el destino (#104).
- **Telemetría**: el único destino de los errores (ADR 0011), con los logs de la placa reenviados por
  BLE.
- **Evidencia del ómnibus**: Inicio muestra exactamente el recorte que leyó el OCR, margen incluido
  (#118). Es temporal y se saca antes de la entrega.
- **Pruebas**: 332 tests en 36 suites (2026-10-22).

### Placa y daemon (`hardware/raspi/`)

- **Hardware**: Raspberry Pi Zero 2 W (en uso otra vez desde el 2026-09-19; sin Ethernet, WiFi sólo
  de 2,4 GHz), AI Camera (IMX500), Waveshare UPS HAT (C) con LiPo, y un botón en GPIO 5.
- **Entrada a la placa**: con `tools/ap.py` por BLE o con el archivo `SIN-AP` en la microSD. Guía en
  la skill, `references/placa-acceso.md`.
- **Daemon**:
  - periférico BLE; AP WiFi siempre prendido; servidor HTTP con cinco rutas;
  - anuncios pregrabados y avisos de sistema; batería por el INA219 (2026-10-06);
  - vigilante de la cámara; journal persistente (2026-09-23).
- **Arranque**: la placa anuncia a los 16,2 s, la cámara está lista a los 21,3 s y el OCR a los
  33,6 s (2026-10-06).
- **Audio en la placa**: PWM por `audremap`, provisional.
- **Pruebas**: 195 tests pasan y 2 se omiten (2026-10-22).

### Visión (`bus-banner-recognizer` y la placa)

- **Modo ómnibus** en vigilancia: la cámara queda abierta y anuncia la presencia y la línea una sola
  vez por ómnibus. Corre en la Zero 2 W desde el 2026-09-22: 1,6 s del primer avistaje a la línea
  dicha.
- **Evaluación sobre 117 imágenes** (2026-10-12):

  | Detector | Número | Destino | Lectura completa |
  |---|---|---|---|
  | Dos etapas | 91,7 % | 89,3 % | 91,7 % |
  | Dos clases (el que corre en el sensor) | 91,7 % | 85,7 % | 87,5 % |

- **Catálogo** (2026-10-06/07): sólo se anuncia lo que el catálogo conoce, y el catálogo completa la
  mitad del cartel que el OCR no leyó.
- **Zoom digital** (#121): hasta 2x sobre el cartel. Probado en la placa contra video el 2026-10-22:
  un cartel de ~10 px de alto se anunció a los 7,6 s. `--bus-full-res` traba la cámara de la Zero.
- **Márgenes del cartel**: `SIGN_MARGINS = (0.18, 0.06, 0.06)` (#122, 2026-10-22). Se probó el box tal
  cual el 2026-10-21 y en las pruebas del equipo se seguía perdiendo a veces el "1" del número de línea
  (reporte del 2026-10-22).
  - Causa: el detector es de cajas, el box se ajusta a los LEDs y el número está a la izquierda, así
    que el borde del recorte cae sobre el trazo fino del "1". No es un problema de keypoints.
  - Con zoom, una lectura se descarta si el margen cae fuera del recorte.
- **Reentrenamiento en la V100** con ~500 fotos: hecho. Faltan épocas, métricas y la ubicación de los
  pesos.
- **Supermercado**: funciona de punta a punta contra el proxy desde el 2026-09-02. El respaldo local
  sigue abierto.

### Carcasa (`hardware/case-via-clara/`)

- **Modelo**: VIA Clara, paramétrica en OpenSCAD.
  - Dos mitades a presión con ocho trabas, una corredera para la llave y un brazo para el
    transductor óseo de 14 mm.
  - Un solo botón: un pulsador SMD de 4×4×1 mm con tecla pegada.
- **En `staging`**: la v0.9. Las impresiones de prueba se evaluaron así: la v0.9 el
  2026-10-17, la v0.10 el 2026-10-21 (falló) y la v0.11 el 2026-10-22. Detalle en la tesis, §7.3.5.
- **Vigente: v0.12** (rama `feat/case-v0-10-slim`, sin commitear):
  - cuerpo de 85,8 × 28,5 × 37,2 mm;
  - se descarta la variante con tapa;
  - trabas delanteras detrás de las guías de la cámara;
  - alojamientos redondos para los separadores, que ya no se termofunden;
  - piezas de prueba para validar sin imprimir la carcasa entera.
- **Verificación**: `export.sh` corre 18 verificaciones de interferencia contra maquetas.
- **Pendiente**: medir lo marcado `MEASURE` con calibre e imprimir las pruebas de la v0.12. Los STL
  van al Drive (`Tesis: ViroVision / modelo_3d`), no al repo.

### Nube (`supabase/`)

Proyecto `viro_vision`. Tres funciones desplegadas y activas: `vision` (proxy de claves, desde el
2026-09-02), `telemetry` (tabla `events`, desde el 2026-09-09) y `evidence` (bucket privado, desde el
2026-10-12). Los builds no llevan ninguna clave de proveedor. Riesgo vigente: el plan gratuito pausa
el proyecto por inactividad.

### CI/CD (`.github/workflows/`)

- `ci.yml`: lint, typecheck, tests y bundle en los PRs a `main` y `staging`.
- `testflight.yml`: publica en TestFlight, al grupo interno desde `staging` y al externo desde `main`.
- `android-apk.yml`: genera un `.apk` de sideload desde `staging`.
- `android-play.yml`: subida a Google Play, apagada con `PLAY_ENABLED`.
- `eas-update.yml` y `eas-build-ios.yml`: opcionales, detrás de `EAS_ENABLED`.

Detalle en [`ci-cd.md`](ci-cd.md).

### Tesis (`docs/tesis/`)

Capítulos 1 a 8, 11 y 12 escritos y al día al 2026-10-22. Faltan los capítulos 9 (conclusiones) y
10 (trabajo futuro), y los `PENDIENTE` declarados en el resto: métricas de la V100, prueba en la
calle y pruebas con usuarios.

## Pendientes de cuentas y configuración (sólo los puede hacer el equipo)

1. **Supabase**: rotar el JWT secret y apagar el signup por email, que no se usa.
2. **Google Play**: falta la cuenta de Play Console, crear la app, la service account y la primera
   subida manual ([`android-play.md`](android-play.md)).
3. **EAS** (opcional): `eas login && eas init && eas update:configure`, más `EXPO_TOKEN` y
   `EAS_ENABLED=true` en el repo.
4. **Roboflow**: rotar la API key que quedó en la historia de un notebook del repo de visión.

## Próximos pasos

En orden de prioridad, ver [`ROADMAP.md`](ROADMAP.md):

1. Probar el modo ómnibus en la calle, con y sin zoom.
2. Documentar las métricas del detector reentrenado.
3. Medir e imprimir la carcasa v0.12, e integrar su rama.
4. Cerrar el audio de la placa.
5. Hacer las pruebas con usuarios y la corrida de evaluación del supermercado.
6. Antes de la entrega, sacar la evidencia del ómnibus.

## Cómo continuar en una sesión nueva

1. Cargar la skill `virovision` (es obligatorio, lo dice el `CLAUDE.md` de la raíz).
2. Leer este archivo y las últimas entradas de [`SESSION-LOG.md`](SESSION-LOG.md).
3. Crear una feature branch desde `origin/staging` al día antes del primer edit.
