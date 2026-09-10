"""Adapter from the core to BlueZ (`bluez_peripheral`): what runs on the device.

The UUIDs live in `profile.py` (shared with the Mac emulator and copied by hand into the app); the
command, mode and transfer logic in `core.py`. Here the two are only wired to BlueZ's characteristics.
"""

from __future__ import annotations

import asyncio
import os
from typing import Callable, Optional

from bluez_peripheral.gatt.characteristic import CharacteristicFlags as Flags
from bluez_peripheral.gatt.characteristic import characteristic
from bluez_peripheral.gatt.service import Service

from .core import STATUS, EVENT, MODE, TRANSFER, Capture, ApControl, Core
from .profile import (  # noqa: F401  (re-exported for __main__)
    CH_CONTROL,
    CH_STATUS,
    CH_EVENT,
    CH_MODE,
    CH_TRANSFER,
    CH_WIFI,
    ADVERTISED_NAME,
    SERVICE_UUID,
)

# Configurable through the environment for experiments (VIROVISION_PAUSE_MS); the 4 ms default is the
# one measured as safe on 2026-09-05 (see _notify).
NOTIFICATION_PAUSE_S = float(os.environ.get("VIROVISION_PAUSE_MS", "4")) / 1000


class ViroVisionService(Service):
    """One service, five characteristics. The getters/setters are synchronous because that is how
    BlueZ calls them; the long work is dispatched by the core as asyncio tasks."""

    def __init__(
        self,
        loop: asyncio.AbstractEventLoop,
        read_status: Callable[[], dict],
        capture: Optional[Capture],
        synthetic_payload: Callable[[int], bytes],
        ap_control: Optional[ApControl] = None,
        read_wifi: Optional[Callable[[], dict]] = None,
    ) -> None:
        super().__init__(SERVICE_UUID, True)
        self.core = Core(loop, read_status, capture, synthetic_payload, self._notify, ap_control=ap_control, read_wifi=read_wifi)

    async def _notify(self, name: str, value: bytes) -> None:
        char = {MODE: self.mode, EVENT: self.event, TRANSFER: self.transfer, STATUS: self.status}[name]
        char.changed(value)
        # `changed` only queues a D-Bus message. Measured on 2026-09-05 on the device: dumping the 298
        # chunks of 53 KB with no pause fills the socket towards bluetoothd in ~250 ms, dbus-next gets
        # EAGAIN (`BlockingIOError: Resource temporarily unavailable`) and DROPS the rest: the receiver
        # got 175 of 298 and never the `end` event. The pause lets bluetoothd drain the socket; at 4 ms
        # the ceiling is ~45 KB/s with 182-byte chunks, far above what the BLE 4.2 link gives, so it
        # does not bias the measurement: the bottleneck is still the air.
        # The real fix is AcquireNotify (an fd with true backpressure); see the README.
        await asyncio.sleep(NOTIFICATION_PAUSE_S)

    @characteristic(CH_MODE, Flags.READ | Flags.NOTIFY | Flags.WRITE)
    def mode(self, options):
        return self.core.read_mode()

    @mode.setter
    def mode(self, value, options):
        self.core.write_mode(bytes(value))

    @characteristic(CH_CONTROL, Flags.WRITE | Flags.WRITE_WITHOUT_RESPONSE)
    def control(self, options):
        pass  # write only

    @control.setter
    def control(self, value, options):
        # BlueZ hands us the MTU negotiated with this central in the write options.
        self.core.write_control(bytes(value), options.mtu or 0)

    @characteristic(CH_EVENT, Flags.NOTIFY)
    def event(self, options):
        return b""

    @characteristic(CH_TRANSFER, Flags.NOTIFY)
    def transfer(self, options):
        return b""

    @characteristic(CH_STATUS, Flags.READ | Flags.NOTIFY)
    def status(self, options):
        return self.core.read_status()

    @characteristic(CH_WIFI, Flags.READ)
    def wifi(self, options):
        return self.core.read_wifi()

    def notify_status(self) -> None:
        self.core.notify_status()
