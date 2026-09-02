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

### Qué modelo corre, y por qué (medición del 2026-09-02)

Números completos, método y limitaciones en
[`mediciones/2026-09-02-modelos-supermercado.md`](mediciones/2026-09-02-modelos-supermercado.md).
Acá va lo que decide.

Se midieron los tres proveedores con clave **contra sus APIs reales y con el código de la app**,
cinco corridas espaciadas por modelo, mismo prompt y mismo schema.

| Modelo | Mediana | Rango | Dispersión | Acierto | Cuota | Costo |
|---|---|---|---|---|---|---|
| `qwen/qwen3.8-27b` (Groq) | **846 ms** | 764-1087 ms | 1,4× | 5/5 | **~4 lecturas/min** | gratis |
| `gpt-5.6-luna` (OpenAI) | 1668 ms | 1410-2490 ms | 1,8× | 5/5 | holgada | USD 0,0003 |
| `gemini-3.5-flash-lite` | 10 649 ms | 2820-32 586 ms | **11,6×** | 5/5 | 20/min | gratis |

**La precisión no separó a los modelos: 15/15 corridas correctas en los tres campos.** Con la
salvedad de que la imagen es sintética y de alto contraste — el mejor caso posible. Lo que muestra
es que ninguno falla en lo fácil, no que sean equivalentes en lo difícil.

**Lo que separa es la latencia, y dentro de la latencia, la dispersión.** Gemini tiene una mediana
6,4 veces peor que OpenAI y, sobre todo, un rango que va de 2,8 a 32,6 segundos con la cuota fresca
y las corridas espaciadas. Para una persona parada frente a la góndola esperando escuchar qué
agarró, un modelo que a veces tarda medio minuto es peor que uno que siempre tarda dos segundos.

Esto **corrige la medición del 30/08**, que había dado 2-3 s para Gemini con menos muestras: los dos
extremos de ahora contienen aquel número, así que lo más probable es que aquella campaña haya caído
en el extremo bueno. Es la lección metodológica: **cinco corridas y no una, y reportar el rango**.

**Decisión: el selector ofrece `gpt-5.6-luna` (default) y `qwen/qwen3.8-27b`.** Gemini sale.

- **El default no es el más rápido**, y eso es a propósito. Groq gana por 800 ms, pero su cuota
  gratuita limita por *tokens* por minuto (8000 TPM, ~1974 por foto a tarifa plana) = **unas 4
  lecturas por minuto**, y alguien recorriendo una góndola hace del orden de 2 a 4. Un default que
  choca el límite a la cuarta lectura es peor producto que uno 800 ms más lento.
- **Groq queda como la segunda opción**, que es donde su perfil sirve: la lectura más rápida
  disponible, gratis, para quien haga lecturas espaciadas o quiera evitar el costo.
- **El costo del default es despreciable a la escala de la tesis**: mil lecturas cuestan menos de
  USD 0,50. La restricción de ADR 0006 —gratuito **para el usuario**— se sigue cumpliendo: paga el
  proyecto, y el usuario no pone credenciales.
- **Son dos y no más** porque el selector se recorre con VoiceOver y cada opción de más es un swipe
  entre la persona y la lectura.
- Los perfiles retirados viven en `PERFILES_RETIRADOS` y sus proveedores siguen implementados y
  testeados: volver a ofrecer uno es mover una entrada, no escribir código.

### El techo de resolución: correcto, pero por otro motivo del que estaba escrito

La app achica la foto a 1024 px de lado mayor antes de subirla, y el código lo justificaba por
latencia. Se midió sobre `gpt-5.6-luna` con cuatro tamaños:

| Lado mayor | Tokens de entrada | Mediana | Acierto |
|---|---|---|---|
| 1536 px | 2290 | 1331 ms | 3/3 |
| **1024 px** | **1138** | 1532 ms | 3/3 |
| 640 px | 577 | 1984 ms | 3/3 |
| 384 px | 346 | 1121 ms | 3/3 |

**Los tokens escalan con el tamaño; la latencia, no.** Los tokens se duplican a cada escalón, pero
las medianas no ordenan — 640 px salió más lento que 1536 px. A esta escala la latencia la domina el
modelo y la red, y el ruido entre corridas (±800 ms) tapa cualquier diferencia. El techo se mantiene
porque **baja el costo a la mitad** y el tráfico en una conexión de supermercado, no porque compre
segundos.

El acierto se sostiene hasta 384 px, pero sobre una imagen sintética con texto de 90 px de alto.
Una góndola real tiene el peso neto en cuerpo 8 y reflejo en el envase — y el objetivo opcional de
OCR de etiqueta vive justamente en esa letra chica. Bajar el techo exige medirlo con fotos reales.

### Tres defectos que sólo aparecieron midiendo contra la API real

Ninguno daba error visible, que es por qué importan.

1. **La cuota no siempre llega como evento SSE.** Groq la devuelve como **HTTP 429** antes de abrir
   el stream, y por ese camino la app lanzaba `VisionHttpError`: el usuario escuchaba "La nube no
   respondió" en vez de "Cuota agotada, reintentá en N s", con el dato de cuánto esperar llegando y
   nadie leyéndolo.
2. **El tope del limitador para Groq estaba mal por un orden de magnitud**, y hacia el lado
   peligroso: 25/min, el número de un límite por requests que ese proveedor no tiene. Nunca frenaba.
3. **Apagar el razonamiento no compra latencia fuera de Gemini.** Estaba justificado por
   extrapolación; sobre `gpt-5.6-luna` da lo mismo `none`, `medium` o no mandar nada, con idénticos
   tokens de salida.

Y la documentación de Groq no lista sus valores reales: documenta `reasoning_effort: none | default`
y `low` respondió 200. Es el argumento de esta base para verificar contra la API y no contra los
docs, ahora con un tercer caso.

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
