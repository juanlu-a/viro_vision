# Pruebas y decisiones — qué probamos, qué midió cada camino y qué elegimos (2026-08)

**Borrador de la sección "pruebas y decisiones" del documento principal de la tesis.** Compila
todo lo que se probó (nube, LiteRT-LM, ExecuTorch, OCR local), lo que midió cada camino, y las
decisiones que el equipo tomó en base a esos resultados (reunión del 2026-08-21). Las fuentes
primarias son [`spike-vision-local.md`](spike-vision-local.md) (las mediciones) y los ADRs que se
citan en cada decisión.

## La pregunta

¿Cómo reconoce ViroVision líneas de ómnibus y productos de canasta básica con una latencia, un
costo y una accesibilidad aceptables? El marco lo fija [ADR
0001](architecture/adr/0001-offline-first-on-device-inference.md) (enmendado 2026-08-10): **lo
local es el fallback garantizado; la nube solo puede ser un acelerador opcional**, nunca el único
camino. Dentro de ese marco había cuatro alternativas técnicas reales, y se midieron las cuatro
sobre el mismo hardware (iPhone 15 Pro), la misma foto y el mismo prompt.

## Alternativas probadas

| Alternativa | Qué es | Tamaño | Latencia medida | Estado |
|---|---|---|---|---|
| **Nube — Gemini** | API de visión con streaming SSE (`gemini-flash-lite-latest` por defecto) | 0 en el teléfono | **TTFT < 1 s** | ✅ Funciona. Requiere internet; tier gratuito con cuota de 20 req/min por modelo |
| **LiteRT-LM + Gemma** | Runtime local de Google (sucesor de TFLite) con Gemma embebido | 756 MB–2,5 GB según modelo | Texto: **910 ms, 13,4 tok/s** (Gemma 3 1B) | ⚠️ Texto funciona; **visión rota en iOS** — bug de la librería, aislado con evidencia (3 modelos, mismo error; memoria/disco/contexto/precisión descartados) |
| **ExecuTorch + Gemma 4 E2B multimodal** | Runtime local de PyTorch (sobre MLX en iOS) con el VLM más chico disponible | 3 GB | Carga ~4 s; **TTFT ~5,6 s, total ~6,4 s** | ✅ La visión funciona y lee bien el cartel, pero es lento para un ómnibus acercándose |
| **OCR local** | Detector CRAFT + reconocedor CRNN en español, sobre ExecuTorch | ~250 MB | **Fracciones de segundo** | ✅ Rápido y liviano. Devuelve texto + **posición** + confianza; mejora mucho con buen encuadre o recorte |

El hallazgo estructural del spike: **el problema del multimodal era la librería, no el teléfono**
— el mismo Gemma 4 E2B que LiteRT-LM no podía abrir en modo visión, por ExecuTorch carga y lee.

## Pros y contras

| Alternativa | Pros | Contras | Veredicto |
|---|---|---|---|
| Nube — Gemini | La mejor latencia con la mejor precisión; cero peso en el teléfono; tier gratuito sin tarjeta | Requiere internet (frágil en la calle); cuota; prohibida como único camino (ADR 0001) | Candidata para supermercado; acelerador opcional en el resto |
| LiteRT-LM + Gemma | Texto local rápido; el runtime que Google recomienda | La visión no funciona en iOS; el bug es de la librería y no depende de nosotros | Descartado hasta que arreglen el bug (reportable) |
| ExecuTorch + VLM 3 GB | Única visión LLM 100 % local probada; valida que el hardware puede | 6,4 s totales; 3 GB de descarga; sin coordenadas para priorizar | Término de comparación en el informe, no candidato |
| OCR local | Fracciones de segundo; ~250 MB; posición + confianza (permite priorizar); español | Necesita buen encuadre — o un recorte que se lo dé | **Ganador para bondis**, con detección adelante |

## Decisión 1 — Bondis: camino local ([ADR 0006](architecture/adr/0006-pipelines-por-caso-de-uso.md))

**La latencia manda y el camino es local**: detección en la **Coral TPU** del dispositivo (YOLO o
similar preentrenado — COCO ya trae la clase `bus`, no hay que entrenar) → **recorte del banner**
→ **OCR** sobre el recorte. En el mejor de los casos todo corre en la TPU; como mínimo, al
celular llega solo el recorte, no el frame crudo.

El recorte no es una optimización menor: en el spike, el OCR y el VLM se distraían con la
matrícula y otros textos hasta que el prompt lo prohibió. **Recortar elimina la distracción en
vez de parchearla**, y de paso el banner reescalado le da al OCR letras grandes — su mejor caso.
La caja de detección más grande = ómnibus más cercano: la priorización que la tesis exige,
gratis.

Esto redefine el rol de la TPU: de "correr los modelos completos" a **preprocesadora del camino
de bondis**. El riesgo técnico principal es que el rendimiento de la detección sobre la Coral TPU
de la RPi Zero 2 W todavía no está medido — el spike midió el teléfono.

## Decisión 2 — Supermercado: LLM con visión en la nube, modelo elegible ([ADR 0006](architecture/adr/0006-pipelines-por-caso-de-uso.md))

**La complejidad manda**: distinguir productos de canasta básica es una tarea donde un LLM con
visión aporta de verdad, y el usuario quieto en la góndola tolera una latencia que la parada de
ómnibus no tolera. Dos candidatos:

| Criterio | Gemma 3 1B local (~700 MB) | Gemini Flash (nube) |
|---|---|---|
| Latencia | A medir (texto: 910 ms; visión con modelo chico, sin medir) | TTFT < 1 s medido |
| Precisión esperada | Menor (modelo chico) | Mayor (modelo grande) |
| Tamaño / descarga | ~700 MB la primera vez | Cero |
| Offline | ✅ Sí | ❌ No |
| Gratuidad | ✅ Gratis siempre | ⚠️ Tier gratuito con cuota (20 req/min por modelo) |

**Restricción dura: gratuito para el usuario.** Exigirle una cuenta y credenciales propias rompe
la accesibilidad que es la razón de ser del producto.

**Resuelto el 2026-08-30: gana la nube.** La comparación de arriba quedó decidida a favor de la
columna derecha, con una excepción explícita y acotada a la restricción 2 de ADR 0001: hoy el modo
supermercado **no tiene fallback local**, y sin internet o sin clave **avisa** en vez de leer. Lo
local sigue siendo el objetivo —medir Gemma 3 1B con visión sobre productos reales es lo que cierra
la excepción— pero dejó de bloquear el desarrollo del modo.

**Ampliado el 2026-09-01: cinco modelos, y la clave sale del bundle.** La gratuidad deja de ser
restricción *para el proyecto* (se paga para poder comparar) y sigue siéndolo *para el usuario*. El
selector ofrece cinco modelos elegidos por latencia — `gemini-3.5-flash-lite`, `gpt-5.6-luna`,
`claude-haiku-4-5`, `qwen/qwen3.6-27b` sobre Groq, y la opción de hostear en Arnaldo Castro, sólo
documentada. Las claves pasan a un proxy propio en Supabase
([ADR 0008](architecture/adr/0008-proxy-propio-para-claves-de-nube.md)), que es lo que destraba
poder pagar sin repartir la tarjeta en cada `.ipa`. **Ésta es la corrida que alimenta el dataset de
evaluación de abajo**: la misma foto contra los cinco, tiempo y acierto por modelo.

## Cómo vamos a medir: dataset de evaluación

Para ambos casos se genera un **dataset de evaluación** — resultado esperado contra obtenido — y
de ahí salen las métricas. **Es la forma de medir precisión del proyecto**, y el instrumento que
cierra la decisión pendiente de supermercado. No es un dataset de entrenamiento: los modelos
vienen preentrenados, y la tarea B1 del roadmap cambia de "entrenar" a "evaluar".

| Métrica | Definición | Qué captura en ViroVision |
|---|---|---|
| **Recall** | De todos los casos reales, cuántos detectamos | Ómnibus/productos que se nos escapan — el costo de perder un ómnibus es alto |
| **Precision** | De lo que anunciamos, cuánto era correcto | Anuncios falsos — para un usuario ciego, un número inventado es peor que un "no pude leerlo" |
| **Accuracy** | Aciertos sobre el total | La foto general, útil para comparar alternativas entre sí |
| **F1** | Media armónica de precision y recall | El balance en un solo número, para la tabla comparativa de la tesis |

## Modos de operación ([ADR 0007](architecture/adr/0007-botones-fisicos-modos-de-operacion.md))

El reconocimiento **no queda siempre prendido**: anunciar todo lo que la cámara ve, todo el
tiempo, aturde — y el audio es la interfaz. El dispositivo lleva un botón físico: 1 click activa
el modo ómnibus (pipeline local), 2 clicks el modo supermercado (pipeline LLM), click largo
vuelve a esperando. El diagrama de estados canónico está en
[`architecture/README.md`](architecture/README.md).

## Trazabilidad

| Decisión | Dónde vive |
|---|---|
| Lo local primero, nube solo como acelerador | [ADR 0001](architecture/adr/0001-offline-first-on-device-inference.md) (enmendado 2026-08-10) |
| El runtime único deja de existir; LiteRT-LM deja de ser el camino | [ADR 0004](architecture/adr/0004-on-device-inference-runtime.md) (actualizaciones 2026-08-13 y 2026-08-22) |
| Bondis local con TPU preprocesadora; supermercado LLM en la nube con modelo elegible; dataset de evaluación | [ADR 0006](architecture/adr/0006-pipelines-por-caso-de-uso.md) (actualizaciones 2026-08-30 y 2026-09-01) |
| Las claves de nube salen del bundle a un proxy propio en Supabase | [ADR 0008](architecture/adr/0008-proxy-propio-para-claves-de-nube.md) |
| Botones físicos y modos de operación | [ADR 0007](architecture/adr/0007-botones-fisicos-modos-de-operacion.md) |

## Pendientes

- Supermercado: **fallback local** sin resolver — queda medir Gemma 3 1B con visión sobre productos
  reales. Es lo único que cierra la excepción a ADR 0001. (El despliegue de la clave dejó de ser un
  pendiente el 2026-09-01: lo resuelve el proxy de ADR 0008.)
- Validar ADR 0006 y 0007 con el tutor (todo está en Proposed).
- Armar el dataset de evaluación (captura, etiquetado esperado/obtenido) para ambos casos.
- Elegir el detector concreto para la TPU (`rfdetr-nano` / `yolo26` / YOLO11-nano) y medirlo sobre
  la RPi Zero 2 W + Coral — el riesgo técnico abierto del camino de bondis.
- Reportar el bug de visión de `react-native-litert-lm` con el caso reproducible del spike.
