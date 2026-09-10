"""Operating-mode state machine (ADR 0007).

1 click = bus mode, 2 clicks = supermarket mode, from any state; a long press from any mode = back
to idle. Entering a mode leaves the previous one. Never "always on": announcing everything the
camera sees, all the time, is overwhelming. The physical button's debounce (long-press threshold,
double-click window) does not live here: it is defined with real hardware and calls `from_clicks` /
`long_press`.

The canonical diagram is in `docs/architecture/README.md` and `app/src/features/reader/modes.ts`
mirrors this machine: if one of the three changes, the other two change in the same PR, or the app
and the firmware tell the user different stories and no screen gives it away.
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
        # A gesture names a mode, not a step (ADR 0007, 2026-09-09 update): 1 click is always bus and
        # 2 clicks always supermarket, from wherever the device is. Until that date clicks only
        # counted from idle and switching modes needed a long press in between; with the button
        # soldered, pressing twice and getting nothing reads as "the button is broken".
        target = self.mode_for_clicks(clicks)
        return self.change(target) if target is not None else False

    @staticmethod
    def mode_for_clicks(clicks: int) -> Mode | None:
        """The mode a click count names, or None when it names none. Split out from `from_clicks` so
        the caller can tell "not a mode gesture" from "already in that mode": both leave the state
        untouched, but only the second one is worth announcing."""
        if clicks == 1:
            return Mode.BUS
        if clicks == 2:
            return Mode.SUPERMARKET
        return None

    def long_press(self) -> bool:
        return self.change(Mode.IDLE)
