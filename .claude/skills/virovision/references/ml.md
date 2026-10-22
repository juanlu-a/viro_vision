# Pilar: ML / OCR / visión por computadora

## Tareas
1. **Detección**: ubicar ómnibus (y su cartel) en el cuadro, con cajas, varias instancias por imagen.
2. **OCR**: leer número y destino del cartel de LEDs del ómnibus; (opcional) texto de etiquetas.
3. **Priorización**: con varios ómnibus, decidir cuál anunciar (posición, proximidad) sin saturar el
   audio.
4. **Supermercado**: identificar el alimento que tiene delante la cámara.

## Dónde vive el código
- **Ómnibus**: repo de Magalí Dellapiazza `bus-banner-recognizer`, **todo en un PR (#7, rama
  `feat/bus-line-reader`)**, desde el 2026-10-12. No apilar PRs ahí. Worktree local de consulta:
  `/Users/juanlu/Documents/repositorios/bus-banner-consolidated`. Se instala en la placa como wheel
  (`scripts/deploy_pi.sh`, que además estampa la rama y el commit en `~/models/bus-banner-version`).
  El cableado en la placa (cámara, zoom, márgenes, parlante, BLE) vive en ViroVision:
  `hardware/raspi/virovision/bus.py` y `zoom.py`.
- **Supermercado**: la app, `app/src/services/vision/` (modelos en `config.ts`, prompt en
  `providers/prompts.ts`), a través del proxy de Supabase (`supabase/functions/vision`, ADR 0008).
- `ml/` es sólo un README que apunta a lo anterior.

## Ómnibus: el pipeline real (ADR 0006, enmendado 2026-09-07)

Corre **entero en la placa** (Raspberry Pi Zero 2 W + Raspberry Pi AI Camera, IMX500) desde el
2026-09-15 (#88), sin teléfono y sin red. **Es vigilancia, no foto**: la cámara queda abierta, el
detector corre en cada frame, y se anuncia la presencia ("se acerca un ómnibus") y la línea **una vez
por ómnibus**.

1. **Detector**: YOLO11n de **cajas** (no de keypoints) con dos clases, `bus_sign` y `bus`, int8,
   **dentro del sensor IMX500** (una sola red cabe: ocupa el 90 % de sus 8 MB). Export
   `ultralytics format="imx"`; el `.rpk` se arma en la Pi; la placa carga `~/models/bus_sign.rpk`
   (`bus.py:38`). El Coral TPU **salió del diseño el 2026-09-07**.
   - Primer fine-tune: ~140 fotos (Roboflow `find-bus-sign` + cajas `bus` pseudo-etiquetadas), 40
     épocas, en CPU, 2026-09-15 (`models/bus_2classes_yolo11n.pt`, commit `8b8a569` del PR #7).
   - **Reentrenado en la V100 de Arnaldo Castro con unas 500 fotos** (SESSION-LOG 2026-10-21). Épocas,
     métricas y ubicación de los pesos: **PENDIENTE** (no constan en ningún repo).
2. **Zoom digital** (ADR 0006, actualización 2026-10-19; #121): `ScalerCrop` del ISP, dinámico,
   centrado en el cartel más grande entre los alargados (`widest_sign`: área máxima con relación de aspecto ≥ 2), hasta ~64 px de alto de cartel, como mucho la mitad del ancho del
   frame; se sostiene 1,5 s y vuelve a 1x. Máximo práctico 2x en la Zero 2 W (modo agrupado);
   `--bus-full-res` (4x) no entra: 10 fps, 65 MB libres, cámara trabada (2026-10-22). El detector
   sigue viendo el campo completo (`set_inference_roi_abs` es otro control). `--no-bus-zoom` lo apaga.
   Campaña: `docs/mediciones/2026-10-22-zoom-omnibus.md`.
3. **Recorte con márgenes**: `SIGN_MARGINS = (0.18, 0.06, 0.06)` (izquierda, derecha, vertical, como
   fracción de la caja; `bus.py:53-61`), pasados explícitamente al `Pipeline`. Por qué: la caja se
   ajusta a los LEDs, el número de línea está a la izquierda y el "1" es un trazo fino que, si el
   borde del recorte cae encima, el OCR pierde ("15" por 115, 2026-09-15). Es el borde del recorte, no
   el modelo. El vertical bajó de 0,12 a 0,06 el 2026-09-16 (72 combinaciones sobre 117 imágenes,
   `scripts/tune_margins.py`). Historia: el 2026-10-21 se probó con márgenes en cero; el "1" se siguió
   perdiendo a veces en las pruebas del equipo y el 2026-10-22 volvieron (#122). Con zoom, una lectura se descarta sin
   descontar el intento si la caja **con márgenes** queda fuera del recorte (`_with_margins`). La app
   muestra exactamente el recorte que leyó el OCR.
4. **OCR**: PP-OCRv5 mobile con el reconocedor `latin`, exportado a ONNX y corrido con `rapidocr` 3.x
   en la CPU de la Pi, en un hilo aparte de la cámara (paddlepaddle no tiene wheel para Python 3.13 en
   ARM64). Ya no CRAFT + CRNN ni ExecuTorch: esos eran del camino por el teléfono.
5. **Lectura y catálogo STM** (`data/catalog_stm.csv`: 504 filas, 145 líneas, 257 destinos):
   - corrige errores del OCR por similitud (`BRALLE` → `BRAILLE`);
   - **sólo se dice lo que el catálogo conoce** (2026-10-06, cont. 5): línea inexistente o destino sin
     coincidencia no se anuncian, para que el TTS no deletree basura;
   - **completa la mitad que el OCR no leyó** si la confianza es menor a 0,8 (2026-10-07,
     `COMPLETE_BELOW`, `Reading.inferred`); lo inferido no vota y nunca pisa dígitos leídos;
   - una lectura que el catálogo confirma en ambos campos se anuncia sola; si no, dos lecturas tienen
     que coincidir.
6. **Anuncio**: `.wav` pregrabados por línea y destino (ADR 0003 §5), en el parlante de la placa.
7. **Evidencia** (#114, 2026-10-12): el modo guarda frames y recortes del OCR, unidos a su fila de
   telemetría (función Edge `evidence`, bucket privado); la app los muestra en Home (#118).

## Supermercado: LLM con visión en la nube (ADR 0006, 2026-08-30)
- Excepción explícita y acotada a ADR 0001: sin red, el modo **lo dice y no lee**. El fallback local
  (un Gemma chico) sigue **PENDIENTE**.
- Modelos (`MODEL_PROFILES` en `app/src/services/vision/config.ts`; ADR 0006, actualización
  2026-09-02): **`gpt-5.6-luna` por defecto** (mediana 1668 ms) y **`qwen/qwen3.8-27b` en Groq** (846
  ms, cuota de ~4 lecturas por minuto). Gemini salió del selector; los retirados viven en
  `RETIRED_PROFILES`.
- Las claves viven en el proxy de Supabase (ADR 0008); paga el proyecto, gratis para el usuario.
- Alcance: **alimentos y productos de almacén** (2026-09-11). La canasta básica es el dataset de
  evaluación, no el límite de lo que se contesta.
- La foto la saca la placa y baja por WiFi (ADR 0003, 2026-09-05/08).

## Lo que quedó atrás
- **Coral TPU** como preprocesadora y "no hay que entrenar": superados el 2026-09-07.
- **LiteRT-LM / Gemma vía LiteRT-LM** (ADR 0004): dejó de ser el camino primario el 2026-08-22. El
  laboratorio del spike quedó en la rama `spike/laboratorio-vision-local`
  ([`docs/spike-vision-local.md`](../../../../docs/spike-vision-local.md)).
- La rama `feat/bus-banner-pipeline` y los PRs apilados #2 a #6 del repo de Magalí: reemplazados por
  el #7.

## Evaluación
Métricas: **recall, precision, accuracy, F1** (definiciones por caso de uso en
[`docs/pruebas-y-decisiones.md`](../../../../docs/pruebas-y-decisiones.md)). Campañas con método y
datos en `docs/mediciones/`.

- **Ómnibus, 117 imágenes** (`bus-banner evaluate`, 2026-10-12, Mac): número / destino / lectura
  completa = 91,7 / 89,3 / 91,7 % con dos modelos (COCO + cartel); 91,7 / 85,7 / 87,5 % con el modelo
  de dos clases del sensor. Son del primer fine-tune; el reentrenado no se evaluó (**PENDIENTE**). El
  set es de videos de TikTok, no de la cámara de los lentes.
- **Ómnibus en la placa**: 1,27 s del botón a la línea en la Pi 3 B+ prestada (2026-09-15); 1,6 s de
  que el sensor ve el ómnibus a la línea en la Zero 2 W (SESSION-LOG 2026-09-22); con zoom, un cartel
  de ~10 px anunciado a 7,6 s y uno cercano a 1,0 s (2026-10-22).
- **Supermercado**: `docs/mediciones/2026-09-02-modelos-supermercado.md` (latencia; la precisión con
  fotos reales de góndola sigue pendiente).

## Pendiente
- Prueba en la calle con y sin zoom: distancia a la que se anuncia la línea. Si el cuello es el
  detector, fase 2: mover su zona de entrada.
- Épocas, métricas y pesos del reentrenamiento en la V100; evaluarlo sobre las 117 imágenes.
- Dataset de evaluación con fotos del dispositivo (`scripts/watch_imx500.py --save-frames`).
- Reentrenar el reconocedor del OCR (la palanca para el destino con el modelo de dos clases).
- Fallback local del supermercado.
- Rotar la API key de Roboflow que quedó en la historia del repo de Magalí.
- Estado del arte (`PENDIENTE` en la tesis): OCR de carteles de transporte / LED; reconocimiento de
  productos; detección en tiempo real en hardware embebido.
