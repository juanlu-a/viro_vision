# ADR 0006 — Pipelines por caso de uso: bondis local, supermercado nube o LLM chico

- **Status:** Proposed — a validar con el tutor
- **Date:** 2026-08-22 (reunión de equipo del 2026-08-21)
- **Deciders:** ViroVision team (Juan Lucas Abreu, Magalí Dellapiazza, Francisco Tauber)
- **Tags:** ml, app, hardware, architecture
- **Relates to:** [ADR 0001](0001-offline-first-on-device-inference.md),
  [ADR 0004](0004-on-device-inference-runtime.md)

## Contexto

El spike de visión local ([`docs/spike-vision-local.md`](../../spike-vision-local.md)) midió los
cuatro caminos sobre el hardware objetivo y dejó los números sobre la mesa: el OCR local lee en
fracciones de segundo con ~250 MB; el VLM local multimodal funciona pero tarda 6,4 s; la nube
responde con TTFT < 1 s pero exige internet y tiene cuota. Hasta ahora el repo buscaba **un**
runtime (ADR 0004: "Gemma vía LiteRT-LM"); la evidencia dice que la pregunta estaba mal planteada.

Los dos casos de uso de la tesis tienen restricciones opuestas:

- **Bondis:** la latencia manda. Un ómnibus acercándose da una ventana de segundos; 6,4 s de VLM
  o una nube sin señal en la calle pierden el ómnibus. Además hay que **priorizar** cuando hay
  varios, y eso exige coordenadas, no una frase.
- **Supermercado:** la complejidad manda. Distinguir productos de canasta básica (envases
  parecidos, marcas, variantes) es una tarea de reconocimiento rica donde un LLM con visión
  aporta de verdad, y el usuario está quieto: tolera latencia que el bondi no tolera.

## Decisión propuesta

**Cada caso de uso tiene su pipeline.** Deja de existir "el" runtime único.

### Bondis → camino local, con la TPU como preprocesadora

Pipeline: **detección en la Coral TPU** del dispositivo (YOLO o similar preentrenado — COCO ya
trae la clase `bus`, no hay que entrenar) **→ recorte del banner → OCR** (CRAFT + CRNN en
español). El banner es geométricamente predecible (franja superior de la caja del ómnibus), y el
recorte reescalado le da al OCR letras grandes y sin distracciones: en el spike, el modelo leía
la matrícula en vez del cartel hasta que se lo prohibió — **recortar elimina el problema en vez
de parchearlo con prompts**. En el mejor de los casos, todo el pipeline corre en la TPU y al
celular llega el resultado; como mínimo, la TPU manda **solo el recorte**, no el frame crudo, lo
que además reduce lo que viaja por el canal app↔dispositivo.

Esto **redefine el rol de la Coral TPU**: pasa de "correr los modelos completos" (como la
describen los docs previos) a **preprocesadora del camino de bondis** — detección y recorte, con
el OCR en la TPU o en el celular según lo que dé el hardware.

### Supermercado → LLM con visión: nube o modelo local chico (pendiente)

La elección concreta queda **abierta**, entre dos candidatos:

| Criterio | Gemma 3 1B local (~700 MB) | Gemini Flash (nube) |
|---|---|---|
| Latencia | A medir (el spike midió texto: 910 ms; visión con modelo chico, sin medir) | TTFT < 1 s medido |
| Precisión esperada | Menor (modelo chico) | Mayor (modelo grande) |
| Tamaño / descarga | ~700 MB la primera vez | Cero |
| Offline | ✅ Sí | ❌ No |
| Gratuidad | ✅ Gratis siempre | ⚠️ Tier gratuito con cuota (20 req/min por modelo) |

**Restricción dura: el modelo tiene que ser gratuito para el usuario.** Exigirle crearse una
cuenta y cargar credenciales propias rompe la accesibilidad que es la razón de ser del producto.
Eso descarta de entrada cualquier proveedor pago y condiciona cómo se despliega la clave si el
camino es la nube.

Lo que destraba la decisión: medir **Gemma 3 1B con visión** sobre productos reales (¿alcanza la
precisión de un modelo chico para envases?) y resolver cómo un build distribuible usa la nube sin
credenciales del usuario. Coherente con ADR 0001: si gana la nube, lo local queda de fallback.

### Cómo se mide la precisión: dataset de evaluación

Para ambos casos se genera un **dataset de evaluación** — resultado esperado contra obtenido —
del que salen **recall, precision, accuracy y F1**. Es la forma de medir precisión del proyecto y
el instrumento que cierra la decisión pendiente de supermercado. Nota de alcance: el dataset es
**de evaluación, no de entrenamiento** — los modelos vienen preentrenados; la tarea B1 del
roadmap cambia de "entrenar" a "evaluar".

## Alternativas consideradas

- **Un runtime único para todo (lo que proponía ADR 0004 original).** Rechazado por evidencia: el
  VLM local que serviría para supermercado tarda 6,4 s en el caso donde la latencia manda, y el
  OCR que gana en bondis no distingue productos.
- **Todo en la nube.** Prohibido por ADR 0001 (nube sin fallback local) y frágil justo donde más
  importa: en la calle, sin señal.
- **VLM local multimodal (3 GB) para bondis.** Medido en el spike: 6,4 s de total y sin
  coordenadas para priorizar. Queda como término de comparación en el informe, no como candidato.

## Consecuencias

**Positivas**

- Cada caso de uso optimiza su restricción real (latencia vs. complejidad) en lugar de pagar un
  compromiso único que no sirve bien a ninguno.
- El camino de bondis no requiere entrenar ningún modelo: detección COCO + OCR preentrenado.
- El recorte en la TPU reduce el tráfico app↔dispositivo y elimina las distracciones del OCR.

**Costos / riesgos**

- Dos pipelines para mantener y evaluar en vez de uno.
- El rendimiento real de YOLO/detección **sobre la Coral TPU de la RPi Zero 2 W** no está medido
  todavía — el spike midió el teléfono. Es el riesgo técnico principal del camino de bondis.
- La decisión de supermercado queda abierta; hasta cerrarla conviven dos candidatos en el plan.

## Actualización 2026-08-30 — supermercado va a la nube; el fallback local queda pendiente

El equipo decidió que el camino de supermercado **es la nube**, con el modelo elegible por el
usuario en Inicio (Gemini Flash por defecto —corregido a Flash Lite en la actualización *bis* de
más abajo—; Anthropic si el build trae su clave). Sin internet o
sin clave, el modo **avisa y no lee**. Esto es una **excepción explícita y acotada a la restricción
2 de ADR 0001** ("nube sin fallback local, prohibido"): aplica sólo al modo supermercado, está
rotulada en la UI, y se cierra evaluando **Gemma 3 1B con visión** sobre productos reales como
fallback local. El modo ómnibus no cambia: local siempre.

Consecuencia en el código: el laboratorio del spike (LiteRT-LM, Gemma multimodal por ExecuTorch,
benchmark de nube) se retiró de la app y quedó preservado en la rama `spike/laboratorio-vision-local`.
Queda **un solo runtime nativo** (ExecuTorch, sólo OCR).

## Actualización 2026-08-30 (bis) — el default pasa a Flash Lite y la lectura devuelve tipo + marca

Dos cambios sobre la actualización de arriba, ambos con medición contra la API real detrás.

**El default deja de ser Flash y pasa a Flash Lite.** Con la cuota fresca y una foto de un paquete
de arroz, `gemini-3.5-flash-lite` responde en **2-3 s**, `gemini-3.5-flash` en **17-30 s** y
`gemini-3.6-flash` —que era el default— en **34-47 s**. La brecha es el paso de razonamiento: los
Flash grandes piensan aunque la respuesta sean tres campos cortos. El Lite acertó tipo, marca y
detalle en todas las corridas, así que la latencia del grande no compraba precisión. El selector de
Inicio pasa a ofrecer **sólo los dos Flash Lite** (el fijado y el alias `-latest`): un modelo que
tarda medio minuto en decir "arroz Saman" no es una opción para alguien parado frente a la góndola,
y ofrecerlo sólo invita a elegirlo. Los de Anthropic siguen apareciendo únicamente si el build trae
su clave.

Reserva metodológica, para quien re-mida: **sostener pedidos satura el tier gratuito** y a partir de
la tercera lectura seguida cualquier modelo salta a 20-80 s. Eso es la cuota, no el modelo; las
comparaciones válidas son con las corridas espaciadas. El orden relativo entre modelos se sostuvo en
todas las tandas.

Además se encontró que el proveedor de Gemini **ignoraba** el `thinking: 'off'` que recibía: la
Interactions API no acepta `thinking_config`, `thinking_budget`, `reasoning` ni `effort` (400,
"Unknown parameter"); el único parámetro que existe es `generation_config.thinking_level`, con
valores `minimal | low | medium | high`. Ya se manda. Ojo: `minimal` lo aceptan los Flash Lite pero
los Flash grandes lo **rechazan** con 400 y exigen al menos `low`.

**La lectura devuelve `tipo`, `marca` y `detalle` en campos separados**, donde antes `producto`
mezclaba qué es y de quién es. Son dos datos con prioridades distintas para quien no ve: el tipo
decide si el producto sirve, la marca sólo cuál de los que sirven. Separados, el anuncio puede decir
el tipo aunque la marca no se lea (y al revés) en vez de perder los dos por un campo que el modelo
no pudo completar entero. La frase hablada queda "arroz Saman, Blue Patna 1 kg".

## Implicaciones para el código actual

- El lector de Inicio (`app/src/features/reader/`) implementa los dos modos; los modos del producto
  se disparan desde el hardware ([ADR 0007](0007-botones-fisicos-modos-de-operacion.md)).
- Un solo runtime nativo en el binario (ExecuTorch, OCR); el pendiente "cuál queda" se cerró el
  2026-08-30.
- `ml/` deja de planificar entrenamiento: su trabajo pasa a ser el dataset de evaluación y el
  export del detector a la TPU.

## Ver también

[`docs/pruebas-y-decisiones.md`](../../pruebas-y-decisiones.md) (el registro completo de lo
probado), [`docs/spike-vision-local.md`](../../spike-vision-local.md) (las mediciones),
[ADR 0007](0007-botones-fisicos-modos-de-operacion.md) (los modos que activan cada pipeline) y el
diagrama de modos en [`docs/architecture/README.md`](../README.md).
