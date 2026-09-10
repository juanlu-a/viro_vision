"""Exists because the button is the user's only control and they have no way of verifying what they
did: if a long press also counted as a click, leaving a mode would immediately put them into another
one; if the second click did not cancel the first one's resolution, a double click would sound like
two announcements. The timings are tested with a fake clock: really waiting 0.4 s per test proves
nothing more and makes the tests slow.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.button import ClickDetector  # noqa: E402
from virovision.modes import ModeMachine, Mode  # noqa: E402


class _Scheduled:
    def __init__(self, fn):
        self.fn = fn
        self.cancelled = False

    def cancel(self):
        self.cancelled = True


class FakeClock:
    """Schedules without waiting; the test decides when the window expires."""

    def __init__(self):
        self.pending = []

    def schedule(self, delay_s, fn):
        scheduled = _Scheduled(fn)
        self.pending.append(scheduled)
        return scheduled

    def expire(self):
        pending, self.pending = self.pending, []
        for s in pending:
            if not s.cancelled:
                s.fn()


def _detector():
    clock = FakeClock()
    clicks, long_presses = [], []
    d = ClickDetector(clicks.append, lambda: long_presses.append(True), clock.schedule)
    return d, clock, clicks, long_presses


def _click(d):
    d.pressed()
    d.released()


def test_one_click_resolves_as_one_click():
    d, clock, clicks, _ = _detector()
    _click(d)
    assert clicks == []  # not yet: a second click may still arrive
    clock.expire()
    assert clicks == [1]


def test_two_clicks_in_a_row_resolve_as_a_single_double():
    d, clock, clicks, _ = _detector()
    _click(d)
    _click(d)
    clock.expire()
    assert clicks == [2]


def test_holding_it_does_not_also_count_as_a_click():
    d, clock, clicks, long_presses = _detector()
    d.pressed()
    d.held()
    d.released()
    clock.expire()
    assert long_presses == [True]
    assert clicks == []


def test_holding_it_cancels_a_pending_click():
    """A click and, before the window expires, holding it down: the long press wins and the previous
    click is not applied. Otherwise the user would leave the mode and enter another in the same
    gesture."""
    d, clock, clicks, long_presses = _detector()
    _click(d)
    d.pressed()
    d.held()
    d.released()
    clock.expire()
    assert long_presses == [True]
    assert clicks == []


def test_the_window_restarts_with_every_click():
    """The first timer is cancelled: if it fired anyway, a double click would give one "bus"
    announcement and another "supermarket" one."""
    d, clock, clicks, _ = _detector()
    _click(d)
    _click(d)
    assert sum(1 for s in clock.pending if not s.cancelled) == 1
    clock.expire()
    assert clicks == [2]


def test_consecutive_gestures_do_not_drag_the_counter():
    d, clock, clicks, _ = _detector()
    _click(d)
    clock.expire()
    _click(d)
    clock.expire()
    assert clicks == [1, 1]


def test_the_gestures_lead_to_the_adr_0007_modes():
    """The whole contract, end to end: gesture → mode."""
    modes = ModeMachine()
    clock = FakeClock()
    d = ClickDetector(modes.from_clicks, modes.long_press, clock.schedule)

    _click(d)
    clock.expire()
    assert modes.current is Mode.BUS

    d.pressed()
    d.held()
    d.released()
    assert modes.current is Mode.IDLE

    _click(d)
    _click(d)
    clock.expire()
    assert modes.current is Mode.SUPERMARKET

    d.pressed()
    d.held()
    d.released()
    assert modes.current is Mode.IDLE
