# Carcasa VIA Clara v0.21: dos mitades con cierre a presión

Modelo paramétrico en **OpenSCAD** (`via_clara_v0_21.scad`) para la Raspberry Pi Zero 2 W con el header
soldado, la Waveshare UPS HAT (C) unida a su batería 803040, la Raspberry Pi AI Camera y el auricular
de conducción ósea, montado sobre la patilla de los lentes. La v0.20 se imprimió y se armó completa el
2026-10-30 y quedó perfecta, pero puesta la foto salía girada 90°. La v0.21 es **la v0.20 girada entera un
cuarto de vuelta**; todavía no se imprimió. La v0.8 (`via_clara_v0_8.scad`) se conserva como referencia.
Para regenerar todo, correr `./export.sh`: arma los STL, las imágenes y las verificaciones, y sale con
error si algo falla.

![Explotada, con las placas y la cámara](img/exploded_with_hardware.png)

Puesta, la carcasa mide **87,2 mm de largo, 28,5 de alto y sobresale 37,2 de la patilla**, sin contar el
brazo del auricular (la v0.20, al revés: 37,2 de alto y 28,5 hacia afuera).

## La v0.21: toda la carcasa girada

La foto sale derecha cuando la cara de la HAT mira hacia arriba. Un giro de 90° no se puede corregir por
software, porque el detector del ómnibus corre dentro del sensor. Por eso se giró la carcasa entera, con
todo lo de adentro, **con la cara de la HAT arriba**: así la foto sale derecha sin invertir nada. Puesta:

- **arriba, la cara de la HAT, con el switch de encendido**; su marca de fin de recorrido es un punto
  hundido, para que esa cara quede plana al imprimir;
- **abajo, la cara de la Pi, con el botón**, centrado en esa cara;
- **contra la patilla, la cara que antes era la de abajo**, con los puentes del elástico y el zócalo del
  brazo, y el transductor en el mismo lugar respecto de la cabeza que antes;
- el corte entre las mitades gira con todo: queda **horizontal**, una mitad arriba (la de la HAT) y otra
  abajo (la de la Pi).

Adentro casi no cambia nada respecto de la v0.20 impresa: guías de la cámara, zócalos hexagonales, labios,
switch y bolsillo del botón son los mismos. Cambia:

- el botón, al medio de la cara de la Pi (x −4 en vez de −14); sigue libre del disipador;
- los puentes del elástico y el zócalo del brazo quedan sobre la junta: cada mitad lleva la mitad de cada
  uno, y armados forman la pieza entera; al imprimir quedan de costado y piden un poco de soporte bajo su
  extremo más alejado de la junta;
- el paso del cable del auricular atraviesa esa cara fuera de la junta, en la mitad de la HAT; adentro
  da entre la HAT y la Pi, junto al conector JST de la batería de la HAT, que llega hasta ahí; el paso
  mide Ø 3 y el agujero del tapón del brazo Ø 2,6, como el túnel del brazo;
- la traba de atrás se corrió 3 mm hacia atrás (x 33) para no cruzarse con ese paso; el zócalo y el tapón
  son 0,5 mm menos profundos, para dejar 1,25 mm de material sobre esa traba (verificación `socket_skin`),
  y el agujero del tapón deja 1,2 mm de pared (verificación `plug_wall`).

Una primera versión de la v0.21 giraba la carcasa para el otro lado (la HAT abajo); la foto habría salido
a 180° y se descartó.

## Piezas

| STL | Qué es | Orientación | Soportes |
|---|---|---|---|
| `01_top_half` | mitad de arriba (lado de la HAT), con el switch de encendido | cara de la HAT abajo, plana | bajo el extremo de los medios puentes y del medio zócalo del brazo, el ahusado trasero y la nariz; bloquearlos dentro de la cavidad |
| `02_bottom_half` | mitad de abajo (lado de la Pi): zócalos, botón, trabas | cara de la Pi abajo, plana | bajo el extremo de los medios puentes y del medio zócalo, el ahusado trasero y la nariz; **ninguno dentro de los zócalos hexagonales**. Después de imprimir, cortar los puentes de las vigas de las trabas |
| `03_bone_arm` | brazo del auricular, con la copa (el agujero del tapón se corrió con el paso del cable) | acostado | de árbol |
| `04_mode_button` | botón: un cilindro que se pega al pulsador | parado | no |
| `07_transducer_cover` | tapa a click del auricular, con una ranura hacia el oído | disco abajo | no |
| `00_assembly_check` | todo armado | no aplica | **no se imprime**: para mirar en el laminador |

Ya no existen la corredera (05), que reemplaza el switch de panel, ni la tapita del botón (06): el
pulsador queda firme en su bolsillo. PETG si es posible, o PLA; boquilla 0,4, capa de 0,12 a 0,16,
3 perímetros. Las curvas salen con 128 segmentos.

## Lo que fijaron las impresiones (v0.12 a v0.20)

| Parte | Cómo quedó | De dónde salió |
|---|---|---|
| Cámara | ranura del PCB de 1,62 (nervios de 1,2 a 0,25 de luz), 5 mm del centro del nervio delantero a la cara, 4,2 mm de lugar para el flex, y la esquina del nervio delantero abierta, porque ahí la cámara tiene un componente | narices de prueba de la v0.12 y la v0.13 |
| Trabas delanteras | detrás de las guías de la cámara: encima de ellas costaban y se partieron | impresión de la v0.11 |
| Separadores sobre la Pi | **zócalos hexagonales huecos de 5,0 entre caras, 3,5 de profundidad**, en postes de Ø 8,2 recortados donde tocarían el header y los puertos | `test_hex_sizes` (v0.13; el 5.º tamaño) y la v0.15, que con 1,5 no cerraba |
| Auricular | redondo, Ø 14 × 5: copa de **Ø 17 × 6** (la de Ø 15 no entró) y tapa sólida a click con una ranura hacia el oído | v0.15 a v0.17 |
| Botón | un cilindro de Ø 5, pegado al pulsador SMD de 4 × 4 × 1 | v0.15 |
| Encendido | **switch deslizante de panel**, cableado al HAT, en lugar de la llave del HAT y la corredera impresa. Ventana de **4,2 × 7,4** en la cara de la HAT (arriba) y dos pernos de **Ø 2,3 a 14,8** entre centros y 2 de alto, para los agujeros de la pestaña; se fija con gotita. La ventana va 2 mm más abajo que la de la corredera, para que la pestaña no toque la esquina redondeada de arriba | `test_panel_switch` (v0.18 y v0.19) |

## Todas las versiones

La v0.21 todavía no se imprimió: se agrega a `versions/` cuando se mande a imprimir.

`versions/` guarda los STL de cada versión tal como se mandaron a imprimir, con su `LEEME`: de la v0.9 a
la v0.20, incluidas las piezas de prueba (narices, tamaños de hexágono, separaciones del switch). Es el
registro del proceso: no se borra ni se pisa una versión anterior. `./export.sh` vuelve a crear los STL
de la versión vigente en `stl/`, que git ignora.

## Armado

1. **Botón.** Soldar los cables al pulsador de 4 × 4 y pegarle el cilindro (pieza 04). Meterlo desde
   adentro de la mitad de la Pi, con el cilindro por el agujero.
2. **Cámara y flex.** Conectar el flex a la cámara y al CSI de la Pi **antes** de poner el conjunto.
3. **Electrónica.** Con la mitad de la Pi apoyada sobre su cara, bajar el conjunto HAT + batería + Pi,
   **con la Pi hacia abajo**:
   los hexágonos de la Pi entran en los zócalos. La cámara entra en su ranura con el conector hacia la Pi.
4. **Switch.** En la mitad de la HAT, desde adentro, pasar la perilla del switch por su ventana y
   calzar la pestaña en los dos pernos; una gota de gotita.
5. **Cable del auricular.** Conectarlo adentro y sacarlo por el paso de la mitad de la HAT (en la cara
   de la patilla), **antes de cerrar**.
6. **Cerrar.** Bajar la mitad de la HAT sobre la de la Pi hasta escuchar las ocho trabas. Para abrir:
   uña o moneda en la ranura trasera.
7. **Auricular.** Pasar el cable por el canal del brazo, enchufar el brazo en su zócalo (que forman las
   dos mitades), poner el transductor en la copa y cerrar con la tapa (pieza 07).

## Guía con flechas

`img/guide/` tiene seis vistas con flechas que dicen para qué es cada ranura, agujero y pieza, con la
carcasa como se usa (`top`, `head`, `bottom`, `left_inside`, `right_inside`, `exploded`). Las genera
`export.sh` a partir de `via_clara_v0_21_guide.scad`.

![Adentro de la mitad de la Pi](img/guide/right_inside.png)
![Cara de la patilla](img/guide/head.png)

## Archivos y verificaciones

```
via_clara_v0_21.scad         el modelo. PART = assembly | worn | left | right | bone | button | grille |
                             print_* | hardware | check_*;  SHOW_HW y EXPLODE para la vista armada
via_clara_v0_21_guide.scad   la guía con flechas (img/guide/); no se imprime
via_clara_v0_8.scad          la versión de partida, sin tocar, como referencia
export.sh                    regenera stl/ e img/ y corre las verificaciones
versions/                    los STL de cada versión impresa, v0.9 a v0.20
```

`export.sh` comprueba que cada pieza imprimible sea **un solo sólido** que apoya en la cama, y corre
**18 verificaciones** de interferencia que tienen que dar vacío o un contacto de volumen cero: las
mitades entre sí y contra las maquetas del hardware, los zócalos contra los hexágonos, el botón, los
pernos del switch, el recorrido del flex, el brazo y su tapa, y los caminos de armado (botón, conjunto,
cámara). Valen **contra las maquetas**, y las maquetas valen tanto como las medidas: lo que no tienen
(el cuerpo del switch de panel, por ejemplo) no lo ven.

## De dónde salen las medidas

| Componente | Fuente |
|---|---|
| Raspberry Pi Zero 2 W | plano mecánico oficial: 65 × 30, agujeros 58 × 23 |
| AI Camera | product brief (sept. 2024), pág. 4, corregido con las impresiones |
| UPS HAT (C) | wiki de Waveshare (fotos escaladas) y la impresión de la v0.9 |
| Hexágonos, disipador, pulsador, auricular, switch | medidos con calibre y con piezas de prueba |

El conjunto, de la cara de la HAT (arriba) a la de la Pi (abajo): cabezas de los tornillos Phillips, UPS HAT, batería
(del lado de los pogo pins), Pi, y encima de la Pi el header y los hexágonos. Adelante quedan el CSI
y la cámara; atrás, la microSD (sale por una ranura del extremo trasero) y el micro USB de carga.
