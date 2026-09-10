"""Minimal device telemetry for the `status` characteristic.

Battery is `null` on purpose: the Zero 2 W does not measure its own. When there is a sensor (or the
enclosure's UPS), it gets filled in here and the app does not change. `wifi` is there for the
ADR 0003 measurement: BLE has to be measured with the WiFi off and on, because they share an antenna.
"""

from __future__ import annotations

import socket
import subprocess
import time
from pathlib import Path
from typing import Optional

from . import VERSION

_THERMAL = Path("/sys/class/thermal/thermal_zone0/temp")
_WLAN = Path("/sys/class/net/wlan0/operstate")
_STARTED_AT = time.monotonic()


def _read(path: Path) -> Optional[str]:
    try:
        return path.read_text().strip()
    except OSError:
        return None


def local_ip(interface: str = "wlan0") -> Optional[str]:
    """IPv4 of the WiFi interface, or `None` when it has none. It is read from the interface and not
    from the default route on purpose: in access-point mode (plan B) the device has 10.42.0.1 but no
    default route, and the "connected" UDP socket trick returned nothing exactly when it matters
    most."""
    try:
        output = subprocess.run(["ip", "-4", "-o", "addr", "show", "dev", interface], capture_output=True, text=True, timeout=5).stdout
    except (OSError, subprocess.SubprocessError):
        output = ""
    for line in output.splitlines():
        parts = line.split()
        if "inet" in parts:
            return parts[parts.index("inet") + 1].split("/")[0]
    # Without `ip` (the emulator's Mac): the outbound interface, if there is a network.
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
    except OSError:
        return None


def read_status(camera: bool, http_port: Optional[int] = None, ap: bool = False, network: Optional[str] = None) -> dict:
    temp = _read(_THERMAL)
    wifi = _read(_WLAN) == "up"
    return {
        "version": VERSION,
        "temp": round(int(temp) / 1000, 1) if temp and temp.isdigit() else None,
        "uptime": int(time.monotonic() - _STARTED_AT),
        "battery": None,
        "camera": camera,
        "wifi": wifi,
        # ADR 0003's plan B: the app downloads the photo over HTTP from here. `ip` null = no network;
        # `port` null = the HTTP server is not running.
        "ip": local_ip() if wifi else None,
        "port": http_port,
        # True while the device is an access point (plan B): then `ip` is the AP's, 10.42.0.1.
        "ap": ap,
        # Name of the active NetworkManager connection on wlan0 (or null): it says which network the
        # device is on without needing SSH. Diagnosis of 2026-09-06: "no network" and nobody knew why.
        "network": network,
    }
