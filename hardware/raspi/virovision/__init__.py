"""Daemon de la placa ViroVision (Raspberry Pi Zero 2 W).

Un solo proceso asyncio: servidor GATT (BlueZ por D-Bus), captura de cámara y máquina de modos
(ADR 0007). El perfil GATT vive en `gatt.py` y está duplicado a mano en la app
(`app/src/features/device/gatt.ts`): si cambia uno, cambia el otro.
"""

VERSION = "0.1.0"
