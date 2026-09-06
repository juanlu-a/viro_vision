"""Telemetría mínima de la placa para la característica `estado`.

Batería es `null` a propósito: la Zero 2 W no mide la suya. Cuando haya un sensor (o el UPS de la
carcasa), se llena acá y la app no cambia. `wifi` está para la medición del ADR 0003: hay que
medir el BLE con el WiFi apagado y prendido, porque comparten antena.
"""

from __future__ import annotations

import socket
import subprocess
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


def ip_local(interfaz: str = "wlan0") -> Optional[str]:
    """IPv4 de la interfaz WiFi, o `None` si no tiene. Se lee de la interfaz y no de la ruta por
    defecto a propósito: en modo punto de acceso (plan B) la placa tiene 10.42.0.1 pero ninguna ruta
    por defecto, y el truco del socket UDP "conectado" devolvía nada justo cuando más importa."""
    try:
        salida = subprocess.run(["ip", "-4", "-o", "addr", "show", "dev", interfaz], capture_output=True, text=True, timeout=5).stdout
    except (OSError, subprocess.SubprocessError):
        salida = ""
    for linea in salida.splitlines():
        partes = linea.split()
        if "inet" in partes:
            return partes[partes.index("inet") + 1].split("/")[0]
    # Sin `ip` (la Mac del emulador): la interfaz de salida, si hay red.
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
    except OSError:
        return None


def leer_estado(camara: bool, puerto_http: Optional[int] = None, ap: bool = False, red: Optional[str] = None) -> dict:
    temp = _leer(_TERMICA)
    wifi = _leer(_WLAN) == "up"
    return {
        "version": VERSION,
        "temp": round(int(temp) / 1000, 1) if temp and temp.isdigit() else None,
        "uptime": int(time.monotonic() - _ARRANQUE),
        "bateria": None,
        "camara": camara,
        "wifi": wifi,
        # Plan B del ADR 0003: la app baja la foto por HTTP de acá. `ip` null = sin red; `puerto`
        # null = el servidor HTTP no está corriendo.
        "ip": ip_local() if wifi else None,
        "puerto": puerto_http,
        # True mientras la placa es punto de acceso (plan B): entonces `ip` es la del AP, 10.42.0.1.
        "ap": ap,
        # Nombre de la conexión de NetworkManager activa en wlan0 (o null): dice en qué red está la
        # placa sin necesidad de SSH. Diagnóstico del 2026-09-06: "sin red" y nadie sabía por qué.
        "red": red,
    }
