# ViroVision: ML / OCR / visión por computadora

Esta carpeta es un **puntero**: el código de reconocimiento no vive acá. Cada caso de uso tiene su
propio camino ([ADR 0006](../docs/architecture/adr/0006-pipelines-por-caso-de-uso.md)), y ninguno de
los dos se entrena ni se ejecuta desde `ml/`.

## Ómnibus: repo `bus-banner-recognizer`

El pipeline de ómnibus (detector, recorte, OCR, catálogo, seguimiento, entrenamiento, export y
evaluación) vive en el repo de Magalí Dellapiazza,
[`bus-banner-recognizer`](https://github.com/MagaliDellapiazza02/bus-banner-recognizer), todo en un solo
PR: **#7, rama `feat/bus-line-reader`** (desde el 2026-10-12). Se instala en la placa como dependencia
(una wheel construida por `scripts/deploy_pi.sh` de ese repo), y el daemon `hardware/raspi/` lo importa.

Pipeline real, por frame (README de ese repo, "How it works"):

1. **Detección** del ómnibus y del cartel: un YOLO11n de cajas con dos clases (`bus`, `bus_sign`), int8,
   corriendo **dentro del sensor IMX500** de la Raspberry Pi AI Camera, sin costo de CPU para la Pi. El
   Coral TPU salió del diseño el 2026-09-07. Primer fine-tune: ~140 fotos, 40 épocas, en CPU
   (2026-09-15); reentrenado después en la V100 de Arnaldo Castro con unas 500 fotos (SESSION-LOG
   2026-10-21; épocas y métricas **PENDIENTE**).
2. **Recorte** del cartel con márgenes `SIGN_MARGINS = (0.18, 0.06, 0.06)` (izquierda, derecha,
   vertical), que ViroVision le pasa al pipeline (`hardware/raspi/virovision/bus.py:53-61`). El mayor a
   la izquierda, porque ahí está el número de línea y un recorte justo pierde el "1". Con el **zoom
   digital** del ISP (`hardware/raspi/virovision/zoom.py`, hasta 2x en la Zero 2 W) el cartel llega al
   OCR con más píxeles reales.
3. **OCR**: PP-OCRv5 mobile con el reconocedor `latin`, exportado a ONNX y corrido con `rapidocr` 3.x en
   la CPU de la Pi.
4. **Lectura y catálogo**: el texto se separa en número y destino y se valida contra el catálogo de la
   STM (`data/catalog_stm.csv`, 504 filas, 145 líneas): sólo se dice lo que el catálogo conoce, y con
   confianza menor a 0,8 completa la mitad que el OCR no leyó.
5. **Seguimiento**: el modo es vigilancia, no foto. Anuncia la presencia y la línea **una vez por
   ómnibus**.

Cifras sobre 117 imágenes (2026-10-12, Mac): número / destino / lectura completa = 91,7 / 89,3 /
91,7 % con dos modelos, 91,7 / 85,7 / 87,5 % con el modelo de dos clases del sensor. En la Zero 2 W,
la línea se dijo a 1,6 s de que el sensor vio el ómnibus (SESSION-LOG 2026-09-22). Más campañas en
[`docs/mediciones/`](../docs/mediciones/README.md).

## Supermercado: LLM con visión en la nube

Desde el 2026-08-30 el modo supermercado manda la foto a un LLM con visión en la nube (ADR 0006), a
través del proxy propio del proyecto en Supabase
([ADR 0008](../docs/architecture/adr/0008-proxy-propio-para-claves-de-nube.md)): el build no lleva
ninguna clave de proveedor. Los modelos del selector y su medición viven en
[`app/src/services/vision/config.ts`](../app/src/services/vision/config.ts) (`MODEL_PROFILES`):
`gpt-5.6-luna` por defecto y `qwen/qwen3.8-27b` en Groq como segunda opción. El prompt está en
`app/src/services/vision/providers/prompts.ts`. El alcance son **alimentos y productos de almacén**
(2026-09-11); la canasta básica queda como dataset de evaluación. El fallback local sin red sigue
**PENDIENTE**: hoy, sin red, el modo lo dice y no lee.

## Dónde seguir

- Contexto y decisiones del pilar: `.claude/skills/virovision/references/ml.md`.
- Decisión y su historia: [ADR 0006](../docs/architecture/adr/0006-pipelines-por-caso-de-uso.md).
- Análisis de lo probado: [`docs/pruebas-y-decisiones.md`](../docs/pruebas-y-decisiones.md).
- Datasets, pesos y corridas de entrenamiento: fuera de este repo (en `bus-banner-recognizer`, con LFS
  para los pesos, y el dataset en Roboflow).
