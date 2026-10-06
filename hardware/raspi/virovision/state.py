"""Minimal device telemetry for the `status` characteristic.

Battery comes from the UPS HAT's INA219 (`battery.py`) and is `null` when there is no HAT to read:
the Zero 2 W does not measure its own. `wifi` is there for the
ADR 0003 measurement: BLE has to be measured with the WiFi off and on, because they share an antenna.
"""

from __future__ import annotations

import socket
import subprocess
import threading
import time
from pathlib import Path
from typing import Callable, Optional, Tuple

from . import VERSION
from .battery import Battery

_THERMAL = Path("/sys/class/thermal/thermal_zone0/temp")
_WLAN = Path("/sys/class/net/wlan0/operstate")
_STARTED_AT = time.monotonic()
_BATTERY = Battery()


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


class NetworkSnapshot:
    """The network name and IP, looked up off the event loop and read from memory.

    Since 2026-10-06. Both used to be looked up inside `read_status`, which runs on the asyncio loop
    that answers BLE — the GATT read, `notify_status`, the 15 s heartbeat — and spawns `nmcli` (30 s
    timeout) and `ip` (5 s). With NetworkManager slow or restarting, one status read froze the BLE
    link for up to 35 s, which from the phone is a board that died. Now `refresh` runs in an executor
    (on the heartbeat, after every AP change) and a status read costs nothing.
    """

    def __init__(self, active_connection: Callable[[], Optional[str]], ip: Callable[[], Optional[str]] = local_ip) -> None:
        self._active_connection = active_connection
        self._ip = ip
        self._lock = threading.Lock()
        self.current: Tuple[Optional[str], Optional[str]] = (None, None)
        """(network name, IPv4), replaced whole so a reader never sees one from each refresh."""

    def refresh(self, wait_s: float = 0.0) -> None:
        """Blocking: call it from an executor. Skipped when another refresh is already running:
        `nmcli` stuck on its 30 s timeout would otherwise pile up one thread per heartbeat in a pool of
        eight. `wait_s` is for right after an AP change, when the next status has to show it — bounded,
        so a refresh hung on `nmcli` does not hold the AP's answer for another 30 s."""
        acquired = self._lock.acquire(timeout=wait_s) if wait_s > 0 else self._lock.acquire(blocking=False)
        if not acquired:
            return
        try:
            network = self._active_connection()
            ip = self._ip() if _read(_WLAN) == "up" else None
            self.current = (network, ip)
        finally:
            self._lock.release()


_LOOK_UP = object()


def read_status(
    camera: bool,
    http_port: Optional[int] = None,
    ap: bool = False,
    network: Optional[str] = None,
    ip=_LOOK_UP,
) -> dict:
    """`ip` comes from a `NetworkSnapshot` on the device; left out, it is looked up here (blocking),
    which is fine for the Mac emulator and nowhere near the BLE loop."""
    temp = _read(_THERMAL)
    wifi = _read(_WLAN) == "up"
    if ip is _LOOK_UP:
        ip = local_ip() if wifi else None
    return {
        "version": VERSION,
        "temp": round(int(temp) / 1000, 1) if temp and temp.isdigit() else None,
        "uptime": int(time.monotonic() - _STARTED_AT),
        "battery": _BATTERY.level(),
        "camera": camera,
        "wifi": wifi,
        # ADR 0003's plan B: the app downloads the photo over HTTP from here. `ip` null = no network;
        # `port` null = the HTTP server is not running.
        "ip": ip if wifi else None,
        "port": http_port,
        # True while the device is an access point (plan B): then `ip` is the AP's, 10.42.0.1.
        "ap": ap,
        # Name of the active NetworkManager connection on wlan0 (or null): it says which network the
        # device is on without needing SSH. Diagnosis of 2026-09-06: "no network" and nobody knew why.
        "network": network,
    }
