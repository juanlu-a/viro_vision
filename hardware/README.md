# ViroVision — Hardware / IoT

The glasses-mounted camera device: captures the environment, (optionally) runs recognition locally,
and communicates with the phone app.

## Selected components

| Part | Choice | Why |
|------|--------|-----|
| Compute | **Raspberry Pi Zero 2 W** | Balance of cost, size, power, and processing; Wi-Fi enables the "offload to phone" architecture. |
| AI accelerator | **Coral TPU** (USB) | Runs TFLite models fast on the constrained board. |
| Camera | **Raspberry Pi Camera Module 3** (IMX708, 12 MP, autofocus) | High quality to read bus lines at distance; uses **CSI** so it leaves USB free for the Coral TPU. |
| Enclosure | 3D-printed casing on a glasses temple | Portable; must protect the camera flex cable. |

Rejected: ESP32 (too little compute/RAM), Jetson Nano (too big/expensive/power-hungry), ESP32
cameras (low quality/fixed focus), generic USB cameras (power draw + occupies the USB port needed by
the Coral TPU).

## Two communication channels with the phone

BLE cannot carry real-time audio, so the device uses **two** channels:

1. **BLE (GATT)** — data & control (recognition results, commands, status). GATT profile mirrored in
   the app at `app/src/features/device/gatt.ts` (placeholder UUIDs — align both sides).
2. **Separate audio channel** — Bluetooth Classic (A2DP/HFP) or wired, to the device's earphone, for
   the recognition TTS only.

## Two architectures to compare

- **On-device (standalone):** RPi + Coral TPU run detection/OCR locally; device sends results.
- **Offload to phone:** device streams images; the phone processes them.

## Status

Hardware selection is decided. **Not started:** firmware, BLE peripheral (GATT server), capture
pipeline, 3D casing, and the protocol/latency (RTT) comparison (flagged pending in the thesis).

See `.claude/skills/virovision/references/hardware.md` for the full rationale.
