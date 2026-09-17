"""Exists because a system notice fails in silence.

The app decides where ViroVision speaks and, when the answer is the device, sends a file name over
BLE. Everything that can go wrong on this side — a name that is not in the set, a board with no
speaker, a `say` that runs on the event loop and blocks BLE — produces no exception and no log the
user can reach: the board simply does not talk. That is indistinguishable from a device that died,
which for someone who cannot see the screen is the worst outcome this project has.

The other half is the setting itself. It used to live only on the bus watcher, so a board where bus
mode is unavailable silently dropped it and kept announcing on its own speaker.
"""

import asyncio
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.core import EVENT, Core  # noqa: E402
from virovision.notices import CLIPS, EARCON_FILE, NOTICES, is_known  # noqa: E402


class Notifications:
    def __init__(self):
        self.received: list[tuple[str, bytes]] = []

    async def __call__(self, name: str, value: bytes) -> None:
        self.received.append((name, bytes(value)))

    def events(self) -> list[dict]:
        return [json.loads(v) for n, v in self.received if n == EVENT]


class FakeBus:
    def __init__(self):
        self.running = False
        self.audio_target = "device"


@pytest.fixture
def loop():
    loop_ = asyncio.new_event_loop()
    yield loop_
    loop_.close()


def build(loop, say=None, bus=None):
    notifications = Notifications()
    core = Core(
        loop,
        lambda: {"version": "t"},
        None,
        lambda amount: bytes(amount),
        notifications,
        bus=bus,
        say=say,
    )
    return core, notifications


async def _drain(loop_):
    for _ in range(5):
        await asyncio.sleep(0)
    pending = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
    if pending:
        await asyncio.gather(*pending)


def _plays(played: list, missing=()):
    """A speaker that has every clip except `missing`."""

    def say(clip: str) -> bool:
        played.append(clip)
        return clip not in missing

    return say


def test_a_known_notice_is_played(loop):
    played: list[str] = []
    core, _ = build(loop, say=_plays(played))

    async def scenario():
        core.write_control(json.dumps({"cmd": "say", "clip": "mode_bus.wav"}).encode())
        # The play runs in an executor so it cannot block the loop BLE is answering from; without
        # this wait the assertion would race the thread.
        await asyncio.sleep(0.05)
        assert played == ["mode_bus.wav"]

    loop.run_until_complete(scenario())


def test_a_clip_missing_from_the_sd_is_reported_instead_of_silent(loop):
    """The failure that cost the first real test (2026-09-16): the app shipped with the notices and
    `announcements/system/` had not been copied to the board yet. `aplay` fails into /dev/null, so
    the board looked like it had spoken and the phone had no way to tell that apart from a speaker
    that is not wired. Now it says which file is missing."""
    played: list[str] = []
    core, notifications = build(loop, say=_plays(played, missing={"mode_bus.wav"}))

    async def scenario():
        core.write_control(json.dumps({"cmd": "say", "clip": "mode_bus.wav"}).encode())
        await asyncio.sleep(0.05)
        await _drain(loop)
        errors = [e for e in notifications.events() if e["t"] == "error"]
        assert len(errors) == 1
        assert "missing notice: mode_bus.wav" in errors[0]["msg"]

    loop.run_until_complete(scenario())


def test_an_unknown_name_is_refused_and_reported(loop):
    """The name arrives over the air. It is checked against the closed set rather than sanitized as
    a path, so `../` cannot be clever about it — and the app finds out instead of wondering why the
    board went quiet."""
    played: list[str] = []
    core, notifications = build(loop, say=_plays(played))

    async def scenario():
        for clip in ("../../etc/passwd", "system/mode_bus.wav", "", "mode_train.wav"):
            core.write_control(json.dumps({"cmd": "say", "clip": clip}).encode())
        await _drain(loop)
        assert played == []
        errors = [e for e in notifications.events() if e["t"] == "error"]
        assert len(errors) == 4
        assert all("unknown notice" in e["msg"] for e in errors)

    loop.run_until_complete(scenario())


def test_a_board_with_no_speaker_stays_alive(loop):
    """`--no-audio`, or a Mac emulator. The daemon has to keep answering BLE: a device that stops
    working because nothing can play a notice would be far worse than a quiet one."""
    core, notifications = build(loop, say=None)

    async def scenario():
        core.write_control(json.dumps({"cmd": "say", "clip": "mode_idle.wav"}).encode())
        await _drain(loop)
        assert [e for e in notifications.events() if e["t"] == "error"] == []

    loop.run_until_complete(scenario())


def test_the_setting_is_kept_even_with_no_bus_mode(loop):
    """The regression this file was written for. `audio_target` used to be written straight onto the
    watcher, so a board with no `.rpk` in the sensor —or without `bus_banner` installed— threw the
    user's choice away and nothing here remembered it."""
    core, notifications = build(loop, bus=None)

    async def scenario():
        core.write_control(json.dumps({"cmd": "audio", "target": "phone"}).encode())
        await _drain(loop)
        assert core.audio_target == "phone"
        assert [e for e in notifications.events() if e["t"] == "error"] == []

    loop.run_until_complete(scenario())


def test_a_watcher_attached_later_inherits_the_setting(loop):
    """Bus mode is built after the service, and the app can have written the setting before that.
    A watcher starting on its own default would announce over the choice until the next write."""
    core, _ = build(loop)

    async def scenario():
        core.write_control(json.dumps({"cmd": "audio", "target": "phone"}).encode())
        await _drain(loop)
        bus = FakeBus()
        core.attach_bus(bus)
        assert bus.audio_target == "phone"

    loop.run_until_complete(scenario())


def test_every_notice_the_app_can_ask_for_is_in_the_set():
    """`CLIPS` is what `is_known` answers from, and it is what the app's mirror is compared against.
    A notice recorded by the generator but missing from the set would be refused at runtime."""
    assert CLIPS == frozenset(NOTICES) | {EARCON_FILE}
    assert all(is_known(clip) for clip in CLIPS)
    assert all(clip.endswith(".wav") for clip in CLIPS)
    # No separators anywhere: the whole point is that a name never becomes a path.
    assert all("/" not in clip and "\\" not in clip for clip in CLIPS)
