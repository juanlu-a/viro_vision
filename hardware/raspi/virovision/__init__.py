"""ViroVision device daemon (Raspberry Pi Zero 2 W).

A single asyncio process: GATT server (BlueZ over D-Bus), camera capture and the mode machine
(ADR 0007). The GATT profile lives in `gatt.py` and is duplicated by hand in the app
(`app/src/features/device/gatt.ts`): if one changes, the other changes.
"""

VERSION = "0.1.0"
