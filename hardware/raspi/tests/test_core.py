"""Exists because the core is the code that runs both on the device and in the Mac emulator: if the
`measure` command did not wrap the transfer in `start`/`end`, or split it with a chunk size other
than the one the app asked for, the app would measure wrong or never finish, and both environments
would fail identically without either of them showing it."""

import asyncio
import json
import os
import sys
import threading

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


def test_two_clicks_ask_for_a_reading_every_time(loop):
    """The point of the 2026-09-10 update: in front of the shelf the user repeats the gesture to read
    the next product. The first double click changes the mode AND asks for a reading; the second one
    changes nothing and still has to ask, or the button reads as dead."""
    core, n = build(loop)
    core.from_button(2)
    loop.run_until_complete(_drain(loop))
    assert [e["t"] for e in n.events()] == ["mode", "read"]

    core.from_button(2)
    loop.run_until_complete(_drain(loop))
    # No second "mode": it did not change, and re-announcing it would speak over the user.
    assert [e["t"] for e in n.events()] == ["mode", "read", "read"]
    assert n.events()[-1] == {"t": "read", "mode": 2}


def test_one_click_does_not_ask_for_a_reading(loop):
    """Bus mode is surveillance: it keeps watching on its own, so repeating the gesture asks for
    nothing new. If this ever emitted `read`, every click would cost a photo and a cloud call."""
    core, n = build(loop)
    core.from_button(1)
    core.from_button(1)
    loop.run_until_complete(_drain(loop))
    assert [e["t"] for e in n.events()] == ["mode"]


def test_a_mode_set_over_ble_does_not_ask_for_a_reading(loop):
    """Only the physical button asks. When the app sets the mode it already knows it has to read, so
    an event here would take a second photo for the same gesture."""
    core, n = build(loop)
    core.write_control(b'{"cmd":"mode","value":2}')
    loop.run_until_complete(_drain(loop))
    assert [e["t"] for e in n.events()] == ["mode"]


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


# --- review of 2026-10-06: nothing the air or the network sends may take the daemon down ----------


def _until(loop_, condition, timeout_s=2.0):
    """For work that crosses an executor thread: `_drain` only waits for tasks."""

    async def wait():
        deadline = loop_.time() + timeout_s
        while not condition():
            assert loop_.time() < deadline, "the condition never became true"
            await asyncio.sleep(0.01)

    loop_.run_until_complete(wait())


def test_a_long_network_name_is_trimmed_instead_of_crashing_the_heartbeat(loop):
    """The status JSON went over EVENT_MAX_BYTES with a long NetworkManager profile name, `_json`
    raised in the 15 s heartbeat, and the daemon crash-looped for as long as the board stayed on that
    network. Trimmed by UTF-8 bytes: an emoji or an accent is several bytes per character."""
    from virovision.core import EVENT_MAX_BYTES

    status = {"version": "0.1.0", "temp": 51.2, "uptime": 123456, "battery": 87, "camera": True, "wifi": True,
              "ip": "192.168.100.123", "port": 8080, "ap": False, "network": "Casa de la abuela ñandú 📶" * 10}
    core = Core(loop, lambda: status, None, bytes, Notifications())
    data = core.read_status()
    assert len(data) <= EVENT_MAX_BYTES
    decoded = json.loads(data)
    assert decoded["network"].startswith("Casa de la abuela") and decoded["ip"] == "192.168.100.123"


def test_a_long_multibyte_error_still_fits_one_notification(loop):
    """`[:150]` counted characters; 150 accented or emoji characters are far past 180 bytes."""
    from virovision.core import EVENT_MAX_BYTES

    core, n = build(loop)
    core.write_control(json.dumps({"cmd": "ñ" * 200}, ensure_ascii=False).encode())
    loop.run_until_complete(_drain(loop))
    raw = n.of(EVENT)[0]
    assert len(raw) <= EVENT_MAX_BYTES
    assert json.loads(raw)["msg"].startswith("unknown command: ñ")


def test_measure_never_generates_more_than_the_cap(loop):
    """The byte count arrives over the air and went straight to `os.urandom`: one write asking for
    gigabytes was an out-of-memory kill on a 512 MB board."""
    from virovision.core import MEASURE_MAX_BYTES

    asked = []
    n = Notifications()
    core = Core(loop, lambda: {}, None, lambda amount: asked.append(amount) or b"x", n)
    core.write_control(b'{"cmd":"measure","bytes":4000000000}')
    loop.run_until_complete(_drain(loop))
    assert asked == [MEASURE_MAX_BYTES]


@pytest.mark.parametrize("command", [b"[]", b'"photo"', b"3", b'{"cmd":"measure","bytes":"lots"}',
                                     b'{"cmd":"mode","value":null}', b'{"cmd":"ap","minutes":"x"}',
                                     b'{"cmd":"measure","bytes":1e400}'])
def test_a_malformed_command_is_an_error_event_not_an_exception(loop, command):
    """These raised inside BlueZ's D-Bus setter: the app got no answer at all, the journal a trace."""
    core, n = build(loop, ap_control=lambda on: None)
    core.write_control(command)
    loop.run_until_complete(_drain(loop))
    assert [e["t"] for e in n.events()] == ["error"]


def test_bus_mode_that_cannot_start_says_why(loop):
    """`start`'s False died in the executor's future: the user heard "modo ómnibus activado" from the
    app and then nothing, ever, with no way to tell why from the phone."""

    class UnavailableBus:
        audio_target = "device"
        unavailable_reason = "no detector in the sensor"

        def start(self):
            return False

        def stop(self):
            pass

    core, n = build(loop)
    core.attach_bus(UnavailableBus())
    core.from_button(1)
    # `start` runs on an executor thread and its event comes back through `emit_event`.
    _until(loop, lambda: {"t": "error", "msg": "bus unavailable: no detector in the sensor"} in n.events())


def test_a_background_failure_reaches_the_journal(loop, caplog):
    """Executor futures nobody awaited swallowed their exceptions without a trace."""

    class BrokenBus:
        audio_target = "device"

        def start(self):
            raise RuntimeError("the OCR process died")

        def stop(self):
            pass

    core, _ = build(loop)
    core.attach_bus(BrokenBus())
    with caplog.at_level("ERROR", logger="virovision.core"):
        core.from_button(1)
        _until(loop, lambda: any(r.exc_info and "the OCR process died" in str(r.exc_info[1]) for r in caplog.records))


def test_a_measure_whose_pauses_add_up_past_a_minute_is_refused(loop):
    """5 MB in 182-byte chunks at 1 s each held the single transfer slot for eight hours."""
    asked = []
    n = Notifications()
    core = Core(loop, lambda: {}, None, lambda amount: asked.append(amount) or b"x", n)
    core.write_control(b'{"cmd":"measure","bytes":53000,"interval_ms":1000}', mtu=185)
    loop.run_until_complete(_drain(loop))
    assert asked == [] and [e["t"] for e in n.events()] == ["error"]


def test_restart_camera_runs_the_same_restart_the_watchdog_uses(loop):
    """The test hook for the recovery path: without it, checking that bus mode survives a camera
    restart needed the camera to fail on its own (2026-10-06)."""
    restarted = threading.Event()
    n = Notifications()
    core = Core(loop, lambda: {}, None, bytes, n, restart_camera=restarted.set)
    core.write_control(b'{"cmd":"restart_camera"}')
    loop.run_until_complete(_drain(loop))
    assert restarted.wait(2)
    assert n.events() == []


def test_restart_camera_without_a_camera_says_so(loop):
    core, n = build(loop)
    core.write_control(b'{"cmd":"restart_camera"}')
    loop.run_until_complete(_drain(loop))
    assert [e["msg"] for e in n.events()] == ["no camera to restart"]
