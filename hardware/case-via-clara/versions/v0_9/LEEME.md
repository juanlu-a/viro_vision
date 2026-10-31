# Carcasa VIA Clara v0.9 — dos mitades con cierre a presión

Modelo paramétrico en **OpenSCAD** (`via_clara_v0_9.scad`) para la Raspberry Pi Zero 2 W con el header
soldado, la Waveshare UPS HAT (C) unida a su batería 803040, la Raspberry Pi AI Camera y el auricular
de conducción ósea, montado sobre la patilla de los lentes. Parte de la v0.8 (`via_clara_v0_8.scad`,
que se conserva como referencia) y aplica la especificación final del 2026-10-14, las correcciones del
mismo día y una revisión con varios modelos. Regenerar todo: `./export.sh` (STL, imágenes y
verificaciones; sale con error si algo falla).

![Explotada, con las placas y la cámara](img/exploded_with_hardware.png)

**Medidas exteriores: 91,9 × 31,4 × 37,6 mm** (largo × ancho × alto) del cuerpo; con los puentes del elástico y el zócalo del brazo, que sobresalen 3,8 de la cara cabeza, el ancho total es 35,2. Sin contar el brazo del auricular.

## Guía con flechas

`img/guide/` tiene cinco vistas con flechas que dicen para qué es cada ranura, agujero y pieza. Las
genera `export.sh` a partir de `via_clara_v0_9_guide.scad`:

| Vista | Qué muestra |
|---|---|
| `outer.png` | cara externa: botón de modos, anillo táctil, carga, ranura para abrir |
| `head.png` | cara cabeza: perilla de encendido y su punto ON, puentes del elástico, zócalo y brazo del auricular, lente |
| `left_inside.png` | adentro de la mitad izquierda: almohadillas y collares, ranura de la cámara, recorrido del flex, corredera, paso del cable, carga, microSD |
| `right_inside.png` | adentro de la mitad derecha: vigas y ganchos de las trabas, puentes a cortar, cajón y canal del pulsador, pernos, labio |
| `exploded.png` | despiece con las placas: qué pieza es cada una |

![Cara cabeza](img/guide/head.png)
![Adentro de la mitad izquierda](img/guide/left_inside.png)

## De dónde salen las medidas

| Componente | Fuente | Qué se tomó |
|---|---|---|
| Raspberry Pi Zero 2 W | plano mecánico oficial | 65 × 30, agujeros 58 × 23, conectores sobre un borde largo; header sobre el otro, con el pin 1 del lado de la microSD |
| AI Camera | product brief (sept. 2024), pág. 4 | PCB 25 × 23,862 × 1,12; **lente a 14,4 del borde superior**, centrado; escalones ópticos 12,8 / 10,8 / Ø5,75 hasta 2,75 / 3,875 / 6,98; conector trasero de 19,61 × 5,71 × 3,8 |
| UPS HAT (C) | wiki de Waveshare (fotos escaladas al contorno de 65 × 30; el STEP oficial es sólo el PCB) | llave, micro USB, JST y pogo pins: ver abajo |
| Header soldado | estándar 2,54 | 8,5 sobre el PCB (2,5 de plástico + 6 de pin) y **3 de colas** debajo |

**El conjunto real**, de la cara cabeza a la cara externa: la UPS HAT abajo; encima, **la batería (40 × 30
× 8) del mismo lado que los pogo pins**; sobre ella, la Pi. Los pogo pins tocan **las colas de los pines
1–6 del header**, y por eso la Pi tiene que llevarlo soldado. Entre la HAT y la Pi tienen que entrar la
batería (8) y las colas del header que quedan encima de ella (3), más 0,3 de luz: **11,3 mm**. Arriba de
la Pi asoman los pines del header, 8,5 mm. Con las almohadillas y las paredes da una cavidad de **27,0 de
ancho** y un cuerpo de **31,4**. El modelo calcula ese ancho a partir del conjunto (`CAV_HY`), así que
si las medidas reales son menores, la carcasa se achica sola.

**Qué hay en cada extremo** (se desprende de que los pogo pins van al pin 1):

- **Adelante, contra la cámara**: el conector CSI de la Pi y la **llave ON/OFF de la HAT**. Su palanca
  sobresale 4,4 mm del borde y se desliza a lo largo de ese borde (vertical en la carcasa).
- **Atrás**: la **microSD** de la Pi y, debajo, el **micro USB de carga de la HAT**, que mira hacia atrás.

## Qué hace cada parte

| Especificación | v0.9 |
|---|---|
| Sin tornillos, cierre por click | **5 trabas a presión**: 3 arriba y 2 abajo; la de adelante no tiene par abajo porque ahí apoya el flex de la cámara, y en su lugar va un labio de alineación. Cada una es una **viga** de 6 a 10 mm que corre a lo largo de la junta, dentro de la pared de la mitad derecha. En la punta lleva un **gancho** que cruza la junta y cae en una ranura de la mitad izquierda; para abrir (o cerrar) la viga tiene que flexionar ~0,4 mm. La rampa de entrada tiene ~24° y la cara de retención 45°, para que se pueda abrir sin romperla. La viga flexiona **dentro del plano de la cama**, no a través de las capas, y trabaja a 0,5–1,1 % de deformación. Se imprime atada a la pared por un **puente que llena la ranura del extremo libre**, unido a la viga por una franja de 0,4 mm, para que salga como puente y no cuelgue: **hay que cortarlo después de imprimir**, metiendo un cúter derecho por esa ranura y cortando contra la cara del extremo de la viga. Detrás de la viga quedan 0,7 mm de luz para que el puente pueda combarse sin pegarse a la pared. Además hay un **labio de alineación** en el resto de la junta, **2 pernos** atrás y una ranura para abrir con la uña o una moneda |
| Sin tapa de cámara | la cámara queda **dentro de las dos mitades**: el PCB entra en una **ranura** con nervios adelante y atrás (0,8 sobre el borde), 0,15 de luz en los cuatro bordes y **cuatro nervios de aplastamiento** en los bordes de arriba y de abajo, que tocan el borde 0,05 para reducir el juego vertical (a esa escala dependen de la impresora; en el peor caso queda la luz de 0,15). A los costados no hay: estarían cruzados en el camino de entrada de la placa, y ahí alcanza la luz de 0,15 (el agujero del lente tiene 0,42). Sin clavijas en sus agujeros y sin tocar la óptica. **Una sola abertura frontal** Ø 6,6 con chaflán, centrada en el lente; es sólo de paso: el que ubica la placa es la ranura, no el barril |
| Flex de la cámara | la nariz es 6 mm más larga que en la v0.8, y quedan **8,5 mm** entre el conector de la cámara y el borde de la Pi. El recorrido está reservado y ninguna pieza puede entrar ahí (verificación `flex`): el flex baja del conector, corre por el piso de la cámara, sube a todo su ancho entre el conector y la corredera (x −38 a −35), se dobla a 45° y entra plano al CSI del lado de la Pi |
| Sin pines a través de la Raspberry | **4 almohadillas** bajo la HAT, en el patrón de 58 × 23. Los **separadores de bronce** del conjunto asoman por debajo de la HAT: entran en un **alojamiento hexagonal** y se fijan refundiendo un **collar de plástico** sobre ellos con el soldador. El conjunto entra entero, sin desarmar nada, y el collar queda 0,7 mm por debajo de la placa |
| Interruptor accesible | **corredera impresa** (pieza 05): una perilla de 4,4 × 4 mm, 1,5 mm en relieve y con tres estrías, con un **punto en relieve debajo de la ventana que marca el lado ON**; asoma por una ventana adelante en la cara cabeza; una horquilla abraza la palanca de la llave. Lleva la palanca de punta a punta: ON abajo, OFF arriba (verificaciones `slider_on` y `slider_off`). La palanca queda a ~10 mm de cualquier cara, demasiado hondo para el dedo |
| Carga | **canal en la pared trasera** a la altura del micro USB de la HAT, para la ficha moldeada (11,5 × 7,5) |
| microSD | **queda adentro**: es sólo para el equipo, y para sacarla se abre la carcasa. La pared trasera tiene un hueco interior para la punta de la tarjeta, que sobresale ~2,5 del borde de la Pi |
| Un solo botón | **botón de modos** en la cara externa, del lado de la Pi y fuera de la banda del header. Agujero Ø 5,4 para una cabeza de Ø 5,0 (0,2 de luz por lado). Un **anillo en bajorrelieve** alrededor lo hace fácil de encontrar al tacto. La tecla y después el pulsador SMD 6 × 6 × 2,5 suben por un canal desde la cavidad hasta su **cajón**; el pulsador queda justo (0,1 de luz por lado) con 0,15 de luz bajo la tecla, y una gota de pegamento lo fija. Las verificaciones `cap_insert` y `switch_insert` recorren el camino de entrada, no sólo la posición final |
| Auricular óseo, 14 mm | 14 nominales + **0,2 de holgura por lado**. El brazo es pieza aparte (va enchufado a su zócalo) y se corrió junto con la cara cabeza |
| Canal para el elástico | **dos puentes** en la cara cabeza, para un elástico plano de 6 mm |

Además se corrigieron cosas de la v0.8: el lente estaba a 12,5 del borde (el plano dice 14,4); había
una ventana de 29 × 23 en la cara externa que no daba acceso a nada; la cavidad perforaba la carcasa
atrás; y el brazo óseo se metía 0,6 mm en su zócalo.

## Antes de imprimir: medir con calibre

Todo lo que no figura en ningún plano está marcado `MEASURE` en el `.scad`. Lo que más importa:

| Parámetro | Qué medir | Valor | Si está mal |
|---|---|---|---|
| `BOARD_GAP` | de la cara superior de la HAT a la cara inferior de la Pi (lo fijan los separadores). Mirar también que las colas del header **no toquen la batería** | 11,3 | la carcasa se ajusta sola; si las colas apoyan en la batería, hay que cortarlas (salvo las de los pines 1–6, que tocan los pogo pins) |
| `LEVER_Y`, `LEVER_TRAVEL`, `SW_BODY_H` | altura de la palanca sobre la HAT, su recorrido y el alto de la carcasa de la llave | 2–5 / 3,3 / 7 | la horquilla no agarra la palanca o no la lleva hasta el final |
| `PI_PORT_OVERHANG` | cuánto sobresalen el mini HDMI y los micro USB del borde de la Pi | 0,8 | si es más de 0,9, tocan la pared de abajo |
| `STUB_AF`, `STUB_LEN` | los separadores de bronce que asoman bajo la HAT: entre caras del hexágono (o diámetro) y cuánto asoman | 5,0 / 3,0 | no entran en la almohadilla, o el collar queda pegado a la placa (si asoman menos de 2,3) |
| `SWITCH_T` | alto total del pulsador con el actuador | 2,5 | el botón queda flojo o siempre apretado |
| `TRANSDUCER_SIZE` | el transductor óseo | 14,0 | — |

La nariz tiene una sola traba (arriba); abajo la sostienen el labio de alineación y la traba de x −12.
Si al probar se abre abajo, hay que alargar el labio o mover la traba delantera: abajo no puede ir otra
traba sin tocar el recorrido del flex. Antes de imprimir la
carcasa entera conviene imprimir **una traba suelta** y probar la fuerza de cierre.

Lo más barato para validar: imprimir primero sólo la **parte trasera** (cortar en x > 25 en el laminador)
y probar la carga; después la **nariz** (x < −25), para la cámara, el flex, la corredera y
las trabas delanteras.

## Armado

1. **Corredera.** En la mitad izquierda, desde adentro, pasar la perilla por su ventana de la cara
   cabeza, con la placa contra la pared y la horquilla abierta hacia arriba. Dejarla **arriba del todo
   (OFF)**.
2. **Electrónica.** El conjunto HAT + batería + Pi va entero, sin desarmar nada. Poner la llave de la HAT
   en **OFF** y bajar el conjunto sobre la mitad izquierda: los cuatro separadores de bronce que asoman
   bajo la HAT entran en las almohadillas, y la palanca de la llave entra en la horquilla de la
   corredera (verificación `lever_insert`).
3. **Fijar los separadores.** Con la punta del soldador (~200 °C para PLA), refundir el collar de cada
   almohadilla sobre su separador. El collar queda 0,7 mm por debajo de la HAT: el soldador toca
   plástico y bronce, nunca la placa. Hacerlo de a uno, sin quedarse más de unos segundos en cada uno.
4. **Cables.** Soldar los cables del pulsador al GPIO de la Pi; el pulsador se coloca en el paso 7.
5. **Cámara.** Enfocar antes de cerrar. Conectar el flex a la cámara y al CSI de la Pi: baja del
   conector, corre bajo la cámara y sube al CSI por el lado de la Pi (derecho), lejos de la corredera.
   La ranura está abierta sólo hacia el plano de corte: bajar el PCB perpendicular a ese plano, dentro
   de la ranura de la mitad izquierda, con el conector hacia abajo, la óptica por la ventana y el
   conector en su corte, hasta el tope. La mitad derecha la encierra al cerrar.
6. **Auricular.** Pasar el cable por el puerto de la mitad izquierda y el canal del brazo, y enchufar
   el brazo en su zócalo.
7. **Botón.** En la mitad derecha, subir la tecla por el canal que hay debajo del cajón, con la brida
   hacia adentro, y empujarla hacia afuera hasta que la cabeza salga por su agujero. Después subir el
   pulsador por el mismo canal hasta el fondo del cajón (queda sosteniendo la tecla), fijarlo con una
   gota de pegamento.
8. **Cerrar.** Presentar la mitad derecha sobre la izquierda (los pernos traseros guían) y apretar hasta
   escuchar las cinco trabas. Para abrir: uña o moneda en la ranura trasera.

## Impresión

PETG si es posible (aguanta mejor las aperturas repetidas); PLA también sirve. Boquilla 0,4, capa 0,16,
3 perímetros, relleno 25 %.

| STL | Orientación | Soportes |
|---|---|---|
| `01_left_half_v0_9.stl` | cara cabeza abajo; apoya en las caras planas del zócalo del brazo y de los dos puentes del elástico (todas a 3,8 de la cara) | sí, bajo la cara cabeza; bloquearlos dentro de la cavidad |
| `02_right_half_v0_9.stl` | cara externa abajo, plana; las trabas crecen hacia arriba | sólo bajo el ahusado trasero y la punta de la nariz. El respaldo del pulsador es un puente de 8,6 mm: sale sin soporte. Después de imprimir, **cortar los 5 puentes** que atan las vigas de las trabas, contra la punta de cada viga |
| `03_bone_arm_v0_9.stl` | acostado | de árbol |
| `04_mode_button_v0_9.stl` | parado sobre la brida | no |
| `05_power_slider_v0_9.stl` | acostado sobre su cara lateral plana | no |
| `00_assembly_check_v0_9.stl` | — | **no se imprime**: el conjunto cerrado, para revisar en el laminador |

## Archivos y verificaciones

```
via_clara_v0_9.scad   el modelo. PART = assembly | left | right | bone | button | slider | print_* |
                      hardware | check_*;  SHOW_HW y EXPLODE para la vista armada
via_clara_v0_9_guide.scad   la guía con flechas (img/guide/); no se imprime
via_clara_v0_8.scad   la versión anterior, sin tocar, como referencia
export.sh             regenera stl/ e img/ y corre las verificaciones
```

`export.sh` comprueba que **cada pieza imprimible sea un solo sólido** y corre 14 verificaciones de
interferencia, que tienen que dar vacío o un contacto de volumen cero:

- las dos mitades entre sí;
- cada mitad contra la HAT, la batería, la llave, la Pi con su header, sus colas y sus conectores, la
  microSD, la cámara y el pulsador;
- los separadores de bronce contra las almohadillas;
- el botón;
- la corredera en ON y en OFF;
- el volumen reservado para el flex;
- las maquetas entre sí;
- el brazo;
- el cajón contra la Pi;
- **los caminos de armado**: la tecla y el pulsador subiendo a su cajón, y la palanca de la llave bajando
  a la horquilla de la corredera.

Valen **contra las maquetas**: tanto como las medidas de la tabla de arriba.
