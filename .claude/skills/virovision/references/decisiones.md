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

### ADR 0004 — Runtime de inferencia on-device · **Proposed — a discutir con el tutor**

**Gemma vía LiteRT-LM**, empezando por la variante más chica, con la cámara del teléfono como
fuente. Descarta MediaPipe LLM Inference (en mantenimiento) y Core ML + Apple Vision (cierra la
plataforma a iOS).

Restricción encontrada y anotada: **el sandbox de iOS impide usar el Gemma que corre dentro de otra
app**. Tenerlo andando en Edge Gallery prueba que el hardware da, pero no acerca el producto.

**La pregunta que este ADR NO cierra, y que es de alcance de tesis, no técnica:** si Gemma
multimodal lee el cartel directamente, el pipeline **YOLO + OCR** deja de ser necesario en el camino
del teléfono — y eso borraría buena parte de la tarea B1 del roadmap, que el documento de tesis
describe como *el* método. Recomendación registrada: **conservar los dos y medirlos uno contra
otro**; el benchmark ya construido mide con la misma vara cualquier backend, así que el costo
marginal de comparar es bajo y el valor para la tesis es alto.

### ADR 0005 — Design system y estándares de accesibilidad · **planeado, sin escribir**

Buena parte ya está implementada (tokens, `theme.test.ts`, tipografía de marca); falta escribirla.

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
