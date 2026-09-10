"""The device's WiFi access point (ADR 0003's plan B) with NetworkManager.

The real case is the street or the supermarket, with no infrastructure WiFi: the device brings its AP
up, the phone joins and downloads the photo over HTTP; the phone keeps its internet over cellular
data (the iOS spike is pending). The Zero 2 W has ONE WiFi radio: while the AP is up, the device is on
no other network (development SSH is lost). That is why the AP is turned on **for a bounded time** and
returns to the known network on its own: if something goes wrong, the device recovers untouched.

Everything through `nmcli`, which already ships with Raspberry Pi OS. The `virovision-ap` connection
is created the first time; `ipv4.method shared` gives 10.42.0.1 and DHCP with nothing else.
"""

from __future__ import annotations

import logging
import subprocess
from typing import Callable, Optional, Sequence

log = logging.getLogger(__name__)

CONNECTION_NAME = "virovision-ap"
SSID = "ViroVision"
# Fixed for now, and with no pretence of secrecy (ADR 0003: WPA2 encrypts the air, the data is not
# sensitive). Once there are several units, one per unit and published through the `wifi`
# characteristic.
PASSWORD = "virovision2026"
AP_IP = "10.42.0.1"

Run = Callable[[Sequence[str]], subprocess.CompletedProcess]


def _nmcli(arguments: Sequence[str]) -> subprocess.CompletedProcess:
    return subprocess.run(["nmcli", *arguments], capture_output=True, text=True, timeout=30)


class AccessPoint:
    def __init__(self, run: Run = _nmcli, ssid: str = SSID, password: str = PASSWORD) -> None:
        self._run = run
        self._ssid = ssid
        self._password = password
        self.on = False

    def _ensure_connection(self) -> None:
        existing = self._run(["-t", "-f", "NAME", "con", "show"])
        if CONNECTION_NAME in (existing.stdout or "").splitlines():
            return
        self._ok(self._run(["con", "add", "type", "wifi", "ifname", "wlan0", "con-name", CONNECTION_NAME,
                            "autoconnect", "no", "ssid", self._ssid]))
        # 2.4 GHz (band bg): the device has no 5 GHz; and `shared` = NAT + DHCP on 10.42.0.1.
        self._ok(self._run(["con", "modify", CONNECTION_NAME,
                            "802-11-wireless.mode", "ap", "802-11-wireless.band", "bg",
                            "ipv4.method", "shared",
                            "wifi-sec.key-mgmt", "wpa-psk", "wifi-sec.psk", self._password]))
        log.info("connection %s created (ssid %s)", CONNECTION_NAME, self._ssid)

    def turn_on(self) -> None:
        self._ensure_connection()
        self._ok(self._run(["con", "up", CONNECTION_NAME]))
        self.on = True
        log.info("AP \"%s\" up on %s; the device left its previous WiFi network", self._ssid, AP_IP)

    def turn_off(self) -> None:
        result = self._run(["con", "down", CONNECTION_NAME])
        self.on = False
        log.info("AP down (%s)", "ok" if result.returncode == 0 else (result.stderr or "").strip()[:120])
        # Do not trust autoconnect: on 2026-09-06 the device was left on no network at all after
        # bringing the AP down (the phone was still joined to a ghost AP and `status` said "no IP").
        # NM is explicitly asked to connect wlan0 to the best known network.
        self.reconnect()

    def reconnect(self) -> None:
        """Connects wlan0 to the known network with autoconnect (home, the lab…)."""
        result = self._run(["-w", "25", "device", "connect", "wlan0"])
        log.info("reconnection to the known network: %s", "ok" if result.returncode == 0 else (result.stderr or result.stdout or "").strip()[:160])

    def active_connection(self) -> Optional[str]:
        """Name of the active connection on wlan0, or None. It goes into `status` so the app (and
        whoever is debugging) knows which network the device is on without going in over SSH."""
        try:
            output = self._run(["-t", "-f", "NAME,DEVICE", "con", "show", "--active"]).stdout or ""
        except Exception:  # noqa: BLE001
            return None
        for line in output.splitlines():
            name, _, device = line.rpartition(":")
            if device == "wlan0":
                return name
        return None

    @staticmethod
    def _ok(result: subprocess.CompletedProcess) -> None:
        if result.returncode != 0:
            raise RuntimeError((result.stderr or result.stdout or "nmcli failed").strip()[:200])

    def credentials(self) -> dict:
        return {"ssid": self._ssid, "password": self._password, "ip": AP_IP}
