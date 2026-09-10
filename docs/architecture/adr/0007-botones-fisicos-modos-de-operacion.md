# ADR 0007 — Botones físicos y modos de operación del dispositivo

- **Status:** Proposed — a validar con el tutor
- **Date:** 2026-08-22 (reunión de equipo del 2026-08-21)
- **Deciders:** ViroVision team (Juan Lucas Abreu, Magalí Dellapiazza, Francisco Tauber)
- **Tags:** hardware, app, accessibility
- **Relates to:** [ADR 0006](0006-pipelines-por-caso-de-uso.md)

## Contexto

Hasta ahora el repo no especificaba **ninguna interfaz de entrada física** para el dispositivo: la
app era la única superficie de control. Eso deja dos opciones malas para el producto real: o el
reconocimiento está siempre prendido, o el usuario saca el teléfono para activarlo.

Un reconocimiento siempre activo es hostil para el usuario objetivo: **anunciar por audio todo lo
que la cámara ve, todo el tiempo, aturde** — y el audio es la interfaz, no un accesorio. Y sacar el
teléfono en la vereda para tocar un botón de una app contradice la razón de ser del dispositivo:
manos libres, atención en el entorno.

## Decisión propuesta

**El dispositivo lleva entrada física (botón) y el reconocimiento funciona por modos explícitos**
que el usuario activa y desactiva sin teléfono:

| Gesto | Desde | Efecto |
|---|---|---|
| 1 click | Esperando | **Modo detección de ómnibus** → pipeline local detección + OCR (ADR 0006) |
| 2 clicks | Esperando | **Modo supermercado** → pipeline LLM con visión (ADR 0006, pendiente) |
| Click largo | Cualquier modo | Volver a **esperando** (apaga el reconocimiento) |
| Sin gesto | Cualquier estado | Permanece donde está |

En reposo el dispositivo está **conectado y esperando**: ni captura ni anuncia. Cada modo anuncia
por audio su activación y desactivación, para que el estado nunca sea un misterio — un usuario que
no ve la pantalla no tiene otro indicador.

El diagrama de estados canónico vive en [`docs/architecture/README.md`](../README.md); este ADR lo
referencia y no lo duplica.

## Alternativas consideradas

- **Reconocimiento siempre activo.** Rechazado: sobrecarga auditiva permanente y batería. El audio
  continuo convierte la ayuda en ruido.
- **Control solo desde la app.** Rechazado como única vía: exige sacar el teléfono justo en las
  situaciones (parada de ómnibus, góndola) donde las manos y la atención están ocupadas. La app
  sigue pudiendo controlar los modos — es la superficie de configuración — pero no puede ser la
  única.
- **Comandos de voz.** No descartado a futuro, pero un botón físico es más barato, más fiable en
  la calle (ruido ambiente) y no requiere micrófono ni modelo adicional.

## Consecuencias

**Positivas**

- El usuario controla cuándo la asistencia habla. Cero audio no solicitado.
- Interacción de un solo botón, aprendible al tacto, sin pantalla.
- Cada modo mapea 1:1 a un pipeline de ADR 0006 — el firmware no necesita lógica de decisión.

**Costos / riesgos**

- El firmware suma una máquina de estados y el debounce/temporización de clicks (umbral de click
  largo y ventana de doble click a definir con hardware real).
- El protocolo BLE (GATT) debe exponer el modo actual y sus transiciones a la app (característica
  nueva; se especifica junto con el firmware).
- Hardware sin empezar: esto es especificación por delante de la implementación, deliberadamente.

## Implicaciones para el código actual

- `app/src/features/device/gatt.ts` (hoy stub) deberá modelar el estado de modo y sus
  transiciones cuando exista firmware.
- El selector de camino del lector de Inicio (`app/src/features/reader/`) es la versión de
  desarrollo de estos modos; cuando el dispositivo exista, el modo lo fija el botón y la app lo
  refleja.

## Actualización 2026-09-09 — un gesto nombra un modo, no un paso

**Probado con el botón soldado, la máquina original no se sostuvo en la mano.** La decisión de
arriba restringía los clicks a *esperando*: dentro de un modo, el click corto quedaba reservado
"para disparar una lectura" y cambiar de ómnibus a supermercado exigía un click largo en el medio.
En la práctica el usuario hace dos clicks esperando supermercado, no pasa nada, y la lectura es que
**el botón está roto** — no que falta un gesto intermedio. Para alguien que no ve la pantalla, un
control que a veces responde y a veces no es peor que uno con menos funciones.

| Gesto | Desde | Efecto |
|---|---|---|
| 1 click | **cualquier estado** | **Modo detección de ómnibus** |
| 2 clicks | **cualquier estado** | **Modo supermercado** (saca una foto y la procesa) |
| Click largo | Cualquier modo | Volver a **esperando** |

Entrar a un modo desactiva el anterior; no hay dos modos activos a la vez, ni estado intermedio.

Se cae con esto la reserva del click corto "para disparar una lectura" dentro de un modo. No se
perdió nada: **los dos modos disparan su lectura al activarse**, cada uno según su naturaleza —
ómnibus deja la cámara en **vigilancia continua** y anuncia cada ómnibus que aparece, mientras que
supermercado es **puntual**, saca una foto en el momento y la procesa, porque el usuario está
parado frente a la góndola apuntando a un producto.

Queda abierto cómo pedir una **segunda** lectura de supermercado sin salir del modo. Hoy son dos
gestos (click largo y otra vez dos clicks). La opción natural —que repetir los dos clicks saque
otra foto— exige que el dispositivo avise cada gesto y no sólo cada cambio de modo, porque el modo
no cambia; se decide con el usuario antes de agregar superficie al protocolo.
*(Cerrado el 2026-10, abajo: se decidió la opción natural y sí hubo que agregar el evento.)*

## Actualización 2026-10 — dos clicks piden una lectura, siempre

**La pregunta que la actualización anterior dejó abierta, decidida con el usuario probándolo.** Con
la máquina de "un gesto nombra un modo", el segundo doble click frente a la góndola no hacía nada:
el modo ya era supermercado, no había transición, y la captura se disparaba con la transición. Para
leer el producto siguiente había que salir con un click largo y volver a entrar — dos gestos para
repetir uno, con el mismo síntoma que ya habíamos arreglado un nivel más arriba: **el botón se
siente muerto**.

**Decisión: un gesto de dos clicks pide una lectura, cambie o no el modo.** Un click no: ómnibus es
vigilancia y ya está mirando solo, así que repetirlo no pide nada nuevo — y si lo pidiera, cada
click costaría una foto y una llamada a la nube.

| Gesto | Desde | Efecto |
|---|---|---|
| 2 clicks | esperando u ómnibus | entra a supermercado **y lee** |
| 2 clicks | **ya en supermercado** | **lee de nuevo** (no anuncia el modo otra vez) |
| 1 click | ya en ómnibus | nada: el modo ya está vigilando |

**Cómo se implementó, y por qué así.** Tal como anticipaba el párrafo de arriba, hubo que agregar
superficie al protocolo: un evento nuevo **`{"t":"read","mode":N}`** en la característica `event`.
Las dos alternativas que se descartaron:

- *Re-anunciar el modo.* La app ignora un `mode` que nombra el modo en el que ya está —como debe,
  o cada latido hablaría— así que se perdería en silencio. Y si no se perdiera, haría decir «Modo
  supermercado activado» de nuevo: ruido para quien está leyendo tres productos seguidos.
- *Que el dispositivo saque la foto por su cuenta.* Rompe ADR 0003: la app tira, el dispositivo
  nunca empuja. Lo que viaja es la intención, no la imagen.

**Consecuencia en la app**: el pedido de lectura deja de deducirse de la transición de modo y pasa a
ser una señal explícita, con dos orígenes —el botón físico y la pantalla— que se sirven en un solo
lugar. Los dos son contadores y lo que dispara es que el total *cambie*, nunca su valor: dos pedidos
idénticos seguidos tienen que ser distinguibles, porque eso es exactamente leer dos productos
seguidos. De paso desaparece una fragilidad: el efecto anterior dependía de `read`, cuya identidad
cambia al cambiar de modelo, y llevaba una guarda para no disparar por un motivo ajeno al usuario.

**Una lectura en curso no se encola**: si llega un pedido mientras hay otro andando, se ignora y se
registra. Para cuando terminara, la foto extra sería de una escena que el usuario ya dejó atrás — y
está por escuchar el resultado de la que sí está corriendo.

## Ver también

[ADR 0006](0006-pipelines-por-caso-de-uso.md), el diagrama de modos en
[`docs/architecture/README.md`](../README.md), y
[`docs/pruebas-y-decisiones.md`](../../pruebas-y-decisiones.md).
