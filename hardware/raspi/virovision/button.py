"""Physical button on a GPIO (ADR 0007).

The only control the user has on the device. From *idle*: **1 click** = bus mode, **2 clicks** =
supermarket mode; **holding it down** = back to idle from wherever. There is no screen and no
indicator: every transition is announced by audio, so a misread click leaves the user not knowing
which mode they are in. That is why the timings are explicit and measurable, and the logic that uses
them is tested end to end on the Mac.

The split of responsibilities is the one `modes.py` asks for: *what* each gesture does lives there,
*how* the gesture is recognized lives here. `ClickDetector` is pure (it knows nothing of GPIO or of
the clock) and `Button` connects it to gpiozero.
"""

from __future__ import annotations

import logging
from typing import Callable, Optional, Protocol

log = logging.getLogger(__name__)

# GPIO 5 = physical pin 29, with its GND on pin 30 right beside it: two adjacent pins, which is what
# makes the wiring mistake-proof. Internal pull-up and the button to ground, no external resistor.
DEFAULT_GPIO = 5

# The three timings, to be calibrated with the real hardware and with eyes closed (which is how it is
# used). A 6x6 tact switch's mechanical bounce is on the order of 10 ms; 50 gives margin without
# feeling slow.
DEBOUNCE_S = 0.05
# How long it has to be held for it to count as "leave the mode". Considerably longer than a normal
# click: leaving by accident is worse than having to insist, because it leaves the user without the
# mode they thought they had.
LONG_PRESS_S = 0.8
# How long is waited after release before deciding how many clicks there were. It is the price of the
# double click: a single click takes this long to apply.
DOUBLE_CLICK_WINDOW_S = 0.4


class _Cancellable(Protocol):
    def cancel(self) -> None: ...


# Schedules a function for N seconds from now and returns something cancellable. On the device it is
# `loop.call_later`; in the tests, a fake clock.
Schedule = Callable[[float, Callable[[], None]], _Cancellable]


class ClickDetector:
    """Translates presses into intent: "that was N clicks" or "they held it down".

    It touches no hardware and looks at no clock: the driver tells it what happened and lends it a
    `schedule`. That way the timings are tested without waiting for them and without a board (the
    device's README: on the Mac only the pure parts are tested).

    A long press does NOT also count as a click: on release after holding, the press is already
    consumed. Otherwise leaving a mode would immediately trigger bus mode.
    """

    def __init__(
        self,
        on_clicks: Callable[[int], None],
        on_hold: Callable[[], None],
        schedule: Schedule,
        window_s: float = DOUBLE_CLICK_WINDOW_S,
    ) -> None:
        self._on_clicks = on_clicks
        self._on_hold = on_hold
        self._schedule = schedule
        self._window_s = window_s
        self._clicks = 0
        self._was_long = False
        self._pending: Optional[_Cancellable] = None

    def pressed(self) -> None:
        self._was_long = False

    def held(self) -> None:
        """The hold threshold was met, with the button still pressed. It acts here and not on release:
        the user needs the audio announcement at the moment the gesture completes, not when they
        decide to lift their finger."""
        self._was_long = True
        self._forget_pending()
        self._clicks = 0
        self._on_hold()

    def released(self) -> None:
        if self._was_long:
            self._was_long = False
            return
        self._clicks += 1
        self._forget_pending()
        self._pending = self._schedule(self._window_s, self._resolve)

    def _resolve(self) -> None:
        clicks, self._clicks = self._clicks, 0
        self._pending = None
        if clicks:
            self._on_clicks(clicks)

    def _forget_pending(self) -> None:
        if self._pending is not None:
            self._pending.cancel()
            self._pending = None


class Button:
    """Connects a push button on a GPIO to the core.

    gpiozero calls its callbacks from its own thread, so everything enters the asyncio loop through
    `call_soon_threadsafe` and the detector always runs on the loop's thread. Without that, two
    gestures in a row could step on the click counter.
    """

    def __init__(
        self,
        loop,
        on_clicks: Callable[[int], None],
        on_hold: Callable[[], None],
        gpio: int = DEFAULT_GPIO,
        long_press_s: float = LONG_PRESS_S,
        window_s: float = DOUBLE_CLICK_WINDOW_S,
        debounce_s: float = DEBOUNCE_S,
    ) -> None:
        # gpiozero is imported here and not at the top: on the Mac (tests and emulator) it is not
        # installed, and this module has to remain importable anyway.
        from gpiozero import Button as GpioButton  # type: ignore[import-not-found]

        self._detector = ClickDetector(on_clicks, on_hold, loop.call_later, window_s)
        # pull_up: the push button goes from the GPIO to ground, with no external resistor.
        self._button = GpioButton(gpio, pull_up=True, bounce_time=debounce_s, hold_time=long_press_s)
        self._button.when_pressed = lambda: loop.call_soon_threadsafe(self._detector.pressed)
        self._button.when_held = lambda: loop.call_soon_threadsafe(self._detector.held)
        self._button.when_released = lambda: loop.call_soon_threadsafe(self._detector.released)
        log.info(
            "button on GPIO %d (long %.1fs, double click %.1fs, debounce %dms)",
            gpio, long_press_s, window_s, int(debounce_s * 1000),
        )

    def close(self) -> None:
        self._button.close()


def try_connect(loop, on_clicks, on_hold, gpio: int = DEFAULT_GPIO) -> Optional[Button]:
    """The button is optional: without it the app keeps sending modes over BLE. A board without
    gpiozero, without permissions on the GPIO or without a soldered button has to start all the same,
    not be left without a daemon."""
    try:
        return Button(loop, on_clicks, on_hold, gpio=gpio)
    except Exception as exc:  # noqa: BLE001 — gpiozero raises all sorts depending on why the pin fails
        log.warning("no physical button (GPIO %d): %s", gpio, exc)
        return None
