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

### ADR 0006 — Pipelines por caso de uso · **Proposed (2026-08-22) — a validar con tutor**

**Qué cambió**: deja de haber un runtime único (lo que buscaba ADR 0004). Cada caso de uso tiene su
pipeline. **Bondis = local** (la latencia manda): detección **preentrenada en la Coral TPU** del
dispositivo → recorte del banner → OCR sobre el recorte — la TPU pasa de "correr los modelos
completos" a **preprocesadora**, y al celular llega el recorte, no el frame. **Supermercado = LLM
con visión** (la complejidad manda), elección **PENDIENTE**: Gemma 3 1B local (~700 MB) vs. Gemini
Flash nube, con la restricción dura de que sea **gratuito para el usuario** (exigir credenciales
propias rompe la accesibilidad). La precisión del proyecto se mide con **datasets de evaluación**
(esperado vs. obtenido → recall, precision, accuracy, F1) — de evaluación, no de entrenamiento: la
tarea B1 cambia de "entrenar" a "evaluar". Ver `docs/pruebas-y-decisiones.md`.

### ADR 0007 — Botones físicos y modos de operación · **Proposed (2026-08-22) — a validar con tutor**

**Qué cambió**: hasta ahora no había ninguna interfaz de entrada física especificada. El
reconocimiento funciona por **modos explícitos** activados con el botón del dispositivo — nunca
audio no solicitado. Desde *esperando*: 1 click = modo ómnibus (pipeline local), 2 clicks = modo
supermercado (pipeline LLM), click largo = volver a esperando. Cada transición se anuncia por
audio. Diagrama canónico en `docs/architecture/README.md`.

## Decisiones sin ADR, pero vigentes

**Gemini por sobre Anthropic en el benchmark.** No es una preferencia técnica: es que tiene tier
gratuito, y que es de la **misma familia que Gemma**, así que los números son más comparables contra
lo que después va a correr local. Anthropic exige billing. El modelo por defecto es
`gemini-flash-lite-latest`, el más rápido — la prioridad declarada es **velocidad sobre precisión**,
porque la tarea es leer dos campos de un cartel.

**La cuota se respeta antes de pedir.** 20 requests por minuto **por modelo** en el tier gratuito.
Hay un limitador de ventana móvil que espera con aviso; y espera **antes** de arrancar el
cronómetro, para no contaminar la latencia medida.

**El verde es el primario, y el manual v1.0 lo confirmó.** Durante un tiempo fue una desviación
deliberada de la app respecto del manual (que asignaba ese rol al azul). En la v1.0 el manual cambió
y ahora coinciden.

**`primary` es relleno, `success` es texto.** En modo claro ningún verde cumple los dos roles:
`#1FB57A` da 6.39:1 con texto azul profundo encima, pero 2.44:1 como color de texto. En modo oscuro
coinciden. Todo el detalle, con las mediciones, en la skill `virovision-marca`.

**La medición se toma en un solo lugar.** Los timestamps del benchmark se toman en `benchmark.ts` y
sólo ahí, para que los proveedores sean comparables por construcción. Si cada proveedor midiera por
su cuenta, los números dejarían de ser comparables sin que nadie lo note — que es exactamente el
error que arruinaría el experimento.

## Restricciones externas que condicionan el plan

- **Provisioning gratuito de Apple**: la app caduca a los 7 días y sólo se instala enchufando el
  teléfono a esta Mac. Distribuir a los compañeros de tesis requiere cuenta paga (USD 99/año) o ir
  por Android.
- **La RPi Zero 2 W (~0,5 GB) no corre Gemma.** LiteRT-LM sí corre en Raspberry Pi, así que una Pi
  más grande sería opción sin cambiar el stack de software.
