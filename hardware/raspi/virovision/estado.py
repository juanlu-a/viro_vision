"""Telemetría mínima de la placa para la característica `estado`.

Batería es `null` a propósito: la Zero 2 W no mide la suya. Cuando haya un sensor (o el UPS de la
carcasa), se llena acá y la app no cambia. `wifi` está para la medición del ADR 0003: hay que
medir el BLE con el WiFi apagado y prendido, porque comparten antena.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Optional

from . import VERSION

_TERMICA = Path("/sys/class/thermal/thermal_zone0/temp")
_WLAN = Path("/sys/class/net/wlan0/operstate")
_ARRANQUE = time.monotonic()


def _leer(path: Path) -> Optional[str]:
    try:
        return path.read_text().strip()
    except OSError:
        return None


def leer_estado(camara: bool) -> dict:
    temp = _leer(_TERMICA)
    return {
        "version": VERSION,
        "temp": round(int(temp) / 1000, 1) if temp and temp.isdigit() else None,
        "uptime": int(time.monotonic() - _ARRANQUE),
        "bateria": None,
        "camara": camara,
        "wifi": _leer(_WLAN) == "up",
    }
