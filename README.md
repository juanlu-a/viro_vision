# ViroVision

**ViroVision** es un sistema de asistencia para personas **ciegas o con baja visión** que identifica
**líneas de ómnibus metropolitanas** y **alimentos en la góndola del supermercado** y devuelve
**retroalimentación auditiva en tiempo real**. Un dispositivo con cámara, montado en la patilla de
unos lentes, capta el entorno; una aplicación móvil emparejada se encarga de la conectividad, el
apoyo al procesamiento y la interacción.

Proyecto de fin de carrera de Ingeniería en Telemática, Facultad de Ingeniería, Montevideo,
Uruguay, 2026. Autores: Juan Lucas Abreu, Magalí Dellapiazza y Francisco Tauber. Director: Ing. MSc.
Sebastián García Parra.

## Los dos casos de uso

1. **Líneas de ómnibus**: reconocer la línea de un ómnibus que se acerca y anunciarla, una sola vez
   por ómnibus. Corre entero en el dispositivo, sin internet: detector en el sensor de la cámara,
   zoom digital sobre el cartel, OCR en la placa y cruce con el catálogo de líneas del STM.
2. **Productos de supermercado**: identificar alimentos y anunciarlos, con un modelo de visión en la
   nube a través de un proxy propio. La canasta básica fue el alcance mientras no se conocía la
   precisión; medido en el dispositivo real (2026-09-11), el modelo identifica cualquier alimento, y
   la canasta queda como **conjunto de evaluación**, no como límite.

## Estructura del monorepo

| Ruta | Pilar | Qué hay |
|------|--------|-------------|
| [`app/`](app/README.md) | **Aplicación móvil** | React Native (Expo): enlace BLE con el dispositivo, salida de audio elegible, interfaz pensada primero para lectores de pantalla. |
| [`hardware/`](hardware/README.md) | **Hardware / IoT** | Raspberry Pi Zero 2 W + AI Camera (IMX500) + Waveshare UPS HAT (C); el daemon de la placa y la carcasa VIA Clara (OpenSCAD). |
| [`ml/`](ml/README.md) | **ML / OCR / CV** | Puntero al pipeline de ómnibus (YOLO11n en el sensor, OCR PP-OCRv5, catálogo), que vive en el repositorio `bus-banner-recognizer`. |
| [`supabase/`](supabase/) | **Nube** | Funciones `vision` (proxy de claves), `telemetry` y `evidence`. |
| [`docs/`](docs/README.md) | **Documentación** | Tesis, arquitectura, ADRs, mediciones y guías de operación. |

El contexto completo para los asistentes de programación vive en la skill `virovision`:
`.claude/skills/virovision/`. El estado vigente, en [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md).

## Inicio rápido (app)

```bash
cd app
npm install
npx expo start          # el TTS anda en Expo Go; BLE necesita un dev client (npx expo run:ios / run:android)
```

La guía completa está en [`app/README.md`](app/README.md); la de la placa, en
[`hardware/raspi/README.md`](hardware/raspi/README.md).

## Estado (2026-10-22)

- Los dos modos funcionan de punta a punta con el dispositivo real, disparados por su botón.
- La app se distribuye por TestFlight (interno desde `staging`, público desde `main`) y como `.apk`.
- Pendiente: la prueba del modo ómnibus en la calle, las métricas del detector reentrenado, la
  carcasa definitiva y las pruebas con usuarios. Detalle en [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Restricciones y principios

- **La accesibilidad es un requisito duro** (VoiceOver, TalkBack y pruebas de uso con personas
  ciegas).
- **Offline-first.** Las funciones esenciales (detección, OCR y audio) funcionan **sin internet**.
  Desde la enmienda del ADR 0001 (2026-08-10) la nube se admite como *acelerador opcional*, nunca
  como único camino; el modo supermercado es la excepción declarada, con el respaldo local abierto.
- **Bajo costo y portátil**, adaptado al contexto uruguayo.
- **Los errores no se le dicen al usuario** (ADR 0011): van a la telemetría.

## Calendario

El desarrollo apunta a **mediados de noviembre de 2026**; la fecha límite es el **30 de noviembre
de 2026**.
