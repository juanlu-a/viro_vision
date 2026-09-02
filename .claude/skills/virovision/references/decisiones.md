# Decisiones vigentes

Índice de qué está decidido, con qué estado, y **qué cambió respecto de lo anterior** — que es la
parte que se pierde si sólo se lee el ADR más nuevo. Los ADR completos están en
`docs/architecture/adr/`.

## ADRs

### ADR 0001 — Offline-first, inferencia on-device · **Accepted, enmendado 2026-08-10**

Original: las funciones esenciales (detección, OCR, respuesta auditiva) funcionan **sin internet**, y
el modelo corre local — *"never a cloud API"*.

**Qué cambió** tras la reunión con el tutor: la **nube pasa a ser un acelerador opcional** en el
camino de reconocimiento. Un *model gateway* en runtime puede mandar una inferencia a la nube cuando
hay cobertura y eso compra precisión (ejemplo del tutor: los productos de canasta toleran más
latencia a cambio de precisión). Lo que **no** cambió: local es el **fallback garantizado**, la nube
sola sin fallback sigue **prohibida**, y los casos críticos en latencia (líneas de ómnibus) quedan
locales por defecto.

Donde el texto viejo dice "never a cloud API", léase **"never a cloud API *as the only path*"**.

### ADR 0002 — Supabase como capa de cuenta online · **Accepted, actualizado dos veces**

- 2026-07-18: email + contraseña, **no** Google/OAuth.
- 2026-07-20: **la app se publica sin login**, abre directo a las pestañas. El núcleo es
  offline-first, así que una cuenta no aporta nada y Apple no la exige. El código de auth está
  **archivado, no borrado**: existe en el repo pero no está cableado a la navegación.

### ADR 0003 — Transporte de imagen (WiFi vs BLE) · **reservado, sin escribir**

El número está reservado a propósito. Depende de tener hardware.

### ADR 0004 — Runtime de inferencia on-device · **Proposed — actualizado 2026-08-22: se resuelve por caso de uso**

Proponía **Gemma vía LiteRT-LM**. El spike lo midió: el camino de visión de LiteRT-LM **no funciona
en iOS** (bug de la librería, aislado con evidencia); el mismo modelo por **ExecuTorch/MLX** sí ve,
pero tarda ~6,4 s. La recomendación vigente es **detección + OCR preentrenados** (ExecuTorch,
~250 MB, fracciones de segundo, devuelve coordenadas) como camino primario del teléfono, VLM local
como comparación. Ver `docs/spike-vision-local.md`. Sigue descartado MediaPipe (en mantenimiento).

Restricción encontrada y anotada: **el sandbox de iOS impide usar el Gemma que corre dentro de otra
app**. Tenerlo andando en Edge Gallery prueba que el hardware da, pero no acerca el producto.

**Qué cambió el 2026-08-22** (reunión de equipo del 21): la pregunta de "el" runtime **deja de
existir** — se resuelve por caso de uso en ADR 0006. "Gemma vía LiteRT-LM" deja de ser el camino
primario; si lo local gana en supermercado, el candidato es un Gemma chico sobre **ExecuTorch**. La
pregunta de alcance (¿el VLM reemplaza a YOLO + OCR?) quedó **cerrada con evidencia**: no — 6,4 s
contra fracciones de segundo, y sin coordenadas para priorizar. El VLM queda como término de
comparación en el informe.

### ADR 0005 — Design system y estándares de accesibilidad · **planeado, sin escribir**

Buena parte ya está implementada (tokens, `theme.test.ts`, tipografía de marca); falta escribirla.

### ADR 0006 — Pipelines por caso de uso · **Proposed (2026-08-22) — a validar con tutor; actualizado 2026-08-30 y 2026-09-01**

**Qué cambió**: deja de haber un runtime único (lo que buscaba ADR 0004). Cada caso de uso tiene su
pipeline. **Bondis = local** (la latencia manda): detección **preentrenada en la Coral TPU** del
dispositivo → recorte del banner → OCR sobre el recorte — la TPU pasa de "correr los modelos
completos" a **preprocesadora**, y al celular llega el recorte, no el frame. **Supermercado = LLM
con visión** (la complejidad manda), elección **PENDIENTE**: Gemma 3 1B local (~700 MB) vs. Gemini
Flash nube, con la restricción dura de que sea **gratuito para el usuario** (exigir credenciales
propias rompe la accesibilidad). La precisión del proyecto se mide con **datasets de evaluación**
(esperado vs. obtenido → recall, precision, accuracy, F1) — de evaluación, no de entrenamiento: la
tarea B1 cambia de "entrenar" a "evaluar". Ver `docs/pruebas-y-decisiones.md`.

**Qué cambió el 2026-09-01**: cae la gratuidad como restricción **del proyecto** (se paga para poder
comparar) y sigue vigente **para el usuario final**. El selector pasa a **cinco modelos elegidos por
latencia**, uno por proveedor: `gemini-3.5-flash-lite` (default), `gpt-5.6-luna`, `claude-haiku-4-5`,
`qwen/qwen3.8-27b` sobre Groq, y el hosteado en Arnaldo Castro —documentado, sin endpoint todavía—.
Salen `gemini-flash-lite-latest` y `claude-opus-5`: siete opciones en un radiogroup recorrido con
VoiceOver frente a una góndola es peor producto que cinco. La **cámara del teléfono** ocupa el lugar
de la placa mientras no hay hardware, y la lectura además puede dejar un `.mp3` (apagado por
defecto). El **camino de ómnibus queda en stand by**.

### ADR 0007 — Botones físicos y modos de operación · **Proposed (2026-08-22) — a validar con tutor**

**Qué cambió**: hasta ahora no había ninguna interfaz de entrada física especificada. El
reconocimiento funciona por **modos explícitos** activados con el botón del dispositivo — nunca
audio no solicitado. Desde *esperando*: 1 click = modo ómnibus (pipeline local), 2 clicks = modo
supermercado (pipeline LLM), click largo = volver a esperando. Cada transición se anuncia por
audio. Diagrama canónico en `docs/architecture/README.md`.

### ADR 0008 — Proxy propio para las claves de nube · **Accepted (2026-09-01)**

**Qué cambió**: las claves dejan de viajar en el bundle. `EXPO_PUBLIC_*` no es una variable de
entorno que el binario lea al arrancar, es una **constante compilada dentro del `.ipa`**; con link
público de TestFlight vivo y modelos pagos, eso es la tarjeta del proyecto. Van a una **Supabase
Edge Function** que las inyecta del lado del servidor. Cierra el pendiente (b) de ADR 0006.

Elegida por **encaje, no por ser la mejor herramienta**: Supabase ya es el backend declarado (ADR
0002) y ya es dependencia, así que no suma una cuenta más que mantener. Cloudflare Workers es
técnicamente mejor proxy de streaming, pero su ventaja (cold start de decenas de ms) es ruido frente
a los 2-3 s del modelo; AWS Lambda es desproporcionado para reenviar un POST. La comparación de las
cinco opciones evaluadas está en el ADR.

**Es un proxy tonto a propósito**: reenvía el cuerpo que el cliente ya armó, sin leerlo. Leerlo para
reemitirlo duplicaría el parseo de eventos de cada proveedor y mataría el streaming.

**Lo que compra y lo que no**, porque es fácil creer que resuelve más: no está autenticado (la app
no tiene login y la anon key viajaría igual), así que el endpoint **es abusable**. Lo que cambia es
el modo de falla — la clave se rota o se corta en segundos en vez de exigir publicar una versión.
Las defensas reales: allowlist de hosts (sin ella es un SSRF que regala la clave), freno por IP y
**tope de gasto** en cada proveedor.

**Estado: escrito, sin desplegar.** Falta crear el proyecto Supabase.

## Decisiones sin ADR, pero vigentes

**Gemini es el default, pero ya no el único.** Desde el 2026-09-01 el selector ofrece cinco modelos
de proveedores distintos (ver ADR 0006). Gemini sigue de default por ser el único con tier gratuito
sin tarjeta, y el modelo es `gemini-3.5-flash-lite`: medido contra la API real (30/08/2026) responde
en 2-3 s contra 17-47 s de los Flash grandes, con el mismo acierto — la latencia manda también en
supermercado. Ojo al re-medir: sostener pedidos satura el tier gratuito y todo salta a 20-80 s; hay
que espaciar las corridas.

**Un modelo por proveedor, y el selector no crece.** Cada opción de más en un radiogroup recorrido
con VoiceOver es un swipe más entre la persona y la lectura. Hay un test que **falla** si alguien
agrega dos modelos del mismo proveedor: la decisión hay que rediscutirla, no ajustarla.

**El razonamiento se apaga siempre, pero sólo en Gemini eso compra latencia.** Medido el
2026-09-02: en Gemini no apagarlo lleva la lectura de 3 s a decenas de segundos
(`generation_config.thinking_level`), pero sobre `gpt-5.6-luna` da igual — `none`, `medium` y el
default rinden lo mismo, con los mismos tokens de salida, porque no gasta razonamiento en tres
campos cortos. Se manda `'none'` igual por intención y porque es gratis, no por los segundos.
`'none'` es además el único valor que OpenAI y Groq garantizan los dos. **La documentación de Groq
no lista sus valores reales**: documenta `none|default` y `low` devolvió 200 — otra razón para
verificar contra la API y no contra los docs.

**Medición del 2026-09-02** (misma foto, mismo prompt, corridas espaciadas): Groq ~1 s, OpenAI
~1,7 s, Gemini 3,1-11,2 s. Los tres aciertan tipo, marca y detalle. Gemini sigue de default por
gratuidad y cuota holgada, pero **es el más lento y el más variable**, lo que contradice el criterio
con el que se armó el selector — decisión abierta.

**De Groq va el Qwen 3.8 y no el 3.6, aunque el 3.6 sea más rápido en el papel.** El 3.6 sólo admite
`json_object`, que deja los nombres de campo a criterio del modelo; el 3.8 admite `json_schema` con
`strict`. Sobre ~50 tokens de respuesta esos 50 tok/s son centésimas — la garantía de forma vale
más.

**El razonamiento de Gemini se apaga por `generation_config.thinking_level`.** La Interactions API
rechaza con 400 `thinking_config`, `thinking_budget`, `reasoning` y `effort`; ese es el único
parámetro que existe, y acepta `minimal | low | medium | high`. `minimal` sirve en los Flash Lite y
da 400 en los Flash grandes, que exigen al menos `low`. Sin mandarlo, el modelo piensa por defecto y
la lectura pasa de segundos a decenas de segundos.

**La lectura de producto son tres campos separados: `tipo`, `marca`, `detalle`.** No un `producto`
que mezcle qué es y de quién es: el tipo decide si el producto sirve y la marca sólo cuál de los que
sirven, y separados el anuncio puede decir uno aunque el otro no se lea.

**La cuota se respeta antes de pedir.** 20 requests por minuto **por modelo** en el tier gratuito.
Hay un limitador de ventana móvil que espera con aviso, en vez de fallar y reintentar.

**El verde es el primario, y el manual v1.0 lo confirmó.** Durante un tiempo fue una desviación
deliberada de la app respecto del manual (que asignaba ese rol al azul). En la v1.0 el manual cambió
y ahora coinciden.

**`primary` es relleno, `success` es texto.** En modo claro ningún verde cumple los dos roles:
`#1FB57A` da 6.39:1 con texto azul profundo encima, pero 2.44:1 como color de texto. En modo oscuro
coinciden. Todo el detalle, con las mediciones, en la skill `virovision-marca`.

**Prompt y schema únicos por tarea, fuera del proveedor.** `BuildRequestInput.prompts`/`schema` los
pasa el caso de uso; el proveedor sólo los coloca. Si cada proveedor tuviera su prompt, elegir otro
modelo en el selector cambiaría también la pregunta y la comparación mediría prompts, no modelos.
(Heredado del benchmark del spike, donde el principio era el mismo con los timestamps.)

## Restricciones externas que condicionan el plan

- **La cuota de Groq es por TOKENS por minuto, no por requests**: 8000 TPM y ~1974 tokens fijos por
  foto = **~4 lecturas por minuto**. Achicar la imagen no lo baja (Groq cobra la imagen a tarifa
  fija). Es el modelo más rápido y el de cuota más apretada a la vez.
- **`claude-haiku-4-5` sigue sin verificar contra la API real**: requiere tarjeta y no hay clave.
  Los otros tres se verificaron el 2026-09-02.
- **La RPi Zero 2 W (~0,5 GB) no corre Gemma.** LiteRT-LM sí corre en Raspberry Pi, así que una Pi
  más grande sería opción sin cambiar el stack de software.
