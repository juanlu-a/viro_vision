"""Exists because the battery is spoken to the user: a wrong number sends them out with a board
that dies on the bus stop, and a crash here would take `status` — and with it the whole link — down.
Covers the curve, the register decoding, the smoothing, and that every way of not having a HAT is a
`None` ("not reported"), never 0 ("empty")."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.battery import Battery, percent_from_voltage  # noqa: E402


def _raw(volts):
    value = round(volts / 0.004) << 3
    return [value >> 8, value & 0xFF]


class FakeBus:
    def __init__(self, readings):
        self.readings = list(readings)
        self.closed = False

    def read_i2c_block_data(self, address, register, length):
        assert (address, register, length) == (0x43, 0x02, 2)
        reading = self.readings.pop(0)
        if isinstance(reading, Exception):
            raise reading
        return _raw(reading)

    def close(self):
        self.closed = True


def test_curve_ends_and_clamps():
    assert percent_from_voltage(4.20) == 100
    assert percent_from_voltage(4.35) == 100
    assert percent_from_voltage(3.27) == 0
    assert percent_from_voltage(2.9) == 0


def test_curve_is_not_linear_in_the_flat_middle():
    # Waveshare's linear map says 62 % at 3.75 V; the cell is near a quarter there.
    assert percent_from_voltage(3.75) == 25
    assert percent_from_voltage(3.84) == 50


def test_reads_the_measured_voltage():
    # 4.16 V is what the HAT read on the board on 2026-10-06, nearly full and charging.
    battery = Battery(open_bus=lambda n: FakeBus([4.16]))
    assert battery.level() == 96


def test_smooths_a_single_sag():
    battery = Battery(open_bus=lambda n: FakeBus([3.95, 3.80, 3.95]))
    assert battery.level() == 70
    sagged = battery.level()
    assert 60 <= sagged < 70  # one reading under the camera's load moves it, does not drop it to 40
    assert battery.level() >= sagged


def test_no_smbus_or_no_bus_is_not_reported():
    def no_bus(n):
        raise FileNotFoundError("/dev/i2c-1")

    assert Battery(open_bus=no_bus).level() is None


def test_a_failed_read_reopens_the_bus_next_time():
    buses = [FakeBus([OSError(121, "Remote I/O error")]), FakeBus([4.20])]
    opened = []

    def open_bus(n):
        opened.append(buses[len(opened)])
        return opened[-1]

    battery = Battery(open_bus=open_bus)
    assert battery.level() is None
    assert buses[0].closed
    assert battery.level() == 100
    assert len(opened) == 2
