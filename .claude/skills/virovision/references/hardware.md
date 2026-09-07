# Pillar: Hardware / IoT

## The device
A camera device mounted on the **temple (patilla) of a pair of glasses** that captures the
environment, (optionally) processes it, and communicates with the phone. A 3D-printed casing
encapsulates the components; the camera's flex cable needs mechanical care in the enclosure
design.

## Selected components

### Compute: Raspberry Pi Zero 2 W (+ el acelerador del sensor IMX500; **sin Coral desde 2026-09-07**)
Single-board Linux computer — the chosen balance of **cost, size, power and processing**. El
acelerador del camino de ómnibus es la **AI Camera (Sony IMX500)**: el detector yolo11n fine-tuneado
(2 clases, export `format="imx"`) corre **en el sensor** y la Pi recibe las cajas por `picamera2`; la
Pi sólo hace recorte del banner + OCR (RapidOCR, ~140 MB) + anuncio pregrabado. El Coral TPU salió del
diseño (USB libre; el Spike 4 de libedgetpu deja de existir). Riesgo abierto: int8 en el IMX500 sobre
carteles chicos, sin medir. Wi-Fi enables the alternative "offload to phone" architecture, so both
architectures can be compared on one board.

### Camera: Raspberry Pi AI Camera (Sony IMX500) — **la que se compró** (dos unidades; en la placa desde 2026-09-05)
12 MP, acelerador de inferencia en el sensor, CSI. Los docs viejos decían Camera Module 3 (IMX708,
autofocus); la que llegó es la AI Camera, y eso cambió el pilar de ML: la detección corre en el sensor
(ADR 0006, enmienda 2026-09-07). **Enfoque manual**: las primeras fotos salieron desenfocadas (SESSION-LOG
2026-09-05). Foto real por HTTP: 35 KB a 1024×766 en 200-235 ms captura incluida.

## Rejected alternatives (and why)
- **ESP32** (microcontroller): very cheap/small/low-power, but too little compute + RAM for vision;
  supports only simple cameras. Rejected as the main controller.
- **Jetson Nano**: very high compute (CUDA GPU, YOLOv8/OCR/multimodal), but too big, expensive and
  power-hungry for a cheap portable device. Power not justified.
- **ESP32 cameras (OV2640 / OV5640)**: cheap/low-power but limited quality, often forced to low
  resolution / high JPEG compression — inadequate for recognizing buses at distance; frequently
  fixed-focus.
- **Generic USB camera**: widely available and easy to replace, but higher power draw and it
  **occupies the USB port**, conflicting with the Coral TPU on the RPi Zero 2 W.

## Enlace con el teléfono y audio (ADR 0003)

- **BLE (GATT), siempre vivo**: modo, comandos, eventos, resultados. Es lo único que despierta a la
  app con el teléfono bloqueado en el bolsillo (modo de fondo `bluetooth-central`); un socket WiFi
  no puede. Perfil en `hardware/raspi/virovision/gatt.py`, duplicado a mano en
  `app/src/features/device/gatt.ts` (UUIDs de 128 bits).
- **La foto del modo supermercado**: por BLE si la medición del spike da 53 KB en < 2 s; si no, la
  placa levanta un **AP WiFi** y la app la baja por HTTP plano (plan B ya diseñado en el ADR). Se
  decide midiendo: `docs/mediciones/2026-09-04-ble-throughput.md`.
- **Audio**: siempre sale por la placa, por un **DAC I2S cableado** (MAX98357A / PCM5102A). **No**
  A2DP desde la placa: compartiría chip y antena con BLE + WiFi y cortaría el audio; USB está ocupado
  por el Coral. Supermercado reproduce el MP3 que sintetiza el teléfono; ómnibus usa anuncios
  **pregrabados** en la SD.
- **Software de la placa**: Raspberry Pi OS Lite 64-bit + un servicio systemd con un daemon Python
  asyncio. No hay bare-metal: libcamera, libedgetpu y BlueZ exigen Linux.

## Botones físicos y modos de operación (ADR 0007)

El dispositivo lleva **entrada física (botón)** y el reconocimiento funciona por **modos
explícitos** — nunca siempre prendido: anunciar todo lo que la cámara ve, todo el tiempo, aturde.
Desde *esperando*: **1 click** = modo detección de ómnibus (cámara abierta, detector en el sensor en cada frame; anuncia presencia y línea una vez por ómnibus);
**2 clicks** = modo supermercado (pipeline LLM con visión); **click largo** desde cualquier modo =
volver a esperando. Cada transición se anuncia por audio — el usuario no tiene otro indicador de
estado. El diagrama canónico vive en
[`docs/architecture/README.md`](../../../../docs/architecture/README.md); el firmware suma la máquina
de estados y el debounce (umbral de click largo y ventana de doble click a definir con hardware
real), y el GATT debe exponer el modo actual a la app.

## Two evaluated architectures
- **On-device (standalone, el caso B decidido):** IMX500 detecta, RPi recorta + OCR local; device only sends results.
- **Offload to phone:** device captures + streams images (Wi-Fi/BLE); the phone does the heavy
  processing. RPi Zero 2 W was chosen partly to **implement and compare both**.

## Status
Hardware selection is decided (above). **Firmware inicial en `hardware/raspi/`** (2026-09-04):
periférico BLE con el perfil GATT, transferencia medible en chunks, captura con picamera2 (1024 px,
JPEG q70, espejo de la app) y la máquina de modos de ADR 0007. Instalación por SSH con `setup.sh`;
tests puros con pytest en la Mac. Faltan: botón GPIO, DAC y anuncios pregrabados, `omnibus.py` en el daemon
(tensores del IMX500 → `bus_banner.Pipeline.procesar_con_caja`), carcasa, y **correr la medición** que decide el transporte de la foto (cierra además la
comparación de protocolos marcada `PENDIENTE` en la tesis).
