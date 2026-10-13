"""Battery level from the Waveshare UPS HAT (C)'s INA219, for the `status` characteristic.

The HAT measures the cell over I2C (address 0x43, confirmed with a bus scan on 2026-10-06). Only the
bus-voltage register is read, and nothing is ever written: the chip's power-on configuration
(32 V range, 12-bit) is enough to read a 1S cell, and leaving the calibration alone means a board
without the HAT — or the emulator on the Mac — can never be left misconfigured by this module.

The percentage comes from the voltage, through a LiPo discharge curve rather than Waveshare's linear
`(V - 3) / 1.2`: the curve is flat between 3.75 and 3.85 V, and the linear map put the cell at 60 %
when it was nearer 35 %, which is the half of the range where the user needs the number to be true.
It is an estimate: under the camera's load the voltage sags, and while charging it reads high. The
smoothing keeps a mode switch from making the number jump 10 points on one heartbeat.
"""

from __future__ import annotations

import logging
import threading
from typing import Callable, Optional

log = logging.getLogger(__name__)

I2C_BUS = 1
ADDRESS = 0x43
_BUS_VOLTAGE = 0x02

# Resting voltage of a 1S LiPo against its charge, from the usual published discharge curves.
# Linear interpolation between points; outside the table it is clamped to 0 / 100.
_CURVE = (
    (3.27, 0), (3.61, 5), (3.69, 10), (3.71, 15), (3.73, 20), (3.75, 25), (3.77, 30), (3.79, 35),
    (3.80, 40), (3.82, 45), (3.84, 50), (3.85, 55), (3.87, 60), (3.91, 65), (3.95, 70), (3.98, 75),
    (4.02, 80), (4.08, 85), (4.11, 90), (4.15, 95), (4.20, 100),
)

# Weight of the newest reading. `status` is read every 15 s, so 0.3 lets a real change show within
# about a minute while one reading taken in the middle of a camera start barely moves the number.
_SMOOTHING = 0.3


def percent_from_voltage(volts: float) -> int:
    if volts <= _CURVE[0][0]:
        return 0
    for (v0, p0), (v1, p1) in zip(_CURVE, _CURVE[1:]):
        if volts <= v1:
            return round(p0 + (p1 - p0) * (volts - v0) / (v1 - v0))
    return 100


def _open_smbus(bus: int):
    from smbus2 import SMBus  # apt's python3-smbus2; missing on the Mac, which has no battery either

    return SMBus(bus)


class Battery:
    """Reads the cell on demand. `None` means "no measurement", never "empty": the app then says the
    level has not been reported, which is true, instead of announcing a dead battery."""

    def __init__(self, open_bus: Callable[[int], object] = _open_smbus, bus: int = I2C_BUS, address: int = ADDRESS):
        self._open_bus = open_bus
        self._bus_number = bus
        self._address = address
        self._bus = None
        self._volts: Optional[float] = None
        self._unavailable_logged = False
        # `status` is read from the BLE loop and from the HTTP server's threads; one bus, one reader.
        self._lock = threading.Lock()

    def _read_volts(self) -> Optional[float]:
        try:
            if self._bus is None:
                self._bus = self._open_bus(self._bus_number)
            high, low = self._bus.read_i2c_block_data(self._address, _BUS_VOLTAGE, 2)
        except Exception as exc:  # ImportError, no /dev/i2c-1, HAT unplugged: all mean "no reading"
            # Logged once, not every 15 s: a board without the HAT is a valid setup, not a fault.
            if not self._unavailable_logged:
                log.info("battery not available: %s", exc)
                self._unavailable_logged = True
            self._close()
            return None
        self._unavailable_logged = False
        # Bits 15..3 are the voltage in 4 mV steps.
        return (((high << 8) | low) >> 3) * 0.004

    def _close(self) -> None:
        if self._bus is not None:
            try:
                self._bus.close()
            except Exception:
                pass
        self._bus = None

    def level(self) -> Optional[int]:
        with self._lock:
            volts = self._read_volts()
            if volts is None:
                return None
            self._volts = volts if self._volts is None else self._volts + _SMOOTHING * (volts - self._volts)
            return percent_from_voltage(self._volts)
