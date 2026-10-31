# ViroVision: Hardware / IoT

El dispositivo montado en la patilla de los lentes: captura el entorno, corre el reconocimiento de
ómnibus entero en la placa y habla con la app del teléfono para el modo supermercado. Este directorio
tiene **el código de la placa**, **el modelo 3D de la carcasa** y la documentación del hardware.

```
hardware/
  raspi/            firmware: daemon Python (BLE GATT + HTTP + cámara + modos + modo ómnibus).
                    Ver raspi/README.md. Incluye un emulador para publicar el mismo GATT desde una Mac
  case-via-clara/   carcasa VIA Clara en OpenSCAD (.scad + export.sh). Ver la sección Carcasa
```

## Componentes

| Parte | Elección | Estado al 2026-10-22 |
|------|--------|-----|
| Cómputo | **Raspberry Pi Zero 2 W** | En uso. Volvió el 2026-09-19, después de diez días con una Pi 3 B+ prestada (2026-09-09 a 2026-09-18) por el CSI roto de la unidad anterior. Sin Ethernet, WiFi sólo de 2,4 GHz, radio BCM43438 (Bluetooth 4.2, sin Data Length Extension): el mismo chip sobre el que se midió el ADR 0003 |
| Cámara y acelerador | **Raspberry Pi AI Camera (Sony IMX500)**, CSI, 12 MP, enfoque manual | En la placa desde el 2026-09-05. El detector de ómnibus corre **dentro del sensor** (ADR 0006, enmienda 2026-09-07). El **Coral TPU salió del diseño** el 2026-09-07 y la Camera Module 3 no se usa |
| Alimentación | **Waveshare UPS HAT (C)** con su LiPo 803040 de 1000 mAh | Comprada el 2026-09-07. El INA219 (I2C 1, dirección 0x43) se lee y la batería llega a la app desde el 2026-10-06 (#110). Consumo real: pendiente de medir |
| Audio | **PWM por GPIO** con `audremap` (señal en el pin 32, masa en el 34), **provisional** | Tonos y voz audibles en un auricular (2026-09-11). En la carcasa va un **transductor de conducción ósea de 14 mm**. El DAC I2S (MAX98357A) sigue como destino y no está instalado |
| Entrada | **Un botón** en GPIO 5 (pin 29, masa en el 30) | Hecho (2026-09-07), con tiempos calibrados el 2026-09-13. En la carcasa: pulsador SMD de 4 × 4 × 1 mm con una tecla impresa pegada encima (ADR 0007) |
| Carcasa | **VIA Clara**, dos mitades a presión, impresa en 3D | v0.9 en `staging`; v0.12 en desarrollo. Ver [Carcasa](#carcasa) |

Descartados: ESP32 (cómputo y RAM insuficientes), Jetson Nano (grande, caro, consume), cámaras ESP32
(baja calidad, foco fijo), cámaras USB (consumo), Coral TPU (reemplazado por la inferencia en el
sensor, ADR 0006).

## Alimentación

**Decidido y comprado el 2026-09-07: Waveshare UPS HAT (C) para Zero (ref. 19739)**, con la LiPo
803040 de 1000 mAh que trae. Misma huella que la Zero (65 × 30), se apila debajo con pogo pins (la Pi
necesita el header GPIO soldado), da hasta 1,8 A, alimenta la Pi mientras carga y trae un **INA219**
por I2C. Se eligió sobre el Adafruit PowerBoost 1000C porque el INA219 es lo que permite anunciar la
batería por voz, que en este proyecto es un requisito de accesibilidad: el usuario no puede mirar un
LED. La celda de 2000 mAh (103450) queda como mejora por el mismo JST si la autonomía medida no
alcanza.

**Batería leída desde el 2026-10-06** (`raspi/virovision/battery.py`, #110): el INA219 está en la
0x43 del bus I2C 1 (confirmado escaneando el bus), sólo se lee el registro de tensión, y el
porcentaje sale de la curva de descarga de una LiPo, suavizado. Llega a la app por el campo `battery`
de `status` y se muestra en la pestaña Dispositivo (`DeviceSummary.tsx`). Requiere
`dtparam=i2c_arm=on` en `config.txt`, que Raspberry Pi OS Lite trae comentado (`setup.sh` lo
habilita; hace falta un reinicio).

**Consumo estimado** (de terceros: foro oficial de Raspberry Pi, CNX Software, Waveshare; **pendiente
de medir** con un medidor USB en línea sobre el daemon real):

| Estado | Consumo | Fuente |
|---|---|---|
| Esperando: BLE anunciando, sin HDMI ni GPU | 0,5 a 0,6 W (~120 mA a 5 V con OS Lite; ~75 mA optimizada) | medición de CNX Software sobre la Zero 2 W |
| Modo activo: cámara + AP WiFi + detección en el IMX500 | 2 a 3 W, pico ~0,6 A | la IA del IMX500 suma ~100 mW (ingeniero de Raspberry Pi); un usuario gastó 60 % de 4400 mAh en 175 min de detección continua |

| Celda | Medidas | Autonomía continua estimada |
|---|---|---|
| 803040, 1000 mAh (viene con el HAT, la que está en la carcasa) | 40 × 30 × 8 mm, ~20 g | 1,5 a 2 h |
| 103450, 2000 mAh (mejora) | 50 × 34 × 10 mm, ~36 g | 3 a 4 h |

Siempre con **PCB de protección** y conector **JST PH 2.0**; verificar la polaridad con multímetro
antes de enchufar. Nada de celdas peladas ni 18650.

**Falta**: el medidor USB en línea (UM25C o similar) para medir el consumo real, y con eso la
autonomía.

## Software de la placa

Raspberry Pi OS **Lite** 64-bit + **un** servicio de systemd (`virovision.service`) con un daemon
Python asyncio. No hay opción bare-metal: cámara (libcamera) y BLE (BlueZ) exigen Linux. Todo en
[`raspi/`](raspi/README.md): perfil GATT, servidor HTTP, cámara con el detector en el sensor, modo
ómnibus con OCR local, zoom digital sobre el cartel, audio, botón, batería y evidencia del modo
ómnibus.

## Enlace con el teléfono (ADR 0003)

- **BLE (GATT), siempre vivo**: control, modo, eventos, resultados. Es lo único que puede despertar
  a la app con el teléfono bloqueado en el bolsillo. Perfil en `raspi/virovision/gatt.py`, copiado en
  `app/src/features/device/gatt.ts`.
- **La foto del modo supermercado va por WiFi** (decidido midiendo el 2026-09-05: 4,5 s por BLE
  contra 46 ms por HTTP). La placa levanta su AP `ViroVision` al arrancar y lo deja **siempre
  prendido** (2026-09-07); la app baja la foto por HTTP plano.
- **Audio**: la placa reproduce lo que le llega. Supermercado: MP3 sintetizado en el teléfono.
  Ómnibus: anuncios **pregrabados** en la microSD (386 `.wav` desde el 2026-09-15). La salida
  (teléfono o dispositivo) se elige en Ajustes y vale para todo lo que suena, con una voz por vez.

## Dónde corre cada modo

- **Ómnibus: entero en la placa** (caso B del diagrama canónico, #88, 2026-09-15). El IMX500 detecta
  ómnibus y carteles (YOLO11n de dos clases, `bus` y `bus_sign`), la Pi recorta el cartel con
  márgenes, lo lee con PP-OCRv5 (`rapidocr` sobre ONNX), lo repara contra el catálogo de la STM y lo
  anuncia. Sin teléfono y sin internet. Es vigilancia, no foto: cámara abierta, detector en cada
  frame, un anuncio por ómnibus.
- **Supermercado: la placa captura, el teléfono procesa** (vía la nube, ADR 0006 y ADR 0008).

## Carcasa

Modelo paramétrico en **OpenSCAD**, en `case-via-clara/`. Dos mitades con cierre a presión, sin
tornillos, montadas sobre la patilla de los lentes, alrededor del conjunto real: Zero 2 W con el header
soldado, UPS HAT (C) unida a su batería 803040, AI Camera y transductor óseo de 14 mm.

**Qué versión está dónde (2026-10-22):**

| Versión | Dónde | Estado |
|---|---|---|
| v0.8 | `staging`, `case-via-clara/via_clara_v0_8.scad` | punto de partida (llegó por mail), se conserva sin tocar |
| v0.9 | `staging` (#120) | impresión evaluada el 2026-10-17; es la que documenta `case-via-clara/README.md` en esta rama |
| v0.10, v0.11 | rama local `feat/case-v0-10-slim`, sin pushear | impresiones evaluadas el 2026-10-21 (v0.10) y el 2026-10-22 (v0.11) |
| **v0.12 (vigente)** | la misma rama, **sin commitear**, en el worktree `viro_vision-case` | en desarrollo; **no está integrada a `staging`** |

La historia completa, las medidas y lo que falta medir están en la sección de la carcasa de
`.claude/skills/virovision/references/hardware.md` y en `docs/tesis/07-desarrollo.md` (§7.3.5).
En corto:

- **Medidas de la v0.12**: 85,8 × 28,5 × 37,2 mm (largo × ancho × alto) el cuerpo, con la nariz de
  32,2 de alto. La v0.9 medía 91,9 × 31,4 × 37,6.
- **Cada impresión corrigió algo real**: la v0.9 mostró que los separadores de bronce estaban del lado
  de la Pi y que la microSD no entraba; la v0.10, que las guías de la cámara eran demasiado finas para
  imprimirse y que el botón chocaba con el disipador; la v0.11, que el lente no entraba y que las trabas
  delanteras no podían flexionar.
- **Verificación**: `export.sh` regenera los STL y las imágenes, comprueba que cada pieza sea un solo
  sólido apoyado en la cama y corre verificaciones de interferencia contra maquetas de las placas
  (14 en el `export.sh` de la v0.9 que está en `staging`, 18 en el de la v0.12 de la rama de la carcasa); sale con error si algo falla. Las verificaciones valen tanto como las medidas de las
  maquetas: lo marcado `MEASURE` en el `.scad` se mide con calibre antes de imprimir.
- **Los STL no viven en el repo**: van al Drive de ViroVision, carpeta `Tesis: ViroVision / modelo_3d`,
  una subcarpeta por versión (la de v0.9 existe; subir las siguientes está pendiente).

## Estado (2026-10-22)

Hecho: firmware completo en `raspi/` (BLE, HTTP, AP siempre prendido, botón, audio PWM, anuncios
pregrabados, batería), **modo ómnibus en la placa** (2026-09-15), arranque que anuncia por BLE a los
16,2 s (2026-10-06), **zoom digital sobre el cartel** (2026-10-19, probado en la placa el 2026-10-22),
márgenes del cartel 18/6/6 para el OCR (#122, 2026-10-22) y evidencia de cada corrida del modo ómnibus
(#114).

Falta: medir el consumo real; la prueba del modo ómnibus en la calle, con y sin zoom; el DAC I2S o
la etapa que maneje el transductor óseo; terminar e imprimir la carcasa v0.12 e integrarla a
`staging`.

Detalle y razonamiento en `.claude/skills/virovision/references/hardware.md`.
