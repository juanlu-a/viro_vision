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
import threading
import time

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.bus import FRAME_SILENCE_S, PRESENCE_SILENCE_S, BusWatcher, Timeline  # noqa: E402
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
        track = 1
        attempts = 1
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


class Clock:
    def __init__(self):
        self.now = 100.0

    def __call__(self):
        return self.now


class Box:
    def __init__(self, x1, y1, height, width):
        self.x1, self.y1, self.height, self.width = x1, y1, height, width
        self.center = (x1 + width / 2, y1 + height / 2)
        self.aspect = width / height

    def contains(self, point):
        x, y = point
        return self.x1 <= x <= self.x1 + self.width and self.y1 <= y <= self.y1 + self.height


class Track:
    def __init__(self, id, height, conf=0.9):
        self.id = id
        self.box = Box(0, 0, height, height * 3)
        self.conf = conf
        self.read_attempts = 0
        self.announced_reading = False


class Sign:
    label = "bus_sign"
    conf = 0.5

    def __init__(self, height, y1=10):
        self.box = Box(20, y1, height, height * 4)


class Lost:
    kind = "lost"

    def __init__(self, track):
        self.track = track


def test_the_timeline_tells_where_the_seconds_went(caplog):
    """A field run used to leave "there is a bus", "read in N ms" and the line, with nothing in
    between: no way to tell a detector that sees the bus late from a reader that reads it slowly
    (2026-09-21). Every step is now stamped with the seconds since the sensor first reported that
    bus, and a bus the tracker loses and finds again keeps that clock."""
    clock = Clock()
    timeline = Timeline(clock=clock, status_every_s=1.0)
    bus = Track(7, height=120)
    with caplog.at_level("INFO", logger="virovision.bus"):
        timeline.frame([bus], [Sign(18)])
        clock.now += 0.5
        timeline.frame([bus], [Sign(20)])  # too soon for a status line
        clock.now += 0.6
        timeline.frame([bus], [Sign(24)])
        bus.read_attempts = 1
        timeline.read_queued(7, 1, Sign(24).box, bus.box)
        clock.now += 1.0
        timeline.read_done(7, None, 990)
        timeline.lost(Lost(7), announced=False)
        clock.now += 2.0
        timeline.frame([bus], [Sign(30)])  # the tracker found the same bus again
    lines = [r.getMessage() for r in caplog.records]
    assert lines == [
        "bus: track 7 appeared: bus 120x360 px at (0,0), conf 0.90, sign 18x72 px at (20,10) aspect 4.0 conf 0.50",
        "bus: track 7 at 1.1 s: bus 120x360 px at (0,0), sign 24x96 px at (20,10) aspect 4.0 conf 0.50, 0 reads",
        "bus: track 7 read #1 queued at 1.1 s: sign 24x96 px at (20,10)",
        "bus: track 7 read in 990 ms at 2.1 s: nothing",
        "bus: track 7 gone at 2.1 s, line never read",
        "bus: track 7 is back at 4.1 s: bus 120x360 px at (0,0), sign 30x120 px at (20,10) aspect 4.0 conf 0.50",
    ]


def test_the_timeline_says_why_a_sign_was_not_read(caplog):
    """The picker has two rules - a wide strip, in the top half of the bus - and the journal has to say
    which one refused this bus's sign."""
    clock = Clock()
    timeline = Timeline(clock=clock)
    bus = Track(1, height=100)  # bus box 100x300 at (0,0): its top half ends at y=50
    with caplog.at_level("INFO", logger="virovision.bus"):
        timeline.frame([bus], [Sign(20, y1=60)])  # a wide sign of this bus, but on its lower half
    assert caplog.records[0].getMessage().endswith("below the bus's top half (it gets a track of its own)")


def test_the_timeline_only_reports_a_bus_own_sign(caplog):
    """The first version printed the tallest sign in the frame against every track, so a sign that
    belonged to another bus - and was being read perfectly well by its own track - was reported as
    refused (2026-09-22). A diagnostic that invents a problem is worse than none."""
    clock = Clock()
    timeline = Timeline(clock=clock)
    bus = Track(1, height=100)  # 100x300 at (0,0)
    far = Sign(60, y1=10)
    far.box.x1, far.box.center = 800, (860, 40)  # another bus's sign, well outside this box
    with caplog.at_level("INFO", logger="virovision.bus"):
        timeline.frame([bus], [far])
    assert caplog.records[0].getMessage().endswith("no sign of its own")


def test_the_timeline_goes_quiet_once_the_line_is_announced(caplog):
    """The per-second status exists to explain a bus that is NOT being read; after the line has been
    said it would only fill the journal."""
    clock = Clock()
    timeline = Timeline(clock=clock)
    bus = Track(1, height=90)
    with caplog.at_level("INFO", logger="virovision.bus"):
        timeline.frame([bus], [])
        bus.announced_reading = True
        for _ in range(5):
            clock.now += 1.0
            timeline.frame([bus], [])
    assert len(caplog.records) == 1


def test_a_silent_camera_is_reopened_by_the_watchdog():
    """A camera that stops delivering blocks the frame loop inside `capture_request`, so the loop
    cannot notice it: another thread watches the clock and reopens the sensor, which is what unblocks
    it. Giving the capture call its own deadline was tried on 2026-09-21 and jammed the camera for
    everything, photos included (picamera2 keeps the expired job in its queue)."""

    class SilentCamera:
        sensor = object()
        restarts = 0

        def restart(self):
            self.restarts += 1

    camera = SilentCamera()
    watcher = BusWatcher(camera, lambda files: None, lambda event: None)
    watcher._last_frame_at = time.monotonic()
    threading.Thread(target=watcher._watchdog, daemon=True).start()
    try:
        watcher._last_frame_at -= FRAME_SILENCE_S + 1  # as if the camera had been quiet that long
        deadline = time.monotonic() + 5
        while camera.restarts == 0 and time.monotonic() < deadline:
            time.sleep(0.05)
        assert camera.restarts == 1
        time.sleep(1.5)
        assert camera.restarts == 1, "the restart takes seconds; it must not fire again meanwhile"
    finally:
        watcher._stop.set()
