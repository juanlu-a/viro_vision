# 12. Anexo: secciones a incorporar

> El anexo del documento vigente ya contiene el diagrama de Gantt y el desglose de entregables, las
> gráficas y respuestas del formulario de relevamiento, las gráficas de análisis de protocolos y la
> transcripción completa de la entrevista. Este archivo agrega el material nuevo.

## 12.x Manual de marca

`[FIGURA A.1: Símbolo de ViroVision, versiones a color y monocroma.]`

El proyecto cuenta con una identidad visual propia, documentada en un manual de marca que cubre el
símbolo y su construcción geométrica, la paleta de color, la tipografía, las reglas de uso y el
espacio de protección. La paleta se definió atendiendo a las relaciones de contraste exigidas por
WCAG, criterio que se verifica de forma automatizada en la aplicación (§7.8.1).

El manual completo se incluye como documento adjunto.

## 12.x Perfil GATT completo

**Servicio:** `4380c500-7ca3-4e37-b27d-f60e8d8d73d1`
**Nombre anunciado:** `ViroVision`

| Característica | UUID | Propiedades | Formato |
|---|---|---|---|
| `mode` | `4380c501-…` | lectura, notificación, escritura | uint8: 0 espera, 1 ómnibus, 2 supermercado |
| `control` | `4380c502-…` | escritura, escritura sin respuesta | JSON con campo `cmd` |
| `event` | `4380c503-…` | notificación | JSON, máximo 180 bytes |
| `transfer` | `4380c504-…` | notificación | Binario: cabecera de 4 bytes más datos |
| `status` | `4380c505-…` | lectura, notificación | JSON de telemetría |
| `wifi` | `4380c506-…` | lectura | JSON con credenciales del punto de acceso |

**Comandos aceptados por `control`:**

```json
{"cmd": "photo"}
{"cmd": "mode",    "value": 2}
{"cmd": "status"}
{"cmd": "ap",      "value": true, "minutes": 10}
{"cmd": "audio",   "target": "device" | "phone"}
{"cmd": "say",     "clip": "<archivo>.wav"}
{"cmd": "measure", "bytes": 53000, "chunk": 182, "interval_ms": 0}
```

**Eventos emitidos por `event`:**

```json
{"t": "mode",   "value": 1}
{"t": "read",   "mode": 1}
{"t": "ap",     "on": true, "minutes": 10}
{"t": "error",  "msg": "..."}
{"t": "result", "number": "115", "name": "LUIS BRAILLE", "ms": 570}
```

**Constantes del protocolo:** tamaño de fragmento 182 bytes (ATT MTU negociada de 185 en iOS),
tamaño máximo de evento 180 bytes, notificación de estado cada 15 segundos.

**Endpoints HTTP del dispositivo (puerto 8080):**

| Ruta | Función |
|---|---|
| `GET /health` | Devuelve el mismo objeto que la característica `status` |
| `GET /photos/latest` | Captura y devuelve el JPEG (1024 px de lado mayor, calidad 70) |
| `GET /measure/<bytes>` | Devuelve datos de prueba para medición de caudal |
| `POST /audio` | Recibe y reproduce un archivo de audio |

## 12.x Hiperparámetros de entrenamiento del detector

Configuración declarada en el script de entrenamiento del repositorio `bus-banner-recognizer`:

```python
HYPERPARAMETERS = dict(
    epochs=120, patience=25, imgsz=640, batch=32,
    optimizer="auto", cos_lr=True, close_mosaic=15,
    fliplr=0.0, flipud=0.0,
    hsv_h=0.01, hsv_s=0.5, hsv_v=0.6,
    degrees=5.0, translate=0.1, scale=0.5, shear=2.0,
    perspective=0.0005, mosaic=1.0, mixup=0.05, copy_paste=0.0,
)
```

**Corridas efectivamente ejecutadas:** 40 épocas, lote de 16, sobre CPU, con Ultralytics 8.4.37
(detector de una clase y detector de dos clases). La configuración de 120 épocas no se ejecutó.

**Export al sensor:** cuantización posterior al entrenamiento a enteros de 8 bits, calibrada con las
28 imágenes de la partición de validación; supresión de no máximos incorporada al modelo con
confianza 0,25 e IoU 0,7. Tamaño resultante: 2,64 MB. Ocupación del chip: 2,64 MB de modelo más
4,48 MB de runtime, es decir 7,12 MB sobre 8 MB disponibles (90 %).

## 12.x Barrido de márgenes de recorte

Grilla de 72 combinaciones de márgenes relativos (izquierdo, derecho, vertical) evaluada sobre las
117 imágenes del conjunto de evaluación. Mejores diez combinaciones por lectura completa:

| Izquierdo | Derecho | Vertical | Número | Destino | Lectura completa |
|---|---|---|---|---|---|
| 0,12 | 0,18 | 0,06 | 0,854 | 0,768 | 0,833 |
| 0,12 | 0,06 | 0,12 | 0,854 | 0,750 | 0,833 |
| 0,00 | 0,18 | 0,06 | 0,917 | 0,732 | 0,833 |
| 0,30 | 0,06 | 0,12 | 0,917 | 0,732 | 0,833 |
| 0,06 | 0,06 | 0,06 | 0,896 | 0,732 | 0,833 |
| 0,18 | 0,18 | 0,06 | 0,896 | 0,732 | 0,833 |
| 0,12 | 0,06 | 0,06 | 0,875 | 0,732 | 0,833 |
| 0,12 | 0,12 | 0,06 | 0,854 | 0,732 | 0,833 |
| 0,18 | 0,06 | 0,06 | 0,896 | 0,714 | 0,833 |
| 0,18 | 0,12 | 0,06 | 0,896 | 0,714 | 0,833 |

Peores tres combinaciones:

| Izquierdo | Derecho | Vertical | Número | Destino | Lectura completa |
|---|---|---|---|---|---|
| 0,12 | 0,18 | 0,24 | 0,771 | 0,661 | 0,750 |
| 0,00 | 0,18 | 0,24 | 0,812 | 0,679 | 0,729 |
| 0,00 | 0,12 | 0,24 | 0,750 | 0,625 | 0,688 |

**Efecto aislado del margen vertical**, promediado sobre el resto de la grilla:

| Margen vertical | 0,06 | 0,12 | 0,18 | 0,24 |
|---|---|---|---|---|
| Lectura completa | 0,819 | 0,812 | 0,810 | 0,770 |

**Valores adoptados en producción:** izquierdo 0,18, derecho 0,06, vertical 0,06.

## 12.x Datos crudos de las campañas de medición

### A. Caudal BLE (5 de septiembre de 2026)

Receptor iPhone con la aplicación distribuida, 53 000 bytes, fragmento de 182 bytes, ATT MTU 185.

| WiFi del dispositivo | Corridas (ms) | Mediana | Rango | Caudal |
|---|---|---|---|---|
| Apagada | 3580, 3660, 4470, 4520, 5010 | 4470 | 3580 a 5010 | 11,8 KB/s |
| Encendida | 4080, 4260, 4440, 4490, 6150 | 4440 | 4080 a 6150 | 11,9 KB/s |

Efecto del tamaño de fragmento (receptor de escritorio, 30 000 bytes, con pausa de 1 ms):

| Fragmento | Tiempo (ms) | Caudal |
|---|---|---|
| 182 bytes | 3210 | 9,3 KB/s |
| 95 bytes | 3627 | 8,3 KB/s |
| 47 bytes | 3767 | 8,0 KB/s |

Referencia por HTTP sobre WiFi, mismos 53 000 bytes: 153, 41, 46, 59, 43 ms (mediana 46 ms).

Plan B punta a punta, descarga de la fotografía:

| Escenario | Corridas (s) | Mediana |
|---|---|---|
| Teléfono y dispositivo en la misma red doméstica | 2,24 · 0,04 · 0,05 | 0,05 |
| Teléfono unido al punto de acceso del dispositivo, con datos móviles | 0,34 · 0,44 · 0,05 · 0,06 · 1,03 | 0,34 |

### B. Modelos de nube (2 de septiembre de 2026)

Cinco corridas por modelo, espaciadas 7 segundos, imagen de 768×1024 px (53 KB), conexión de fibra
doméstica en Montevideo.

```
gemini-3.5-flash-lite   30195, 10649, 32586,  3210,  2820  ms
gpt-5.6-luna             2490,  1668,  1421,  1410,  2375  ms
qwen/qwen3.8-27b          846,  1087,  1036,   764,   840  ms
```

Efecto del tamaño de imagen sobre el modelo seleccionado, tres corridas por tamaño:

| Lado mayor | Peso | Tokens de entrada | Mediana | Acierto |
|---|---|---|---|---|
| 1536 px | 97 KB | 2290 | 1331 ms | 3/3 |
| 1024 px | 53 KB | 1138 | 1532 ms | 3/3 |
| 640 px | 30 KB | 577 | 1984 ms | 3/3 |
| 384 px | 15 KB | 346 | 1121 ms | 3/3 |

### C. Modo ómnibus sobre el dispositivo (15 de septiembre de 2026)

| Evento | Marca temporal | Desde el gesto |
|---|---|---|
| Click del botón, cambio a modo ómnibus | 13:56:04,215 | 0 |
| Vigilancia iniciada | 13:56:04,220 | 5 ms |
| El OCR devuelve la lectura | 13:56:05,484 | 1,27 s |
| Anuncio de la línea | 13:56:05,488 | 1,27 s |

Lecturas posteriores en régimen: 971, 1001 y 1006 ms.

Arranque en frío del servicio: respuesta de salud a los 7 s, modo ómnibus operativo a los 47 s.

## 12.x Resultados completos de evaluación del pipeline de ómnibus

Corridas guardadas sobre las mismas 117 imágenes del conjunto de evaluación. Se incluyen para
permitir la trazabilidad de las tablas del capítulo 7.

| Configuración | Cartel P / R / F1 | Número (exactitud) | Destino | Lectura completa | Total p50 |
|---|---|---|---|---|---|
| Dos etapas, reconocedor latino | 0,701 / 1,000 / 0,824 | 0,917 | 0,750 | 0,875 | 37,9 ms |
| Dos etapas, reconocedor chino/inglés | 0,701 / 1,000 / 0,824 | 0,792 | 0,714 | 0,792 | 39,0 ms |
| Dos etapas, margen vertical 0,06 | 0,701 / 1,000 / 0,824 | 0,896 | 0,768 | 0,875 | 38,1 ms |
| Dos clases, reconocedor latino | 0,776 / 0,971 / 0,863 | 0,854 | 0,696 | 0,792 | 22,3 ms |
| Dos clases, margen vertical 0,06 | 0,776 / 0,971 / 0,863 | 0,896 | 0,714 | 0,833 | 21,7 ms |
| Dos clases, ONNX | 0,767 / 0,971 / 0,857 | 0,875 | 0,696 | 0,812 | 20,9 ms |
| Dos etapas, PP-OCRv5 | 0,701 / 1,000 / 0,824 | 0,896 | 0,786 | 0,854 | 45,6 ms |
| Dos etapas, PP-OCRv4 | 0,701 / 1,000 / 0,824 | 0,875 | 0,732 | 0,750 | 121,6 ms |
| Dos etapas, PaddleOCR nativo | 0,701 / 1,000 / 0,824 | 0,896 | 0,768 | 0,792 | 152,7 ms |
| Dos etapas, con realce CLAHE | 0,701 / 1,000 / 0,824 | 0,771 | 0,643 | 0,646 | 136,6 ms |

**Definiciones utilizadas.** Para el cartel, un verdadero positivo es una imagen anotada con cartel
presente en la que el sistema lo detecta; la exactitud del número se calcula sobre las 48 imágenes
con número esperado y la del destino sobre las 56 con destino esperado; la lectura completa exige
acierto simultáneo en ambos campos.

## 12.x Estructura del conjunto de evaluación

| Propiedad | Valor |
|---|---|
| Imágenes | 117 |
| Con ómnibus presente | 102 |
| Con cartel legible | 68 |
| Con número esperado | 48 |
| Con destino esperado | 56 |
| Procedencia | Video 1: 32 · Video 2: 45 · Video 3: 26 · Conjunto de prueba de Roboflow: 14 |

Columnas del archivo de verdad de terreno: identificador de imagen, número esperado, destino
esperado, presencia de ómnibus, presencia de cartel y una nota con el texto literal del cartel cuando
difiere de la denominación oficial.
