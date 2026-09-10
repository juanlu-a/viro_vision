"""Operating-mode state machine (ADR 0007).

From *idle*: 1 click = bus mode, 2 clicks = supermarket mode; a long press from any mode = back to
idle. Never "always on": announcing everything the camera sees, all the time, is overwhelming. The
physical button's debounce (long-press threshold, double-click window) does not live here: it is
defined with real hardware and calls `from_clicks` / `long_press`.
"""

from __future__ import annotations

from enum import IntEnum


class Mode(IntEnum):
    IDLE = 0
    BUS = 1
    SUPERMARKET = 2


class ModeMachine:
    def __init__(self) -> None:
        self.current = Mode.IDLE

    def change(self, new: Mode) -> bool:
        """Switches mode. Returns True when a transition happened (so it can be announced: the user
        has no state indicator other than the audio)."""
        if new == self.current:
            return False
        self.current = new
        return True

    def from_clicks(self, clicks: int) -> bool:
        # Clicks only pick a mode from idle; inside a mode the short click stays free to trigger a
        # reading, and leaving is always the long press.
        if self.current is not Mode.IDLE:
            return False
        if clicks == 1:
            return self.change(Mode.BUS)
        if clicks == 2:
            return self.change(Mode.SUPERMARKET)
        return False

    def long_press(self) -> bool:
        return self.change(Mode.IDLE)
