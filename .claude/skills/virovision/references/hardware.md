# Pilar: Hardware / IoT

## El dispositivo
Una cámara montada sobre la **patilla de unos lentes** que captura el entorno, reconoce ómnibus en la
propia placa y se comunica con el teléfono. Una carcasa impresa en 3D (VIA Clara, ver *Carcasa*)
encierra los componentes; el flex de la cámara necesita cuidado mecánico dentro de ella.

## Componentes elegidos

### Cómputo: Raspberry Pi Zero 2 W (el acelerador es el sensor IMX500; **sin Coral desde 2026-09-07**)
Computadora Linux de una placa: el equilibrio elegido entre **costo, tamaño, consumo y cómputo**. El
acelerador del camino de ómnibus es la **AI Camera (Sony IMX500)**: el detector YOLO11n de cajas, con
dos clases (`bus`, `bus_sign`), exportado con `format="imx"`, corre **en el sensor** y la Pi recibe las
cajas por `picamera2`; la Pi hace el zoom, el recorte del cartel, el OCR (PP-OCRv5 sobre ONNX con
`rapidocr`, en un proceso propio) y el anuncio pregrabado. El Coral TPU salió del diseño (el USB queda
libre; el spike de libedgetpu dejó de existir). El WiFi habilita la arquitectura alternativa de
descarga al teléfono, que es la del modo supermercado.

**La unidad que está sobre la mesa (desde 2026-09-19)**: una Zero 2 W, otra vez, después de diez días
con una **Pi 3 B+ prestada** (2026-09-09 a 2026-09-18, por el CSI roto de la Zero anterior). Es otra
unidad (otra dirección BLE) y su cámara responde. Lo que hay que tener presente al trabajar: **no
tiene puerto Ethernet** (el acceso por cable no existe; ver `placa-acceso.md`), es **sólo 2,4 GHz**,
tiene 415 MB de RAM útiles, y su radio Bluetooth es el **BCM43438 (BT 4.2, sin Data Length
Extension)**: el mismo sobre el que se midió el ADR 0003, así que esas mediciones vuelven a valer.
Algunas cifras viejas de la documentación (el arranque en frío de 47 s del modo ómnibus, por ejemplo)
son de la 3 B+.

### Cámara: Raspberry Pi AI Camera (Sony IMX500), la que se compró (dos unidades; en la placa desde 2026-09-05)
12 MP, acelerador de inferencia en el sensor, CSI. Los documentos viejos decían Camera Module 3
(IMX708, autofoco); la que llegó es la AI Camera, y eso cambió el pilar de ML: la detección corre en
el sensor (ADR 0006, enmienda 2026-09-07). **Enfoque manual**: las primeras fotos salieron
desenfocadas (SESSION-LOG 2026-09-05). Foto real por HTTP: 35 KB a 1024×766 en 200 a 235 ms con la
captura incluida. **Zoom digital** en modo ómnibus (ADR 0006, act. 2026-10-19; #121): `ScalerCrop` del
ISP sobre el cartel, hasta 2x en la Zero 2 W; el detector sigue viendo el campo completo.
`--bus-full-res` (4x) no sirve en esta placa: 10 fps, 65 MB libres y la cámara trabada (2026-10-22).

### Alimentación: Waveshare UPS HAT (C) + LiPo 1S (comprada 2026-09-07; batería leída desde 2026-10-06)
Cargador + elevador a 5 V (hasta 1,8 A) + monitor **INA219** por I2C, misma huella de 65 × 30 que la
Zero, apilada debajo con pogo pins (la Pi necesita el header GPIO soldado). Alimenta la Pi mientras
carga. Viene con una celda 803040 de 1000 mAh (estimado 1,5 a 2 h continuas); una 103450 de 2000 mAh
(3 a 4 h) entra en el mismo JST si la autonomía medida no alcanza. Se eligió sobre el Adafruit
PowerBoost 1000C porque el INA219 es lo que permite **anunciar la batería por voz**. **Hecho el
2026-10-06 (#110)**: `hardware/raspi/virovision/battery.py` lee la tensión en la dirección **0x43** del
bus I2C 1, el porcentaje sale de la curva de descarga de una LiPo, suavizado, y llega a la app por el
campo `battery` de `status` (`state.py`), que lo muestra en la pestaña Dispositivo
(`DeviceSummary.tsx`). Requiere `dtparam=i2c_arm=on` (`setup.sh`). El consumo sigue siendo una
estimación de terceros hasta medir el daemon real con un medidor USB en línea (ver
`hardware/README.md`, *Alimentación*).

### Audio: PWM provisional por GPIO; transductor de conducción ósea en la carcasa
La Zero 2 W no tiene jack: el audio PWM sale por `dtoverlay=audremap,pins_12_13` + `audio_pwm_mode=1`
(señal en el pin 32, masa en el 34). Tonos y voz son audibles en un auricular (2026-09-11), pero es
**provisional**: un GPIO da 16 mA, un piezo no sirve para voz y un auricular de 16 a 32 Ω necesita una
resistencia en serie de 100 a 330 Ω. La carcasa aloja un **transductor de conducción ósea de 14 mm**;
la etapa que lo maneje está pendiente. El **DAC I2S** (MAX98357A, GPIO 18/19/21) sigue siendo el
destino y **no está instalado**; usaría los GPIO 18/19/21, libres hoy (el botón de modos está en el GPIO 5).

### Entrada: un botón en GPIO 5 (pin 29, masa en el 30)
`button.py`, con los gestos del ADR 0007 y tiempos calibrados el 2026-09-13 (antirrebote 15 ms,
doble click 0,6 s, click largo 0,8 s; banderas `--debounce-ms`, `--double-click-ms`,
`--long-press-ms`). En la carcasa el pulsador es un **SMD de 4 × 4 × 1 mm** con una tecla impresa
pegada encima.

## Alternativas descartadas (y por qué)
- **ESP32** (microcontrolador): muy barato, chico y de bajo consumo, pero con muy poco cómputo y RAM
  para visión; sólo admite cámaras simples.
- **Jetson Nano**: mucho cómputo (GPU CUDA, YOLO, OCR, multimodal), pero demasiado grande, caro y
  consumidor para un dispositivo portátil barato.
- **Cámaras ESP32 (OV2640 / OV5640)**: baratas, pero de calidad limitada, a menudo forzadas a baja
  resolución o JPEG muy comprimido, inadecuadas para leer ómnibus a distancia; casi siempre de foco
  fijo.
- **Cámara USB genérica**: fácil de conseguir y reemplazar, pero consume más.
- **Coral TPU por USB**: reemplazado por la inferencia en el sensor IMX500 (ADR 0006, 2026-09-07).
- **Audio por Bluetooth Classic (A2DP)** desde la placa: compartiría chip y antena con BLE y WiFi y
  cortaría el audio; además suma 150 a 250 ms de codificación (ADR 0003 §6).

## Enlace con el teléfono y audio (ADR 0003)

- **BLE (GATT), siempre vivo**: modo, comandos, eventos, resultados. Es lo único que despierta a la
  app con el teléfono bloqueado en el bolsillo (modo de fondo `bluetooth-central`); un socket WiFi no
  puede. Perfil en `hardware/raspi/virovision/gatt.py`, duplicado a mano en
  `app/src/features/device/gatt.ts` (UUIDs de 128 bits). Las operaciones de característica de la app
  pasan por una cola (`services/ble/serialize.ts`, #94).
- **La foto del modo supermercado va por WiFi**: decidido midiendo el 2026-09-05 (4,5 s por BLE
  contra 46 ms por HTTP, `docs/mediciones/2026-09-04-ble-throughput.md`). La placa levanta su **AP
  WiFi** al arrancar y lo deja **siempre prendido** (2026-09-07); la app baja la foto por HTTP plano.
- **Audio**: la salida (teléfono o dispositivo) se elige en Ajustes y vale para todo lo que suena
  (#83, #89, #90); **una voz por vez** (#97: quien empieza a hablar manda `hush` al otro).
  Supermercado reproduce el MP3 que sintetiza el teléfono; ómnibus usa 386 anuncios **pregrabados** en
  la SD.
- **Software de la placa**: Raspberry Pi OS Lite 64-bit + un servicio systemd con un daemon Python
  asyncio (22 archivos en `virovision/`, 4915 líneas, 195 tests al 2026-10-22). No hay bare-metal:
  libcamera y BlueZ exigen Linux.
- **Arranque (2026-10-05/06, #106, #107, #108, #109, #111)**: la placa **anuncia antes** de la cámara y
  del AP; rfkill se levanta en `ExecStartPre`; la unidad depende sólo de `bluetooth.target`; dnsmasq
  sin ping check; cloud-init deshabilitado; `modo-red.sh` sólo trabaja si algo cambió. Anuncia a los
  **16,2 s** del kernel, cámara lista a los 21,3 s, OCR a los **33,6 s**. Journal persistente desde
  el 2026-09-23.

## Botones físicos y modos de operación (ADR 0007)

El dispositivo lleva **entrada física (botón)** y el reconocimiento funciona por **modos
explícitos**, nunca siempre prendido: anunciar todo lo que la cámara ve, todo el tiempo, aturde.
Desde cualquier modo: **1 click** = modo ómnibus (cámara abierta, detector en el sensor en cada frame;
anuncia presencia y línea una vez por ómnibus; un click estando en ómnibus **repite el último
anuncio**, `core.py:214-217`); **2 clicks** = modo supermercado **y una lectura** (pipeline LLM con
visión); **click largo** desde cualquier modo = volver a esperando. Cada transición se anuncia por
audio: el usuario no tiene otro indicador de estado. El diagrama canónico vive en
[`docs/architecture/README.md`](../../../../docs/architecture/README.md).

## Dos arquitecturas evaluadas
- **En la placa (standalone, el caso B, decidido para ómnibus):** el IMX500 detecta, la Pi recorta
  con márgenes (`SIGN_MARGINS = (0.18, 0.06, 0.06)`, #122), lee con OCR local, repara contra el
  catálogo de la STM y anuncia; la placa sólo le manda resultados al teléfono.
- **Descarga al teléfono (supermercado):** la placa captura, la app baja la foto por WiFi y la procesa
  en la nube. La Zero 2 W se eligió en parte para **implementar y comparar las dos**.

## Carcasa: VIA Clara (OpenSCAD)

Dos mitades con cierre a presión, sin tornillos, sobre la patilla, alrededor del conjunto real:
Zero 2 W con el header soldado, UPS HAT (C) unida a su batería 803040 (la batería va entre la HAT y la
Pi, del lado de los pogo pins), AI Camera y transductor óseo de 14 mm. Parte del modelo **v0.8**, que
llegó por mail y se versionó sin tocar (`hardware/case-via-clara/via_clara_v0_8.scad`).

**Dónde está cada versión (2026-10-22):**

- `staging`: v0.8 y **v0.9** (#120). El `README.md` de `hardware/case-via-clara/` en `staging`
  describe la v0.9.
- Rama local **`feat/case-v0-10-slim`** (sale de `564ba82`, **nunca pusheada**), en el worktree
  `viro_vision-case`, junto al checkout principal: v0.10 (`f636e6a`, `502bf7a`) y v0.11
  (`aee8922`, `a758899`). La **v0.12 está sin commitear** ahí (los `via_clara_v0_11*.scad` renombrados a
  `_v0_12`, más cambios a `export.sh`, el README, las imágenes, PROJECT-STATUS y SESSION-LOG). Las
  entradas de bitácora del 2026-10-17, 10-21 y 10-22 sobre la carcasa sólo existen en ese worktree.
  No integrar nada de eso desde otra rama: el trabajo es de esa sesión.

**Historia, impresión por impresión:**

| Versión | Medidas del cuerpo (mm) | Qué mostró su impresión y qué cambió en la siguiente |
|---|---|---|
| v0.9 (2026-10-14) | 91,9 × 31,4 × 37,6 | Impresa el 2026-10-17, «casi perfecta». Los separadores hexagonales de bronce quedaron **del lado de la Pi** y bajo la HAT sólo cabezas Phillips; la microSD no entraba (hubo que cortar con una Dremel); paredes gruesas; la imagen salía girada 90°; el soporte cuadrado del lente no entraba; el pulsador real era un 6 × 6 de ~5 mm y no un SMD de 2,5. Tenía 5 trabas y 14 verificaciones |
| v0.10 (2026-10-17) | 92,9 × 28,7 × 36,6 | El conjunto pasa a la **mitad derecha**; lugar para la microSD; paredes de 1,6 a los costados; **cámara girada 90°** en su plano (flex derecho al CSI); 6 trabas; 15 verificaciones. Impresión evaluada el 2026-10-21: «salió mal». La ventana de la llave era demasiado larga, las guías de la cámara (nervios de 0,65 y de aplastamiento de 0,6) no se podían imprimir, el botón chocaba con el disipador de la Pi, la ranura de la microSD estaba en espejo, el brazo del auricular no entraba, y los pernos traseros se rompían |
| v0.11 (2026-10-21) | 83,4 × 28,5 × 37,2 (nariz 32,2) | Con las medidas reales: disipador 12 × 12 × 4; hexágonos de 2,2 entre caras que asoman **sólo 1,2** sobre la Pi, así que **ya no se termofijan** (se calentaría la placa): los ubican postes con alojamiento holgado en la mitad derecha y la pared de la izquierda apoya en las cabezas de los tornillos; soporte del lente 11 × 11 × 3 más lente de Ø 8 × 1; **pulsador SMD 4 × 4 × 1** con tecla impresa pegada y una tapita (pieza 06) detrás. Ventana de la llave de 4,2 × 7,4; nervios de la cámara de 1,2; botón en x −14, lejos del disipador; microSD que entra y sale por el extremo trasero con la carcasa cerrada (pinza: la punta queda ~2 mm adentro); **8 trabas** (las traseras reemplazan a los pernos). Dos variantes: `integrated` y `cap` (tapa de cámara aparte, pieza 07). Las dos impresiones se evaluaron el 2026-10-22 |
| **v0.12 (2026-10-22, vigente)** | **85,8 × 28,5 × 37,2** (nariz 32,2) | La variante `cap` necesitaba muchos más ajustes y **se descarta** (`export.sh` ya no la genera; su código queda por limpiar). En la integrada: el lente no entraba, así que del centro de la guía delantera a la pared del frente hay **5,0 mm** (`CAM_GUIDE_TO_FRONT`; antes 2,65) y la nariz crece 2,35; las **trabas delanteras** estaban encima de las guías, fundidas a ellas, no flexionaban y se partieron: el gancho pasó detrás de las guías (x −33) con 0,6 de luz debajo de la viga (`SNAP_UNDER_GAP`); los **zócalos hexagonales** salieron llenos y ahora son agujeros redondos de Ø 3,4 × 1,5; la ventana de la corredera, 1 mm más ancha (5,2). Botón y brazo del auricular: perfectos, sin cambios |

Las medidas son del `.scad` (largo de `NOSE_X` = −44,6 a la cola en x = 41,2; ancho `OUT_W` = 28,45;
alto `OUT_H` = 37,2); con los puentes del elástico y el zócalo del brazo, que sobresalen de la cara
cabeza, el ancho total es ~32,2. No cuentan el brazo del auricular.

**Parámetros fijos de la v0.12** (`via_clara_v0_12.scad`): paredes de 1,6 a los costados y 2,7 arriba
y abajo (`WALL`, `WALL_TB`; ahí viven las vigas de las trabas, con ≥ 1,0 de piel); separación HAT-Pi de
11,3 (`BOARD_GAP`, entró bien en la v0.9); nervios de la cámara de 1,2 (`RIB_T`) con 0,15 de luz por
lado (`RIB_GAP`); agujero del lente de Ø 9,4 (para que el lente de Ø 8 pase por la junta); 8 trabas
(viga de 1,2 de espesor, enganche de 0,4 menos 0,05, puente de 0,4 que se corta después de imprimir);
botón en x −14 con agujero de Ø 5,4 para una cabeza de Ø 5,0; transductor de 14 + 0,2 de luz por
lado; dos puentes para un elástico plano de 6 mm.

**Piezas imprimibles** (`*_v0_12.stl`): 01 mitad izquierda (cara cabeza), 02 mitad derecha (cara
externa), 03 brazo del auricular, 04 tecla del botón, 05 corredera de la llave ON/OFF, 06 tapita del
pulsador, y `00_assembly_check` (no se imprime, sirve para revisar en el laminador). Piezas de
prueba: `test_nose_left/right` (la nariz cortada en x −28), las mismas con la ranura de la cámara
0,2 más ancha (`*_slot_plus02`, `RIB_GAP` 0,25) para comparar, y `test_pads` (la pared con los 4
postes).

**Lo que falta medir con calibre** (marcado `MEASURE` en el `.scad`): cabezas de los tornillos bajo la
HAT (`SCREW_HEAD_D/H`, 4,5 / 1,8), lo que asoma la microSD y su centro (`SD_CARD_OUT`, `SD_ZC`, 3,5 /
1,9), la palanca de la llave (`LEVER_Y`, `LEVER_TRAVEL`, `SW_BODY_H`), el voladizo de los conectores
de la Pi (`PI_PORT_OVERHANG`, 0,8), la altura de lo bajo de la Pi (`PI_PARTS_LOW`), el centro del
disipador (`HEATSINK_C`), el pulsador con el actuador y sus patas (`SWITCH_T`, `SWITCH_LEG_SPAN`, 1,5 /
5,8), el transductor (`TRANSDUCER_SIZE`, 14) y el rigidizador del flex de la cámara (1,4 mm para
doblar). Además: confirmar si el flex que tapaba la llave en la v0.11 fue la cámara montada al revés.

**Cómo se verifica**: `./export.sh` regenera los STL (en `stl/`, que git ignora) y las imágenes
(`img/` y la guía con flechas `img/guide/`, desde `via_clara_v0_12_guide.scad`), comprueba que cada
pieza imprimible sea **un solo sólido** apoyado en la cama, y corre **18 verificaciones de
interferencia** con OpenSCAD (backend manifold): las mitades entre sí; cada mitad contra placas,
batería, llave, cámara, pulsador, cabezas de tornillos y separadores; postes contra hexágonos; botón;
corredera en ON y en OFF; recorrido del flex; maquetas entre sí; brazo; cajón; caminos de armado
(tecla, pulsador y tapita entrando al bolsillo, conjunto bajando a los postes, palanca entrando a la
horquilla, cámara entrando a su ranura) y la pared contra las cabezas de los tornillos. Cada una tiene
que dar vacío o un contacto de volumen cero; sale con error si no. **Valen contra maquetas**: tanto como
las medidas. Mandar a imprimir la v0.10 con medidas supuestas es lo que la hizo fallar.

**Los STL van al Drive** de ViroVision, carpeta `Tesis: ViroVision / modelo_3d`, una subcarpeta por
versión (la de v0.9 existe). Al sacar una versión: subir `stl/`, `img/guide/` y el README. Subir las
de v0.10 en adelante está **pendiente**.

**Revisión del modelo**: el equipo sometió el modelo 3D al flujo de revisión multi-modelo
**tackle-ticket** (`tackle-review`, con revisores Opus, Sonnet, Haiku y Codex) en la v0.9 (bitácora del
2026-10-14: tres vueltas; Codex sólo en la tercera) y otra vez en la v0.11 (2026-10-21, tres rondas).
Lo que encontró se corrigió con verificaciones nuevas (por ejemplo `cam_insert`, cuando el lente de
Ø 8 no pasaba por la junta).

**Pendiente de la carcasa**: imprimir y evaluar las piezas de prueba de la v0.12 y elegir el
`RIB_GAP`; sacar el código de la variante `cap`; actualizar el README del worktree a la v0.12 (todavía
describe la v0.11); medir lo marcado `MEASURE`; subir los STL al Drive; integrar la rama a `staging`.

## Estado (2026-10-22)

- **Hecho**: firmware completo en `hardware/raspi/`: periférico BLE con el perfil GATT, servidor HTTP
  con cinco rutas, AP siempre prendido, máquina de modos, **botón físico** (2026-09-07, calibrado el
  2026-09-13), audio PWM con 386 anuncios pregrabados de ómnibus y 7 clips de sistema, **batería**
  (2026-10-06), **modo ómnibus entero en la placa** (#88, 2026-09-15; 1,27 s del click a la línea en la Pi 3 B+ prestada; en la Zero 2 W, 1,6 s desde que el sensor ve el ómnibus, 2026-09-22;
  dicha), catálogo de la STM que completa lo que el OCR no leyó (2026-10-07), **evidencia** de cada
  corrida (#114, 2026-10-12; temporal), **zoom digital** (#121, 2026-10-19; probado en la placa el
  2026-10-22), márgenes del cartel 18/6/6 (#122, 2026-10-22) y el arranque que anuncia a los 16,2 s.
- **Falta**: la prueba del modo ómnibus en la calle con y sin zoom; medir el consumo real; el DAC I2S
  o la etapa del transductor óseo; terminar la carcasa v0.12 e integrarla a `staging`; dónde quedaron
  los pesos del detector reentrenado (épocas y métricas: PENDIENTE).
