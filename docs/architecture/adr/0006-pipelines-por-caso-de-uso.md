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

## Implicaciones para el código actual

- El lector de Inicio (`app/src/features/reader/`) ya tiene los tres caminos del spike; los modos
  del producto se disparan desde el hardware ([ADR 0007](0007-botones-fisicos-modos-de-operacion.md)).
- Conviven dos runtimes nativos en el binario (~86 MB extra); al cerrar supermercado se decide
  cuál queda (pendiente heredado del spike).
- `ml/` deja de planificar entrenamiento: su trabajo pasa a ser el dataset de evaluación y el
  export del detector a la TPU.

## Ver también

[`docs/pruebas-y-decisiones.md`](../../pruebas-y-decisiones.md) (el registro completo de lo
probado), [`docs/spike-vision-local.md`](../../spike-vision-local.md) (las mediciones),
[ADR 0007](0007-botones-fisicos-modos-de-operacion.md) (los modos que activan cada pipeline) y el
diagrama de modos en [`docs/architecture/README.md`](../README.md).
