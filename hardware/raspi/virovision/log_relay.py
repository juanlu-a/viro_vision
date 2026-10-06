"""The daemon's warnings and errors, sent to the phone as BLE events (2026-10-06).

This board has no screen and, in the street, no SSH: the journal is where every failure is written
and nobody can read it. The app already records telemetry and ships it to Supabase when it has
network, so the cheapest witness is to hand it the journal's important half. Each WARNING or worse
becomes one event on the `event` characteristic:

    {"t": "log", "lvl": "warning" | "error" | "critical", "src": "bus", "msg": "...", "drop": 3}

`src` is the logger's name without the `virovision.` prefix; `msg` is the message (plus the
exception's type and text, when there is one), trimmed by UTF-8 bytes so the whole event fits one
notification at iOS's MTU (`core.event_bytes`); `drop` is present only when the rate limit swallowed
events before this one, and says how many.

Three things keep it from becoming a problem of its own:

- **A rate limit** (PER_MINUTE). A failure that repeats at 15 frames per second must not turn the
  control plane into a log pipe: past the limit events are counted and dropped, not queued.
- **A small ring buffer** (BUFFERED) for what happens while no phone is listening — the boot above
  all, when the camera and the AP fail if they are going to. It is replayed once the app is
  subscribed, which is when it reads `status` right after connecting (`bleClientPlx.connect`): a
  notification sent before that, at the moment BlueZ reports the connection, reaches nobody.
- **No recursion.** Sending an event can itself log (a loop that is closing, a D-Bus error); a record
  produced while this handler is already emitting on the same thread is dropped.

INSTRUMENTATION BOUNDARY: this is diagnostics, never control. Nothing on the board may depend on a
log event arriving, and nothing here may block or raise into the code that logged.
"""

from __future__ import annotations

import logging
import threading
import time
from collections import deque
from typing import Callable, Optional

PER_MINUTE = 10
BUFFERED = 20
MSG_MAX_CHARS = 300
"""A first cut before the byte-exact trim in `core.event_bytes`, so a 10 KB traceback text is not
serialized again and again while it is being shortened."""
SRC_MAX_CHARS = 24

Emit = Callable[[dict], None]


def to_event(record: logging.LogRecord) -> dict:
    try:
        message = record.getMessage()
    except Exception:  # noqa: BLE001 — a bad format string still says something
        message = str(record.msg)
    if record.exc_info and record.exc_info[1] is not None:
        exc = record.exc_info[1]
        message = f"{message} | {type(exc).__name__}: {exc}"
    source = record.name.removeprefix("virovision.").removeprefix("virovision") or "main"
    return {
        "t": "log",
        "lvl": record.levelname.lower(),
        "src": source[:SRC_MAX_CHARS],
        "msg": message[:MSG_MAX_CHARS],
    }


class LogRelay(logging.Handler):
    """Installed on the root logger at startup, before anything can fail. Until `attach` gives it a
    way to emit, and until a phone is subscribed (`subscriber_ready`), it only buffers."""

    def __init__(
        self,
        per_minute: int = PER_MINUTE,
        buffered: int = BUFFERED,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        super().__init__(level=logging.WARNING)
        self._per_minute = per_minute
        self._clock = clock
        self._emit_event: Optional[Emit] = None
        self._sent: deque = deque()
        self._buffer: deque = deque(maxlen=buffered)
        self._dropped = 0
        self._live = False
        self._busy = threading.local()

    def attach(self, emit: Emit) -> None:
        """`emit` must be safe from any thread (`Core.emit_event`): records arrive from the frame
        loop, the HTTP server and executor workers as well as the event loop."""
        self._emit_event = emit

    def subscriber_ready(self) -> None:
        """The app is subscribed (it just read `status`): replay what it missed and go live."""
        self.acquire()
        try:
            if self._live or self._emit_event is None:
                return
            self._live = True
            pending = list(self._buffer)
            self._buffer.clear()
        finally:
            self.release()
        for event in pending:
            self._send(event)

    def central_gone(self) -> None:
        """No central left: buffer again until the next one is subscribed."""
        self.acquire()
        try:
            self._live = False
        finally:
            self.release()

    def emit(self, record: logging.LogRecord) -> None:
        if getattr(self._busy, "on", False):
            return
        self._busy.on = True
        try:
            event = to_event(record)
            if not self._live or self._emit_event is None:
                self._buffer.append(event)
                return
            now = self._clock()
            while self._sent and now - self._sent[0] >= 60.0:
                self._sent.popleft()
            if len(self._sent) >= self._per_minute:
                self._dropped += 1
                return
            self._sent.append(now)
            if self._dropped:
                event["drop"] = self._dropped
                self._dropped = 0
            self._send(event)
        except Exception:  # noqa: BLE001 — see the INSTRUMENTATION BOUNDARY above
            pass
        finally:
            self._busy.on = False

    def _send(self, event: dict) -> None:
        try:
            self._emit_event(event)  # type: ignore[misc]
        except Exception:  # noqa: BLE001 — a closed loop at shutdown, typically
            pass
