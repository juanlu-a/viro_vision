"""Exists because `link.py` is the only place that reads BlueZ's own bookkeeping, and both readings
fail *quietly* when they are wrong.

A `Paired` property that comes off D-Bus wrapped in a `Variant` is truthy whether or not the device
is paired, so a naive check reports every known device as bonded and the startup warning becomes
noise nobody reads. And a device path turned into the wrong string produces a MAC that
`bluetoothctl remove` will not take — which is worse than no log at all, because it sends whoever is
debugging down a path that cannot work.

Like `test_gatt_bluez.py`, it only runs where the BlueZ stack is installed (the board, or a venv that
has `dbus_next`); on the Mac it is skipped, not failed.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

pytest.importorskip("dbus_next")

from virovision.link import _address, _is_bonded  # noqa: E402


class _Variant:
    """What dbus-next hands back for every property value."""

    def __init__(self, value):
        self.value = value


def test_a_device_path_becomes_a_mac_bluetoothctl_accepts():
    assert _address("/org/bluez/hci0/dev_4A_BF_11_22_33_44") == "4A:BF:11:22:33:44"


def test_an_unpaired_device_is_not_reported_as_bonded():
    """The failure this file exists for: the Variant wrapper is truthy either way."""
    assert _is_bonded({"Paired": _Variant(False)}) is False


def test_a_paired_device_is_reported_as_bonded():
    assert _is_bonded({"Paired": _Variant(True)}) is True


def test_a_device_that_never_reported_paired_is_not_bonded():
    assert _is_bonded({}) is False


def test_links_from_before_the_restart_are_dropped_once():
    """Board 2026-10-07: after the watchdog restarted the daemon, the phone stayed on the old link
    and heard nothing for a minute and a half. The new process must drop that link so the app
    reconnects to it, and only once: a later connection is a live one."""
    import asyncio

    from virovision.link import CentralWatcher

    class _Bus:
        def __init__(self):
            self.calls = []

        async def call(self, message):
            self.calls.append((message.path, message.interface, message.member))

    watcher = CentralWatcher()
    watcher._at_startup = ["/org/bluez/hci0/dev_4A_BF_11_22_33_44"]
    bus = _Bus()
    asyncio.run(watcher.drop_links_from_before(bus))
    asyncio.run(watcher.drop_links_from_before(bus))
    assert bus.calls == [("/org/bluez/hci0/dev_4A_BF_11_22_33_44", "org.bluez.Device1", "Disconnect")]


def test_a_link_that_is_already_gone_does_not_stop_the_startup():
    import asyncio

    from virovision.link import CentralWatcher

    class _Bus:
        async def call(self, message):
            raise RuntimeError("org.bluez.Error.NotConnected")

    watcher = CentralWatcher()
    watcher._at_startup = ["/org/bluez/hci0/dev_4A_BF_11_22_33_44"]
    asyncio.run(watcher.drop_links_from_before(_Bus()))  # no exception
