"""Exists because the status is read on the asyncio loop that answers BLE (the GATT read, the 15 s
heartbeat), and until 2026-10-06 each read spawned `nmcli` (30 s timeout) and `ip` (5 s) right there:
NetworkManager slow to answer froze the whole link. The lookups now live in `NetworkSnapshot`,
refreshed off the loop, and a status read only reads memory."""

import os
import sys
import threading

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision import state  # noqa: E402
from virovision.state import NetworkSnapshot, read_status  # noqa: E402


def test_a_status_read_with_a_snapshot_spawns_nothing(monkeypatch):
    monkeypatch.setattr(state, "local_ip", lambda: (_ for _ in ()).throw(AssertionError("looked up on the loop")))
    monkeypatch.setattr(state, "_read", lambda path: "up" if path == state._WLAN else None)
    status = read_status(camera=True, http_port=8080, network="casa", ip="192.168.1.20")
    assert status["ip"] == "192.168.1.20" and status["network"] == "casa"


def test_a_snapshot_ip_is_not_reported_once_wifi_is_down(monkeypatch):
    monkeypatch.setattr(state, "_read", lambda path: "down" if path == state._WLAN else None)
    assert read_status(camera=True, network=None, ip="192.168.1.20")["ip"] is None


def test_a_refresh_already_running_is_not_stacked_on():
    """`nmcli` stuck on its 30 s timeout, refreshed every 15 s: without this, one more blocked
    executor thread per heartbeat in a pool of eight."""
    entered, release = threading.Event(), threading.Event()
    calls = []

    def slow_nmcli():
        calls.append(1)
        entered.set()
        release.wait(2)
        return "casa"

    snapshot = NetworkSnapshot(slow_nmcli, ip=lambda: "10.0.0.2")
    first = threading.Thread(target=snapshot.refresh)
    first.start()
    entered.wait(2)
    snapshot.refresh()  # returns at once
    assert calls == [1]
    release.set()
    first.join(2)
    assert snapshot.current[0] == "casa"


def test_an_ap_change_waits_for_a_hung_refresh_only_so_long():
    import time

    hold, entered = threading.Event(), threading.Event()
    snapshot = NetworkSnapshot(lambda: entered.set() or (hold.wait(2) and "casa"), ip=lambda: None)
    first = threading.Thread(target=snapshot.refresh)
    first.start()
    assert entered.wait(2)

    started = time.monotonic()
    snapshot.refresh(wait_s=0.2)
    assert time.monotonic() - started < 1.0
    hold.set()
    first.join(2)
