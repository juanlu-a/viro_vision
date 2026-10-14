# Carcasa VIA Clara v0.9 — dos mitades con cierre a presión

Modelo paramétrico en **OpenSCAD** (`via_clara_v0_9.scad`) para la Raspberry Pi Zero 2 W con el header
soldado, la Waveshare UPS HAT (C) unida a su batería 803040, la Raspberry Pi AI Camera y el auricular
de conducción ósea, montado sobre la patilla de los lentes. Parte de la v0.8 (`via_clara_v0_8.scad`,
que se conserva como referencia) y aplica la especificación final del 2026-10-14 más las correcciones
del mismo día. Regenerar todo: `./export.sh` (STL, imágenes y 8 verificaciones de interferencia; sale
con error si alguna pieza choca).

![Explotada, con las placas y la cámara](img/exploded_with_hardware.png)

## De dónde salen las medidas

| Componente | Fuente | Qué se tomó |
|---|---|---|
| Raspberry Pi Zero 2 W | plano mecánico oficial | 65 × 30, agujeros 58 × 23, conectores sobre el borde largo; header en el otro borde largo, pin 1 del lado de la microSD |
| AI Camera | product brief (sept. 2024), pág. 4 | PCB 25 × 23,862 × 1,12; **lente a 14,4 del borde superior**, centrado; escalones ópticos 12,8 / 10,8 / Ø5,75 hasta 2,75 / 3,875 / 6,98; conector trasero de 19,61 × 5,71 × 3,8 |
| UPS HAT (C) | wiki de Waveshare (fotos escaladas al contorno de 65 × 30; el STEP oficial es sólo el PCB) | llave, micro USB, JST y pogo pins: ver abajo |
| Header soldado | estándar 2,54 | 8,5 sobre el PCB (2,5 de plástico + 6 de pin) |

**El conjunto real**, de la cara cabeza a la cara externa: la UPS HAT abajo; encima, **la batería (40 × 30
× 8) del mismo lado que los pogo pins**; sobre ella, la Pi. Los pogo pins tocan **las colas de los pines
1–6 del header**, y por eso la Pi tiene que llevarlo soldado. Arriba de la Pi asoman los pines del header,
8,5 mm. Son **≈ 23 mm de espesor** contra los 16,5 que suponía la v0.8, y por eso el cuerpo pasó de ~24 a
**30,4 de ancho**. No había otra forma de que entrara.

**Qué hay en cada extremo** (se desprende de que los pogo pins van al pin 1):

- **Adelante, contra la cámara**: el conector CSI de la Pi y la **llave ON/OFF de la HAT**. Su palanca
  sobresale 4,4 mm del borde y se desliza a lo largo de ese borde (vertical en la carcasa).
- **Atrás**: la **microSD** de la Pi y el **micro USB de carga de la HAT**, que mira hacia atrás.

## Qué cambió respecto de la v0.8

| Especificación | v0.9 |
|---|---|
| Sin tornillos, cierre por click | **6 pestañas a presión** (3 arriba, 3 abajo) con rampa de entrada de ~19° y retención a 45°, para que se pueda abrir sin romperlas; **labio de alineación** en el resto de la junta; **2 pernos** atrás; ranura para abrir con la uña o una moneda |
| Sin tapa de cámara | la cámara queda **dentro de las dos mitades**, sujeta por **nervios en los cuatro bordes del PCB**, sin clavijas en sus agujeros y sin tocar la óptica; **una sola abertura frontal** Ø 6,4 con chaflán, centrada en el lente |
| Sin pines a través de la Raspberry | **4 almohadillas** bajo la HAT, en el patrón de 58 × 23, con **alojamiento hexagonal** (entre caras 4,9: entra un separador de 5 o una cabeza de tornillo Ø 4,5) y un **collar de plástico** para refundir con el soldador |
| Interruptor accesible | **corredera impresa** (pieza 05): una perilla con dos estrías asoma por una ventana en la cara cabeza, adelante, y una horquilla abraza la palanca de la llave. La palanca queda a ~10 mm de cualquier cara, demasiado hondo para el dedo |
| Carga | **canal en la pared trasera** a la altura del micro USB de la HAT, para la ficha moldeada (11,5 × 7,5) |
| microSD | **ranura en la pared trasera**, abocinada hacia afuera para que la uña llegue a la tarjeta (sobresale ~2,5 del borde de la Pi) |
| Un solo botón | **botón de modos**, del lado de la Pi y fuera de la banda del header, con su **cajón** para un pulsador SMD 6 × 6 × 2,5 que entra deslizando desde abajo y queda trabado. Agujero Ø 5,4 para una cabeza de Ø 5,0 (0,2 de luz por lado); un **anillo en bajorrelieve** alrededor lo hace fácil de encontrar al tacto |
| Auricular óseo, 14 mm | 14 nominales + **0,2 de holgura por lado**. El brazo es pieza aparte (va enchufado a su zócalo). Se corrió 3,1 mm junto con la cara cabeza |
| Canal para el elástico | **dos puentes** en la cara cabeza, para un elástico plano de 6 mm |

Además se corrigieron cosas de la v0.8: el lente estaba a 12,5 del borde (el plano dice 14,4); había
una ventana de 29 × 23 en la cara externa que no daba acceso a nada; la cavidad perforaba la carcasa
atrás; y el brazo óseo se metía 0,6 mm en su zócalo.

## Antes de imprimir: medir con calibre

Todo lo que no figura en ningún plano está marcado `MEASURE` en el `.scad`. Lo que más importa:

| Parámetro | Qué medir | Valor | Si está mal |
|---|---|---|---|
| `BOARD_GAP` | de la cara superior de la HAT a la cara inferior de la Pi (lo fijan los separadores) | 10,5 | si es mayor, el header toca la pared externa (hoy hay 0,6 de luz) |
| `LEVER_Y`, `LEVER_TRAVEL`, `SW_BODY_H` | altura de la palanca sobre la HAT, su recorrido y el alto de la carcasa de la llave | 2–5 / 3,3 / 7 | la horquilla de la corredera no agarra la palanca |
| `SD_Z` | posición de la microSD a lo largo del borde corto | ranura de −8 a 8,5 | la ranura no queda frente a la tarjeta |
| `STANDOFF_AF` | lo que asoma bajo la HAT: hexágono del separador o cabeza del tornillo | 5,0 | no entra o baila en la almohadilla |
| `SWITCH_T` | alto total del pulsador con el actuador | 2,5 | el botón queda flojo o siempre apretado |
| `TRANSDUCER_SIZE` | el transductor óseo | 14,0 | — |

Lo más barato para validar: imprimir primero sólo la **parte trasera** (cortar en x > 25 en el
laminador) y probar la microSD y la carga, y después la **nariz** (x < −25), para la cámara, la
corredera y las pestañas delanteras.

## Armado

1. **Almohadillas.** Sacar los cuatro tornillos de abajo de la HAT (o los separadores, según cómo venga
   el kit). Con la mitad izquierda sola, calentar cada pieza metálica con la punta del soldador
   (~200 °C para PLA), presionarla en su alojamiento hexagonal y refundir el collar encima. El
   calor no toca ninguna placa porque todavía no están.
2. **Corredera.** Desde adentro, pasar la perilla por su ventana de la cara cabeza, con la placa
   contra la pared.
3. **Electrónica.** Asentar el conjunto HAT + batería + Pi sobre las almohadillas, con la llave adelante
   y la palanca entre las dos uñas de la horquilla, y atornillarlo. Conectar el flex de la cámara y los
   cables del pulsador.
4. **Cámara.** Enfocar antes de cerrar. Apoyar el PCB en los nervios de la mitad izquierda, con el
   conector hacia abajo. El flex baja, gira y entra en el CSI de la Pi por el lado derecho (el de la
   Pi), lejos de la corredera.
5. **Auricular.** Pasar el cable por el puerto de la mitad izquierda y el canal del brazo, y enchufar
   el brazo en su zócalo.
6. **Botón.** Meter la tecla desde adentro por su agujero de la mitad derecha y deslizar el pulsador
   en su cajón desde abajo hasta que pase el escalón.
7. **Cerrar.** Presentar la mitad derecha sobre la izquierda (los pernos traseros guían) y apretar hasta
   escuchar las seis pestañas. Para abrir: uña o moneda en la ranura trasera.

## Impresión

PETG si es posible: las pestañas trabajan a ~1,2 % de deformación y el PETG la aguanta mejor que el PLA
en aperturas repetidas. Boquilla 0,4, capa 0,16, 3 perímetros, relleno 25 %.

| STL | Orientación | Soportes |
|---|---|---|
| `01_left_half_v0_9.stl` | cara cabeza abajo; apoya en el zócalo del brazo y los puentes del elástico | sí, bajo la cara plana (los puentes y el zócalo sobresalen 3,8). Bloquearlos dentro de la cavidad |
| `02_right_half_v0_9.stl` | cara externa abajo, plana; las pestañas crecen hacia arriba | no |
| `03_bone_arm_v0_9.stl` | acostado | de árbol |
| `04_mode_button_v0_9.stl` | parado sobre la brida | no |
| `05_power_slider_v0_9.stl` | parado sobre la placa | no |
| `00_assembly_check_v0_9.stl` | — | **no se imprime**: el conjunto cerrado, para revisar en el laminador |

## Archivos

```
via_clara_v0_9.scad   el modelo. PART = assembly | left | right | bone | button | slider | print_* |
                      hardware | check_*;  SHOW_HW y EXPLODE para la vista armada
via_clara_v0_8.scad   la versión anterior, sin tocar, como referencia
export.sh             regenera stl/ e img/ y corre las verificaciones
```

Las verificaciones (`check_*`) intersecan cada pieza con las maquetas del hardware y con las demás
piezas: mitades entre sí; mitades contra HAT, batería, llave, Pi, header, microSD, cámara y pulsador;
cabezas de tornillo contra almohadillas; botón; corredera; brazo; cajón contra la Pi. Todas dan vacío
(las mitades y el botón sólo se tocan en sus caras de contacto). Valen **contra las maquetas**: tanto
como las medidas de la tabla de arriba.
