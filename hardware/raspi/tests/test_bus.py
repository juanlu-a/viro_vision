"""Exists because bus mode is the first thing on this device that holds the camera for as long as the
user wants, and everything around that is easy to get wrong in ways nobody notices until the street:
the watcher has to start and stop with the mode (or the camera stays busy and supermarket stops
taking photos), a repeated click has to repeat instead of doing nothing, and a reading arrives from a
thread that is not the event loop's — `create_task` from there is a silent no-op that would lose it.

None of this needs a camera, a model or an OCR: the watcher is faked, which is also the shape the
daemon sees when `bus_banner` is not installed.
"""

import asyncio
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.bus import PRESENCE_SILENCE_S, BusWatcher  # noqa: E402
from virovision.core import EVENT, EVENT_MAX_BYTES, Core  # noqa: E402
from virovision.modes import Mode  # noqa: E402


class Notifications:
    def __init__(self):
        self.received: list[tuple[str, bytes]] = []

    async def __call__(self, name: str, value: bytes) -> None:
        self.received.append((name, bytes(value)))

    def events(self) -> list[dict]:
        return [json.loads(v) for n, v in self.received if n == EVENT]


class FakeBus:
    """What the core is allowed to ask of bus mode, and nothing else."""

    def __init__(self):
        self.running = False
        self.audio_target = "device"
        self.repeats = 0

    def start(self):
        self.running = True
        return True

    def stop(self):
        self.running = False

    def repeat_last(self):
        self.repeats += 1
        return True


@pytest.fixture
def loop():
    loop_ = asyncio.new_event_loop()
    yield loop_
    loop_.close()


async def _drain(loop_):
    for _ in range(5):
        await asyncio.sleep(0)
    pending = [t for t in asyncio.all_tasks(loop_) if t is not asyncio.current_task()]
    if pending:
        await asyncio.gather(*pending)


def build(loop_, bus=None):
    notifications = Notifications()
    core = Core(loop_, lambda: {"version": "t"}, None, lambda n: b"", notifications, bus=bus)
    return core, notifications


def test_the_watcher_starts_and_stops_with_the_mode(loop):
    """If it did not stop, the camera would stay busy and the supermarket photo would fail."""
    bus = FakeBus()
    core, _ = build(loop, bus)

    async def scenario():
        core.from_button(1)  # bus
        await _drain(loop)
        assert bus.running
        core.button_long_press()  # back to idle
        await _drain(loop)
        assert not bus.running

    loop.run_until_complete(scenario())


def test_a_repeated_click_in_bus_mode_repeats_the_announcement(loop):
    """The mode does not change, so the old code logged 'already in BUS' and did nothing. Bus mode
    watches on its own: there is nothing new to ask for, but there is something to hear again."""
    bus = FakeBus()
    core, notifications = build(loop, bus)

    async def scenario():
        core.from_button(1)
        await _drain(loop)
        core.from_button(1)
        await _drain(loop)
        assert bus.repeats == 1
        assert [e["t"] for e in notifications.events()] == ["mode"]  # it is not announced twice

    loop.run_until_complete(scenario())


def test_supermarket_does_not_start_the_watcher(loop):
    bus = FakeBus()
    core, _ = build(loop, bus)

    async def scenario():
        core.from_button(2)
        await _drain(loop)
        assert not bus.running

    loop.run_until_complete(scenario())


def test_the_app_chooses_where_the_reading_is_heard(loop):
    bus = FakeBus()
    core, notifications = build(loop, bus)

    async def scenario():
        core.write_control(json.dumps({"cmd": "audio", "target": "phone"}).encode())
        await _drain(loop)
        assert bus.audio_target == "phone"
        core.write_control(json.dumps({"cmd": "audio", "target": "megaphone"}).encode())
        await _drain(loop)
        assert bus.audio_target == "phone"  # unchanged
        assert notifications.events()[-1]["t"] == "error"

    loop.run_until_complete(scenario())


def test_a_reading_emitted_from_another_thread_reaches_the_app(loop):
    """The frame loop is a thread of its own. `create_task` from there does nothing and the reading
    would be lost without a trace; `emit_event` has to bridge it to the loop."""
    core, notifications = build(loop)
    event = {"t": "result", "event": {"timestamp": 1, "primary": {"kind": "bus_line", "label": "115"}, "others": []}}

    async def scenario():
        await asyncio.get_running_loop().run_in_executor(None, core.emit_event, event)
        await _drain(loop)
        assert notifications.events()[-1] == event
        assert len(json.dumps(event, separators=(",", ":")).encode()) <= EVENT_MAX_BYTES

    loop.run_until_complete(scenario())


def test_without_a_sensor_bus_mode_is_unavailable_and_the_daemon_carries_on():
    """A board with no model (or no OCR installed) still takes photos and answers the app."""

    class CameraWithoutModel:
        sensor = None

    watcher = BusWatcher(CameraWithoutModel(), announce=lambda files: None, emit=lambda event: None)
    assert watcher.available is False
    assert watcher.start() is False
    assert watcher.repeat_last() is False
    watcher.stop()  # must not raise


def test_the_mode_still_changes_without_bus_mode(loop):
    """`bus=None` is the normal state of a board with no detector: modes have to keep working."""
    core, notifications = build(loop, None)

    async def scenario():
        core.from_button(1)
        await _drain(loop)
        assert core.modes.current is Mode.BUS
        core.from_button(1)  # the repeat path must not blow up without a watcher
        await _drain(loop)
        assert [e["t"] for e in notifications.events()] == ["mode"]

    loop.run_until_complete(scenario())


def test_the_same_bus_seen_twice_is_announced_once():
    """The board said "115, Luis Braille" twice within a second on its first run from the button: the
    camera was moved while the bus was in frame, the tracker lost it, and the same bus came back as a
    new track. Anything that makes the tracker lose a bus would do the same, and a blind user hearing
    the line twice cannot tell whether a second bus arrived (2026-09-15)."""

    class CameraWithoutModel:
        sensor = None

    watcher = BusWatcher(CameraWithoutModel(), lambda files: None, lambda event: None)
    assert not watcher._is_an_echo("115", "LUIS BRAILLE"), "the first time is news"
    assert watcher._is_an_echo("115", "LUIS BRAILLE"), "a second later, still the same bus"
    assert not watcher._is_an_echo("183", "PUNTA CARRETAS"), "another line is always news"
    assert not watcher._is_an_echo("115", "LUIS BRAILLE"), "115 stopped being the last one announced"


def test_a_bus_is_announced_once_even_if_the_tracker_sees_several():
    """«Se acerca un ómnibus» salía una vez por track, y un ómnibus que se pierde y vuelve es un
    track nuevo. Probando con videos el 2026-09-15 la frase se repitió muchas veces seguidas: los
    cortes del video rompían el seguimiento. La frase no distingue un ómnibus de otro, así que
    repetirla no agrega nada."""

    class CameraWithoutModel:
        sensor = None

    watcher = BusWatcher(CameraWithoutModel(), lambda files: None, lambda event: None)
    assert watcher._presence_is_worth_saying(), "el primero sí"
    assert not watcher._presence_is_worth_saying(), "un instante después, no"
    watcher._last_voice_at -= PRESENCE_SILENCE_S + 1  # pasó la ventana
    assert watcher._presence_is_worth_saying(), "más tarde vuelve a ser noticia"


def test_the_line_silences_the_presence_that_would_follow_it():
    """Decir «se acerca un ómnibus» después de haber dicho «ómnibus 115, Luis Braille» es contar algo
    que el usuario ya sabe, y así llegaba: el anuncio de la línea no armaba la ventana de silencio."""

    class Event:
        kind = "reading"
        number = "115"
        destination = "LUIS BRAILLE"

        def phrase(self):
            return "Bus 115, LUIS BRAILLE"

    class CameraWithoutModel:
        sensor = None

    watcher = BusWatcher(CameraWithoutModel(), lambda files: None, lambda event: None)
    watcher._files_for = lambda number, destination: []  # los .wav viven en la placa, no acá
    watcher._result_event = lambda event: {}  # el evento BLE tiene su propio test
    watcher._handle(Event())
    assert not watcher._presence_is_worth_saying()
