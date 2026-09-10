"""Exists because the core is the code that runs both on the device and in the Mac emulator: if the
`measure` command did not wrap the transfer in `start`/`end`, or split it with a chunk size other
than the one the app asked for, the app would measure wrong or never finish, and both environments
would fail identically without either of them showing it."""

import asyncio
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.core import STATUS, EVENT, MODE, TRANSFER, Core  # noqa: E402
from virovision.transfer import join  # noqa: E402


class Notifications:
    def __init__(self):
        self.received: list[tuple[str, bytes]] = []

    async def __call__(self, name: str, value: bytes) -> None:
        self.received.append((name, bytes(value)))

    def of(self, name: str) -> list[bytes]:
        return [v for n, v in self.received if n == name]

    def events(self) -> list[dict]:
        return [json.loads(v) for v in self.of(EVENT)]


def build(loop, capture=None, ap_control=None, read_wifi=None):
    n = Notifications()
    core = Core(loop, lambda: {"version": "t"}, capture, lambda amount: bytes(range(256)) * (amount // 256) + bytes(amount % 256), n, ap_control=ap_control, read_wifi=read_wifi)
    return core, n


@pytest.fixture
def loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


async def _drain(loop_):
    # let the scheduled tasks finish
    for _ in range(5):
        await asyncio.sleep(0)
    pending = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
    if pending:
        await asyncio.gather(*pending)


def test_measure_wraps_the_transfer_and_respects_the_chunk(loop):
    core, n = build(loop)
    core.write_control(b'{"cmd":"measure","bytes":53000,"chunk":182}', mtu=185)
    loop.run_until_complete(_drain(loop))

    events = n.events()
    assert events[0]["t"] == "start" and events[0]["bytes"] == 53000 and events[0]["chunks"] == 298
    assert events[-1]["t"] == "end" and events[-1]["chunks"] == 298
    chunks = n.of(TRANSFER)
    assert len(chunks) == 298 and max(len(c) for c in chunks) == 182
    assert len(join(chunks)) == 53000


def test_the_chunk_never_exceeds_the_negotiated_mtu(loop):
    core, n = build(loop)
    core.write_control(b'{"cmd":"measure","bytes":1000,"chunk":500}', mtu=185)
    loop.run_until_complete(_drain(loop))
    assert n.events()[0]["chunk"] == 182


def test_without_mtu_or_chunk_it_uses_the_ios_default(loop):
    core, n = build(loop)
    core.write_control(b'{"cmd":"measure","bytes":1000}')
    loop.run_until_complete(_drain(loop))
    assert n.events()[0]["chunk"] == 182


def test_an_unknown_or_unreadable_command_is_an_error_event_not_an_exception(loop):
    core, n = build(loop)
    core.write_control(b'{"cmd":"dance"}')
    core.write_control(b"this is not json")
    loop.run_until_complete(_drain(loop))
    assert [e["t"] for e in n.events()] == ["error", "error"]


def test_changing_mode_notifies_mode_and_event(loop):
    core, n = build(loop)
    core.write_control(b'{"cmd":"mode","value":2}')
    loop.run_until_complete(_drain(loop))
    assert n.of(MODE) == [b"\x02"]
    assert n.events() == [{"t": "mode", "value": 2}]
    assert core.read_mode() == b"\x02"


def test_photo_without_a_camera_says_so_instead_of_breaking(loop):
    core, n = build(loop)
    core.write_control(b'{"cmd":"photo"}')
    loop.run_until_complete(_drain(loop))
    assert n.events() == [{"t": "error", "msg": "no camera: use measure"}]


def test_photo_with_a_camera_transfers_what_was_captured(loop):
    async def capture():
        return b"JPEG" * 100

    core, n = build(loop, capture)
    core.write_control(b'{"cmd":"photo","chunk":24}')
    loop.run_until_complete(_drain(loop))
    assert n.events()[0]["kind"] == "photo"
    assert join(n.of(TRANSFER)) == b"JPEG" * 100


def test_ap_turns_on_for_a_bounded_time_and_says_so(loop):
    calls = []
    core, n = build(loop, ap_control=calls.append)
    core.write_control(b'{"cmd":"ap","value":true,"minutes":999}')
    loop.run_until_complete(_drain(loop))
    assert calls == [True]
    assert n.events()[0] == {"t": "ap", "on": True, "minutes": 60}  # cap: it is never left without a network forever
    assert core._ap_off_timer is not None  # the automatic switch-off was scheduled
    core.write_control(b'{"cmd":"ap","value":false}')
    loop.run_until_complete(_drain(loop))
    assert calls == [True, False]
    assert core._ap_off_timer is None


def test_changing_mode_does_not_touch_the_ap(loop):
    # Since 2026-09-07 the AP stays on at all times; the mode neither turns it on nor off.
    calls = []
    core, n = build(loop, ap_control=calls.append)
    core.write_control(b'{"cmd":"mode","value":2}')
    core.write_control(b'{"cmd":"mode","value":0}')
    loop.run_until_complete(_drain(loop))
    assert calls == []
    assert [e["t"] for e in n.events()] == ["mode", "mode"]


def test_wifi_returns_the_credentials_or_empty(loop):
    core, _ = build(loop, read_wifi=lambda: {"ssid": "ViroVision", "password": "x", "ip": "10.42.0.1", "port": 8080})
    assert json.loads(core.read_wifi()) == {"ssid": "ViroVision", "password": "x", "ip": "10.42.0.1", "port": 8080}
    without_ap, _ = build(loop)
    assert without_ap.read_wifi() == b"{}"


def test_ap_without_support_is_an_error_not_an_exception(loop):
    core, n = build(loop)
    core.write_control(b'{"cmd":"ap"}')
    loop.run_until_complete(_drain(loop))
    assert n.events()[0]["t"] == "error"


def test_status_can_be_requested_by_command(loop):
    core, n = build(loop)
    core.write_control(b'{"cmd":"status"}')
    loop.run_until_complete(_drain(loop))
    assert json.loads(n.of(STATUS)[0]) == {"version": "t"}
