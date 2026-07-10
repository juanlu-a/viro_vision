# Pillar: Hardware / IoT

## The device
A camera device mounted on the **temple (patilla) of a pair of glasses** that captures the
environment, (optionally) processes it, and communicates with the phone. A 3D-printed casing
encapsulates the components; the camera's flex cable needs mechanical care in the enclosure
design.

## Selected components

### Compute: Raspberry Pi Zero 2 W + Coral TPU
Single-board Linux computer — the chosen balance of **cost, size, power and processing**. Runs
local models via TensorFlow Lite / OpenCV, accelerated by the **Coral TPU**. Wi-Fi enables the
alternative "offload to phone" architecture, so both architectures can be compared on one board.

### Camera: Raspberry Pi Camera Module 3
Sony IMX708, 12 MP, **autofocus**. Connects via the dedicated **CSI** connector — crucially, it
does **not** occupy the USB port, leaving USB free for the Coral TPU. Good image quality is
required to read bus lines at distance. Part of the RPi ecosystem (good docs/support).

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

## Two comms channels with the phone
BLE cannot carry real-time audio, so the device runs **two channels**:
1. **BLE (GATT)** — data & control (connection, commands, recognition results).
2. **Separate audio channel** — Bluetooth Classic (A2DP/HFP) or wired, to the device earphone.

This dual-channel design must be reflected in the app↔device integration architecture.

## Two evaluated architectures
- **On-device (standalone):** RPi + Coral TPU run detection/OCR locally; device only sends results.
- **Offload to phone:** device captures + streams images (Wi-Fi/BLE); the phone does the heavy
  processing. RPi Zero 2 W was chosen partly to **implement and compare both**.

## Status
Hardware selection is decided (above). Firmware, BLE peripheral (GATT server), image capture
pipeline and 3D casing are still to be built. A protocol/latency (RTT) comparison was started but
is flagged `PENDIENTE` in the thesis.
