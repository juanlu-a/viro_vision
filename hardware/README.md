# ViroVision — Hardware / IoT

El dispositivo montado en la patilla de los lentes: captura el entorno, corre reconocimiento local
donde puede, y habla con la app del teléfono. Este directorio tiene **el código de la placa** y la
documentación del hardware.

```
hardware/
  raspi/        firmware: daemon Python (BLE GATT + cámara + modos). Ver raspi/README.md
                incluye un emulador para publicar el mismo GATT desde una Mac (sin placa)
  (carcasa/)    modelos 3D — pendiente
```

## Componentes elegidos

| Parte | Elección | Por qué |
|------|--------|-----|
| Cómputo | **Raspberry Pi Zero 2 W** | Equilibrio costo / tamaño / consumo / cómputo; radio BLE + WiFi 2,4 GHz en el mismo chip (BCM43436/8, Bluetooth 4.2). |
| Acelerador | **Coral TPU** (USB) | Corre modelos TFLite en una placa chica. Rol: el pipeline de ómnibus (ADR 0006). |
| Cámara | **Raspberry Pi Camera Module 3** (IMX708, 12 MP, autofoco) | Calidad para leer carteles a distancia; va por **CSI** y deja el USB libre para el Coral. |
| Audio | **DAC I2S con amplificador** (MAX98357A o PCM5102A) → auricular cableado | La Zero 2 W no tiene jack; USB está ocupado; A2DP desde la placa compartiría antena con BLE + WiFi y cortaría el audio (ADR 0003). |
| Entrada | **Un botón** (GPIO) | 1 click ómnibus, 2 clicks supermercado, largo = esperando (ADR 0007). |
| Carcasa | impresa en 3D, en la patilla | Portátil; tiene que proteger el flex de la cámara. |
| Alimentación | **LiPo 1S 103450 (2000 mAh)** + **Waveshare UPS HAT (C)** (propuesta 2026-09-07, a confirmar midiendo) | 3–4 h continuas; el HAT carga con el equipo prendido, da 1,8 A y trae un INA219 para anunciar la batería por voz. Ver [Alimentación](#alimentación). |

Descartados: ESP32 (cómputo/RAM insuficientes), Jetson Nano (grande, caro, consume), cámaras ESP32
(baja calidad, foco fijo), cámaras USB (consumo + ocupan el USB del Coral).

## Alimentación

Propuesta del 2026-09-07, pendiente de confirmar con el consumo real medido. Los números son de
terceros (foro oficial de Raspberry Pi, CNX Software, Waveshare) y asumen que el Coral no está; con
Coral el pico sube a ~1,5 A y el HAT sigue alcanzando.

**Consumo estimado de la placa**

| Estado | Consumo | Fuente |
|---|---|---|
| Esperando: BLE anunciando, sin HDMI ni GPU | 0,5–0,6 W (~120 mA a 5 V con OS Lite; ~75 mA optimizada) | medición de CNX Software sobre la Zero 2 W |
| Modo activo: cámara + WiFi AP + detección en el IMX500 | 2–3 W, pico ~0,6 A | la IA del IMX500 suma ~100 mW (ingeniero de RPi); un usuario gastó 60 % de 4400 mAh en 175 min de detección continua |

**Batería**: la unidad de bolsillo lleva el peso, así que la capacidad manda sobre el tamaño.

| Celda | Medidas | Autonomía continua | Cuándo |
|---|---|---|---|
| **103450, 2000 mAh** (principal) | 50 × 34 × 10 mm, ~36 g | 3–4 h | pruebas con usuarios y demo |
| 803040, 1000 mAh (viene con el HAT) | 40 × 30 × 8 mm, ~20 g | 1,5–2 h | si el reposo real queda cerca de 0,5 W y se quiere la unidad más chica |

Siempre con **PCB de protección** y conector **JST PH 2.0**; verificar la polaridad con multímetro
antes de enchufar (las genéricas vienen a veces invertidas). Nada de celdas peladas ni 18650.

**Carga + 5 V: Waveshare UPS HAT (C) para Zero (ref. 19739)**, antes que el Adafruit PowerBoost
1000C. Misma huella que la Zero (65 × 30), se apila debajo con pogo pins (la Pi necesita el header
GPIO soldado o ser una Zero 2 WH), da hasta 1,8 A, alimenta la Pi mientras carga, y trae un
**INA219** por I2C: tensión y corriente de la celda. Eso llena el `bateria: null` de la característica
`estado` del GATT y permite que la app **anuncie la batería por voz**, que es un requisito de
accesibilidad y hoy no se puede. El PowerBoost da 1 A, no mide nada y hay que importarlo.

**Lista de compra** (enviada al grupo el 2026-09-07): UPS HAT (C) · LiPo 103450 2000 mAh con
protección y JST PH 2.0 · **medidor USB en línea** (UM25C o similar) para medir el daemon real antes de
cerrar la carcasa · header 2×20 si la Zero no lo tiene. Plan B sin electrónica: power bank de
5000 mAh en el bolsillo y un cable a los pads de 5 V de la Pi.

## Software de la placa

Raspberry Pi OS **Lite** 64-bit + **un** servicio de systemd con un daemon Python. No hay opción
bare-metal: cámara (libcamera), Coral (libedgetpu) y BLE (BlueZ) exigen Linux. Todo en
[`raspi/`](raspi/README.md).

## Enlace con el teléfono (ADR 0003)

- **BLE (GATT), siempre vivo**: control, modo, eventos, resultados. Es lo único que puede despertar
  a la app con el teléfono bloqueado en el bolsillo. Perfil en `raspi/virovision/gatt.py`, copiado en
  `app/src/features/device/gatt.ts`.
- **La foto (modo supermercado)**: por BLE si la medición del spike da 53 KB en menos de 2 s; si
  no, la placa levanta un AP WiFi y la app la baja por HTTP plano. Se decide midiendo, no opinando.
- **Audio**: siempre sale por el parlante/auricular de la placa. Supermercado: MP3 sintetizado en
  el teléfono. Ómnibus: anuncios pregrabados en la SD (las líneas son un conjunto finito).

## Dos arquitecturas a comparar

- **En placa (standalone)**: RPi + Coral corren detección y OCR; el teléfono no participa (ómnibus,
  caso B del diagrama canónico).
- **Descarga al teléfono**: la placa captura y transmite; el teléfono procesa (supermercado, vía
  nube).

## Estado

Hardware elegido. **Firmware inicial en `raspi/`**: periférico BLE con el perfil GATT, transferencia
medible, captura con picamera2, máquina de modos. Falta: botón, audio, pipeline de ómnibus en el
Coral, carcasa, y la medición que decide el transporte de la foto.

Detalle y razonamiento en `.claude/skills/virovision/references/hardware.md`.
