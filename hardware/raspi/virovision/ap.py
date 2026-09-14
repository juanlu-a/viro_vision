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
import time
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
# Injectable so the tests do not really wait for the reconnection window (the repo's convention for
# anything with time in it).
Sleep = Callable[[float], None]


def _nmcli(arguments: Sequence[str]) -> subprocess.CompletedProcess:
    return subprocess.run(["nmcli", *arguments], capture_output=True, text=True, timeout=30)


class AccessPoint:
    def __init__(
        self,
        run: Run = _nmcli,
        ssid: str = SSID,
        password: str = PASSWORD,
        sleep: Sleep = time.sleep,
    ) -> None:
        self._run = run
        self._sleep = sleep
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
        log.info("AP down (%s)", "ok" if result.returncode == 0 else (result.stderr or "").strip()[:120])
        # Do not trust autoconnect: on 2026-09-06 the device was left on no network at all after
        # bringing the AP down (the phone was still joined to a ghost AP and `status` said "no IP").
        # NM is explicitly asked to connect wlan0 to the best known network.
        self.reconnect()
        # And do not trust `con down` either. On 2026-09-13, asked over BLE to turn the AP off, this
        # method returned happily and `status` reported `ap: false` — while that same `status` still
        # said `network: "virovision-ap"`. nmcli had not taken it down, and `self.on` was a belief
        # rather than an observation, so the app was told the AP was off by a board that was still
        # serving it. `active_connection()` already existed to answer exactly this question; nobody
        # was asking it. The state now comes from the interface, and a failure is loud.
        active = self.active_connection()
        self.on = active == CONNECTION_NAME
        if self.on:
            log.error("the AP did NOT come down: wlan0 is still on %s", active)
        # `turn_on` is left believing its own nmcli on purpose: `con up` blocks until the connection
        # is active, and `__main__` already verifies it against the interface's real address
        # (`local_ip() == AP_IP`) before declaring the AP up. It is this direction that had no check.

    def reconnect(self, attempts: int = 6, wait_s: float = 2.0) -> None:
        """Puts wlan0 back on a known network — and never back on our own AP.

        It used to be one line, `nmcli device connect wlan0`, and that line is what kept the board
        stuck on its own access point (measured 2026-09-14: `con down` ok, `device connect` ok, and
        wlan0 back on `virovision-ap` a second later, where it stayed). **`device connect` means
        "activate the best AVAILABLE connection"**, and right after tearing the AP down that choice is
        ours to lose: the home network has not been re-scanned yet, so it is not available — while an
        AP-mode profile always is, because it needs to see nothing. `autoconnect no` does not save us
        either: that flag governs *automatic* activation, not an explicit `device connect`.

        So the order is inverted. NetworkManager's own autoconnect is given the chance first, because
        it is the one that behaves: measured on the board, it brings the home profile up about two
        seconds after the AP goes down, choosing what this board is actually configured to prefer.
        Only if that does not happen is a profile **named explicitly** — never "the best available".
        """
        for attempt in range(attempts):
            active = self.active_connection()
            if active is not None and active != CONNECTION_NAME:
                log.info("back on %s (after %.0f s)", active, attempt * wait_s)
                return
            self._sleep(wait_s)
        for name in self.known_networks():
            result = self._run(["-w", "25", "con", "up", name])
            if result.returncode == 0:
                log.info("reconnected to %s by name", name)
                return
            log.warning("could not bring %s up: %s", name, (result.stderr or "").strip()[:120])
        log.error("wlan0 is not on any known network (active: %s)", self.active_connection())

    def known_networks(self) -> list:
        """WiFi profiles this board may join, our own AP excluded.

        `NAME` is asked for LAST because a connection name may contain a colon and `nmcli -t`
        escapes it: splitting from the left would cut a name in half, splitting with the name at the
        end cannot.
        """
        try:
            output = self._run(["-t", "-f", "TYPE,AUTOCONNECT,NAME", "con", "show"]).stdout or ""
        except Exception:  # noqa: BLE001
            return []
        names = []
        for line in output.splitlines():
            parts = line.split(":", 2)
            if len(parts) < 3:
                continue
            kind, autoconnect, name = parts
            # Only WiFi, only what the board is meant to join on its own, and never the AP: bringing
            # our own access point back up is the exact bug this method exists to prevent.
            if "wireless" in kind and autoconnect == "yes" and name != CONNECTION_NAME:
                names.append(name)
        return names

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
