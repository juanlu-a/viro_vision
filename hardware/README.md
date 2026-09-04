# ViroVision — Hardware / IoT

El dispositivo montado en la patilla de los lentes: captura el entorno, corre reconocimiento local
donde puede, y habla con la app del teléfono. Este directorio tiene **el código de la placa** y la
documentación del hardware.

```
hardware/
  raspi/        firmware: daemon Python (BLE GATT + cámara + modos). Ver raspi/README.md
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

Descartados: ESP32 (cómputo/RAM insuficientes), Jetson Nano (grande, caro, consume), cámaras ESP32
(baja calidad, foco fijo), cámaras USB (consumo + ocupan el USB del Coral).

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
