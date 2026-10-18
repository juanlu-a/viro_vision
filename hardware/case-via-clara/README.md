# Carcasa VIA Clara v0.10 — dos mitades con cierre a presión

Modelo paramétrico en **OpenSCAD** (`via_clara_v0_10.scad`) para la Raspberry Pi Zero 2 W con el header
soldado, la Waveshare UPS HAT (C) unida a su batería 803040, la Raspberry Pi AI Camera y el auricular
de conducción ósea, montado sobre la patilla de los lentes. Es la v0.9 corregida con lo que mostró su
primera impresión (2026-10-17). La v0.8 (`via_clara_v0_8.scad`) se conserva como referencia.
Para regenerar todo, correr `./export.sh`: arma los STL, las imágenes y las verificaciones, y sale con
error si algo falla.

![Explotada, con las placas y la cámara](img/exploded_with_hardware.png)

**Medidas exteriores: 92,9 × 28,7 × 36,6 mm** (largo × ancho × alto) del cuerpo. La v0.9 medía
91,9 × 31,4 × 37,6. Con los puentes del elástico y el zócalo del brazo, que sobresalen 3,8 de la cara
cabeza, el ancho total es 32,5. Las medidas no cuentan el brazo del auricular.

## Qué cambió después de imprimir la v0.9

| Lo que pasó en la impresión | v0.10 |
|---|---|
| Los separadores hexagonales están **del lado de la Pi** (junto al header) y bajo la HAT sólo quedan las cabezas de los tornillos Phillips | El conjunto ahora se fija a la **mitad derecha** (la externa, del lado de la Pi). Las cuatro almohadillas con su alojamiento hexagonal y su collar están ahí, y reciben los separadores que asoman sobre la Pi. Del lado de la HAT sólo hace falta luz para las cabezas de los tornillos (1,8 + 0,3) |
| Hubo que cortar el extremo trasero con una Dremel: la microSD no entraba | Atrás hay un **lugar para la tarjeta** a la altura de la Pi: 3,5 de tarjeta afuera del borde (`SD_CARD_OUT`, medir) + 1,0 de luz |
| Paredes demasiado gruesas | Costados de **1,6** (antes 2,2), arriba y abajo de **2,4** (antes 2,7; ahí viven las vigas de las trabas). La cavidad sigue al conjunto real. Las mitades llevan entre 14 y 22 % menos plástico |
| La cámara quedaba con la imagen girada 90° respecto de lo que ve el usuario | La cámara **gira 90° en su plano**: el conector del flex queda en el costado, hacia la Pi, y no abajo. Además el flex va derecho al CSI, sin retorcerse. Si la imagen sale cabeza abajo, se corrige por software (rotación de 180° en libcamera) |
| El pulsador real (6 × 6 de 4 patas, ~5 mm de alto) y la tecla no pasaban por el cajón, pensado para un SMD de 2,5 que entraba deslizando desde abajo | El pulsador va en un **bolsillo abierto hacia adentro** de la mitad derecha: primero se apoya la tecla, que tiene una brida rectangular que pasa por el bolsillo, y después el pulsador encima. Los dos entran derecho, sin deslizar. El bolsillo ajusta sobre el cuerpo del pulsador y deja lugar a las patas, y una gota de pegamento caliente lo fija |
| El soporte cuadrado del lente no entraba en el espacio frente a la cámara, y hubo que poner la cámara detrás de los nervios | Frente al PCB hay **lugar para el soporte cuadrado**: 12,0 de lado y 4,6 de alto por defecto (`AI_CAM_HOLDER`, medir). El agujero del lente es más grande (Ø 6,75) |

Además, como el flex ya no apoya en el piso de la nariz:

- la traba delantera **vuelve a tener par abajo**: son 6 trabas;
- la corredera ocupa todo el lugar detrás de la cámara y su perilla pasa de 4,4 a **9,1 mm de ancho**, mucho más fácil de encontrar al tacto.

## Antes de imprimir: medir con calibre

Todo lo que no figura en ningún plano está marcado `MEASURE` en el `.scad`. Lo nuevo de esta versión
va primero:

| Parámetro | Qué medir | Valor | Si está mal |
|---|---|---|---|
| `HEX_H`, `HEX_AF` | los separadores hexagonales que asoman **sobre la Pi**: cuánto sobresalen de la cara de la Pi, y entre caras | 6,0 / 5,0 | no entran en la almohadilla o quedan flojos; si sobresalen más que el header (8,5), la carcasa se ensancha sola |
| `SCREW_HEAD_H`, `SCREW_HEAD_D` | las cabezas de los tornillos bajo la HAT | 1,8 / 4,5 | tocan la pared del lado de la cabeza |
| `SD_CARD_OUT` | cuánto sobresale la microSD del borde de la Pi (o cuánto se cortó con la Dremel) | 3,5 | la tarjeta vuelve a chocar atrás |
| `AI_CAM_HOLDER` | el soporte cuadrado del lente: lado, y cuánto sobresale de la cara del PCB | 12,0 / 4,6 | la cámara no llega a su ranura |
| `BOARD_GAP` | de la cara superior de la HAT a la cara inferior de la Pi | 11,3 | en la v0.9 entró bien |
| `LEVER_Y`, `LEVER_TRAVEL`, `SW_BODY_H` | altura de la palanca sobre la HAT, su recorrido y el alto de la carcasa de la llave | 2–5 / 3,3 / 7 | la horquilla no agarra la palanca o no la lleva hasta el final |
| `PI_PORT_OVERHANG` | cuánto sobresalen el mini HDMI y los micro USB del borde de la Pi | 0,8 | si es más de 0,9, tocan la pared de abajo |
| `SWITCH_T` | alto total del pulsador de 6 × 6, con el actuador (los hay de 4,3 y de 5,0) | 5,0 | el botón queda flojo o siempre apretado |
| `PI_PARTS_LOW` | lo más alto de la cara de la Pi debajo del botón (el chip del centro) | 1,6 | las patas recortadas del pulsador quedan a 0,5 de la Pi |
| `TRANSDUCER_SIZE` | el transductor óseo | 14,0 | — |

Antes de imprimir la carcasa entera, conviene imprimir sólo la **nariz** (cortar en x < −25 en el
laminador) para probar la cámara rotada, su soporte y la corredera. Después, la **parte trasera**
(x > 25) para probar la microSD y la carga.

## Dónde están los archivos para imprimir

Los STL **no viven en el repo**: van al Drive de ViroVision, en una carpeta `modelo_3d` con una
subcarpeta por versión. El repo guarda lo que los genera (`.scad` y `export.sh`) y las imágenes.
`./export.sh` los vuelve a crear en `stl/`, que git ignora. Al sacar una versión nueva, hay que subir
`stl/`, `img/guide/` y este README a una carpeta nueva dentro de `modelo_3d`.

## Guía con flechas

`img/guide/` tiene cinco vistas con flechas que dicen para qué es cada ranura, agujero y pieza. Las
genera `export.sh` a partir de `via_clara_v0_10_guide.scad`:

| Vista | Qué muestra |
|---|---|
| `outer.png` | cara externa: botón de modos, anillo táctil, carga, ranura para abrir |
| `head.png` | cara cabeza: perilla de encendido y su punto ON, puentes del elástico, zócalo y brazo del auricular, lente |
| `left_inside.png` | adentro de la mitad izquierda: ranura de la cámara, corredera, paso del cable, carga, ranuras de las trabas |
| `right_inside.png` | adentro de la mitad derecha: almohadillas y collares, vigas y ganchos de las trabas, puentes a cortar, cajón del pulsador, recorrido del flex, lugar de la microSD |
| `exploded.png` | despiece con las placas: qué pieza es cada una |

![Adentro de la mitad derecha](img/guide/right_inside.png)
![Cara cabeza](img/guide/head.png)

## De dónde salen las medidas

| Componente | Fuente | Qué se tomó |
|---|---|---|
| Raspberry Pi Zero 2 W | plano mecánico oficial | 65 × 30, agujeros 58 × 23, conectores sobre un borde largo; header sobre el otro, con el pin 1 del lado de la microSD |
| AI Camera | product brief (sept. 2024), pág. 4, y la impresión de la v0.9 | PCB 25 × 23,862 × 1,12; lente a 14,4 del borde opuesto al conector, centrado en el lado de 25; barril Ø 5,75 hasta 6,98; conector trasero de 19,61 × 5,71 × 3,8. El soporte cuadrado del lente resultó más grande que en el plano |
| UPS HAT (C) | wiki de Waveshare (fotos escaladas al contorno de 65 × 30) | llave, micro USB, JST y pogo pins |
| Header soldado | estándar 2,54 | 8,5 sobre el PCB y 3 de colas debajo |
| Conjunto armado | la impresión de la v0.9 | separadores hexagonales sobre la Pi, tornillos Phillips bajo la HAT; la separación HAT–Pi de 11,3 entró bien |

**El conjunto**, de la cara cabeza a la cara externa:

1. Las cabezas de los tornillos Phillips (1,8 + 0,3 de luz).
2. La UPS HAT.
3. La batería (40 × 30 × 8), del mismo lado que los pogo pins.
4. La Pi.
5. Encima de la Pi, el header (8,5) y los separadores hexagonales.

Los pogo pins tocan las colas de los pines 1–6 del header. La cavidad mide 25,5 de ancho y el cuerpo
28,7. El modelo calcula el ancho a partir del conjunto (`CAV_HY`), así que si las medidas reales son
menores, la carcasa se achica sola.

**Qué hay en cada extremo:**

- **Adelante:** el conector CSI de la Pi y la llave ON/OFF de la HAT, contra la cámara.
- **Atrás:** la microSD y, debajo, el micro USB de carga de la HAT.

## Qué hace cada parte

| Especificación | v0.10 |
|---|---|
| Sin tornillos, cierre por click | **6 trabas a presión**, 3 arriba y 3 abajo. Cada una es una **viga** de 6 a 10 mm que corre a lo largo de la junta, dentro de la pared de la mitad derecha. En la punta lleva un **gancho** que cruza la junta y cae en una ranura de la mitad izquierda: para abrir o cerrar, la viga flexiona ~0,35 mm, dentro del plano de la cama. Cada viga se imprime atada por un **puente en la ranura de su extremo, que hay que cortar después de imprimir**. Además hay un labio de alineación en el resto de la junta, 2 pernos atrás y una ranura para abrir con la uña |
| Sin tapa de cámara | la cámara queda **dentro de las dos mitades**: el PCB entra en una **ranura** con nervios adelante y atrás, 0,15 de luz en los bordes y cuatro nervios de aplastamiento arriba y abajo. **Una sola abertura frontal**, centrada en el lente |
| Flex de la cámara | sale del conector por el costado de la cámara que mira a la Pi, corre pegado a la pared externa y baja al CSI. Ese recorrido está reservado (verificación `flex`) |
| Sin pines a través de la Raspberry | **4 almohadillas en la mitad derecha** reciben los separadores hexagonales que asoman sobre la Pi, y un **collar de plástico** se refunde sobre cada uno con el soldador. El collar queda a 3,4 mm de la Pi |
| Interruptor accesible | **corredera impresa** (pieza 05): una perilla de **9,1 × 4 mm**, 1,5 en relieve, con tres estrías y un **punto en relieve que marca el lado ON**. Asoma por una ventana adelante en la cara cabeza, y una horquilla toma la palanca de la llave de punta a punta: ON abajo, OFF arriba |
| Carga | canal en la pared trasera a la altura del micro USB de la HAT, para la ficha moldeada |
| microSD | **queda adentro**: es sólo para el equipo, y para sacarla se abre la carcasa. Atrás tiene lugar de sobra |
| Un solo botón | **botón de modos** en la cara externa, con un **anillo en bajorrelieve** para encontrarlo al tacto. La tecla y el pulsador de 6 × 6 de 4 patas entran derecho desde adentro en su bolsillo (verificaciones `cap_insert` y `switch_insert`); una gota de pegamento caliente fija el pulsador |
| Auricular óseo, 14 mm | 14 nominales + 0,2 de holgura por lado. El brazo es pieza aparte y sigue a la cara cabeza |
| Canal para el elástico | **dos puentes** en la cara cabeza, para un elástico plano de 6 mm |

## Armado

Ahora el conjunto va en la **mitad derecha** (la externa). Hay que poner primero el botón, que queda debajo de la Pi.

1. **Botón.** Cortar las cuatro patas del pulsador a ~1,5 mm y soldarle los cables saliendo **de costado**,
   no hacia abajo, porque debajo está la Pi. En la mitad derecha, apoyada sobre su cara externa, dejar
   caer la tecla en su bolsillo, con la cabeza hacia el agujero, y después el pulsador encima, con el
   actuador hacia la tecla y las patas a los costados largos del bolsillo. Fijarlo con una gota de
   pegamento caliente en los bordes. Los cables van al GPIO de la Pi.
2. **Electrónica.** Bajar el conjunto HAT + batería + Pi entero, **con la Pi hacia abajo**, sobre la
   mitad derecha. Los cuatro separadores hexagonales entran en las almohadillas (verificación
   `stack_insert`).
3. **Fijar los separadores.** Con la punta del soldador (~200 °C para PLA), refundir el collar de cada
   almohadilla sobre su separador. Hacerlo de a uno, unos segundos en cada uno: el collar está a 3,4 mm
   de la Pi.
4. **Cámara.** Enfocar antes de cerrar. Conectar el flex a la cámara y al CSI de la Pi. Bajar el PCB
   dentro de la ranura, con el conector hacia la Pi (hacia la mitad derecha), la óptica por la ventana y
   el soporte cuadrado del lente frente a su lugar. El flex corre pegado a la pared externa.
5. **Corredera.** En la mitad izquierda, desde adentro, pasar la perilla por su ventana de la cara
   cabeza, con la horquilla hacia adentro. Dejarla **arriba del todo (OFF)**, y la llave de la HAT
   también en **OFF**.
6. **Auricular.** Pasar el cable por el puerto de la mitad izquierda y el canal del brazo, y enchufar
   el brazo en su zócalo.
7. **Cerrar.** Bajar la mitad izquierda sobre la derecha. La palanca de la llave entra en la horquilla
   de la corredera (verificación `lever_insert`) y los pernos traseros guían. Apretar hasta escuchar las
   seis trabas. Para abrir: uña o moneda en la ranura trasera.

## Impresión

PETG si es posible (aguanta mejor las aperturas repetidas); PLA también sirve. Boquilla 0,4, capa 0,16,
3 perímetros, relleno 25 %.

| STL | Orientación | Soportes |
|---|---|---|
| `01_left_half_v0_10.stl` | cara cabeza abajo; apoya en las caras planas del zócalo del brazo y de los dos puentes del elástico | sí, bajo la cara cabeza; bloquearlos dentro de la cavidad |
| `02_right_half_v0_10.stl` | cara externa abajo, plana; las trabas y las almohadillas crecen hacia arriba | sólo bajo el ahusado trasero y la punta de la nariz. Después de imprimir, **cortar los 6 puentes** de las vigas de las trabas, contra la punta de cada viga |
| `03_bone_arm_v0_10.stl` | acostado | de árbol |
| `04_mode_button_v0_10.stl` | parado sobre la brida | no |
| `05_power_slider_v0_10.stl` | acostado sobre su cara lateral plana | no |
| `00_assembly_check_v0_10.stl` | — | **no se imprime**: el conjunto cerrado, para revisar en el laminador |

## Archivos y verificaciones

```
via_clara_v0_10.scad         el modelo. PART = assembly | left | right | bone | button | slider |
                             print_* | hardware | check_*;  SHOW_HW y EXPLODE para la vista armada
via_clara_v0_10_guide.scad   la guía con flechas (img/guide/); no se imprime
via_clara_v0_8.scad          la versión de partida, sin tocar, como referencia
export.sh                    regenera stl/ e img/ y corre las verificaciones
```

`export.sh` comprueba que cada pieza imprimible sea **un solo sólido** que apoya en la cama, y corre
**15 verificaciones** de interferencia, que tienen que dar vacío o un contacto de volumen cero:

- las mitades entre sí;
- cada mitad contra las placas, la batería, la llave, la cámara, el pulsador, las cabezas de los tornillos y los separadores hexagonales;
- las almohadillas;
- el botón;
- la corredera en ON y en OFF;
- el recorrido del flex;
- las maquetas entre sí;
- el brazo;
- el cajón;
- los caminos de armado: la tecla y el pulsador entrando al cajón, el conjunto bajando a las almohadillas y la palanca entrando a la horquilla.

Valen **contra las maquetas**: tanto como las medidas de la tabla de arriba.
