"""The device's core, independent of the BLE transport.

The commands, the mode machine and the transfers live here; what changes between the device (BlueZ
over D-Bus, `gatt.py`) and the emulator on the Mac (CoreBluetooth, `emulator.py`) is only how a
notification is published, and that comes in through `notify`. That way the emulator runs exactly the
code that will run on the device, and what is tested on the Mac is what gets deployed.

What travels where (ADR 0003): BLE is the control plane, always alive. Whether the photo also travels
here, or over WiFi, was decided by the measurement the `measure` command performs.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Awaitable, Callable, Optional

from .modes import ModeMachine, Mode
from .notices import is_known
from .transfer import InvalidChunkError, split

log = logging.getLogger(__name__)

# iOS negotiates ATT MTU 185 → 182 bytes of notification. It is the default when the transport does
# not tell us the MTU and the app did not send one either.
DEFAULT_CHUNK = 182
DEFAULT_BYTES = 53_000  # the 1024 px photo the app sends to the cloud today
# A whole event has to fit in one notification at iOS's MTU, without splitting.
EVENT_MAX_BYTES = 180

# Logical names of the notifiable characteristics; the transport maps them to their UUIDs.
MODE = "mode"
EVENT = "event"
TRANSFER = "transfer"
STATUS = "status"

Capture = Callable[[], Awaitable[bytes]]
Notify = Callable[[str, bytes], Awaitable[None]]
# Turn the WiFi AP on/off; None when the transport does not offer it (the Mac emulator).
ApControl = Callable[[bool], None]
# Plays one system notice by file name (`notices.py`); None when the transport has no speaker (the
# Mac emulator, or `--no-audio`). It returns whether the file was actually there: a clip missing from
# the SD is the one failure of this path that is otherwise completely silent — `aplay` exits with an
# error into /dev/null and the board looks like it spoke.
Say = Callable[[str], bool]
# Cuts off whatever the speaker is playing. None when the board has nothing to play with.
Hush = Callable[[], None]
DEFAULT_AUDIO_TARGET = "device"
AUDIO_TARGETS = ("device", "phone")
AP_MINUTES_DEFAULT = 10
AP_MINUTES_MAX = 60
MEASURE_MAX_BYTES = 5_000_000
"""The most `measure` will generate, over BLE or HTTP. The byte count arrives over the air and went
straight into `os.urandom`: one write asking for a few gigabytes was an out-of-memory kill of the
daemon on a 512 MB board (review of 2026-10-06). 5 MB is ~100 photos, far past any useful measure."""
INTERVAL_MAX_MS = 1_000
"""Pause between chunks a `measure` may ask for. Unbounded, one write could hold the single transfer
slot for hours, and every photo after it would answer "a transfer is already in progress"."""


def _json(obj: dict) -> bytes:
    data = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode()
    if len(data) > EVENT_MAX_BYTES:
        raise ValueError(f"a {len(data)}-byte event does not fit in one notification")
    return data


def fit(obj: dict, key: str, max_bytes: int = EVENT_MAX_BYTES) -> bytes:
    """`_json`, trimming the string at `key` until the whole object fits in one notification.

    Since 2026-10-06. The sizes that overflowed were never the fixed fields but the one free-text
    field of each payload — an exception's message, a NetworkManager connection name the user typed —
    and `_json` raised on them. In the heartbeat that ValueError escaped `notify_status` and the
    daemon crash-looped under systemd for as long as the board stayed on that network.

    Trimmed by UTF-8 bytes, not characters: `[:150]` of a Spanish message (or of an SSID with an
    emoji) is up to 600 bytes. Escaping (quotes, control characters) only makes the serialized form
    longer than the raw text, so cutting the raw text by the overflow always makes progress.
    Raises ValueError only when the object does not fit even with the field empty."""
    obj = dict(obj)
    while True:
        data = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode()
        overflow = len(data) - max_bytes
        if overflow <= 0:
            return data
        text = obj.get(key)
        if not isinstance(text, str) or not text:
            raise ValueError(f"a {len(data)}-byte payload does not fit in one notification")
        raw = text.encode()
        # `errors="ignore"` drops a multi-byte character cut in half instead of leaving a broken one.
        obj[key] = raw[: max(0, len(raw) - overflow)].decode(errors="ignore")


def event_bytes(obj: dict) -> bytes:
    """An event ready for the `event` characteristic, never an exception: its free text (`msg`) is
    trimmed to fit (`fit`). It is called on the loop thread from callbacks, where a raise is logged by
    asyncio and the event —usually an error the app is waiting to hear— is simply lost."""
    try:
        return fit(obj, "msg")
    except ValueError:
        log.error("event %s does not fit in one notification; sent as a bare error", obj.get("t"))
        return _json({"t": "error", "msg": f"oversized {obj.get('t')} event"[:60]})


class Core:
    def __init__(
        self,
        loop: asyncio.AbstractEventLoop,
        read_status: Callable[[], dict],
        capture: Optional[Capture],
        synthetic_payload: Callable[[int], bytes],
        notify: Notify,
        ap_control: Optional[ApControl] = None,
        read_wifi: Optional[Callable[[], dict]] = None,
        bus=None,
        say: Optional[Say] = None,
        hush: Optional[Hush] = None,
    ) -> None:
        self._loop = loop
        self._read_status = read_status
        self._capture = capture
        self._synthetic_payload = synthetic_payload
        self._notify = notify
        self._ap_control = ap_control
        self._read_wifi = read_wifi
        self._bus = bus
        self._say = say
        self._hush = hush
        self.audio_target = DEFAULT_AUDIO_TARGET
        """Where the user wants to hear ViroVision, as last written by the app (`cmd: 'audio'`).

        **It lives on the core and not on the watcher, since 2026-09-16.** It used to be set straight
        on `bus`, so a board with bus mode unavailable —no `.rpk` in the sensor, `bus_banner` not
        installed— dropped the setting on the floor and nothing on this side ever knew it. The
        default is the device because that is what works with no phone in range.
        """
        self._ap_off_timer: Optional[asyncio.TimerHandle] = None
        self.modes = ModeMachine()
        self._transfer_id = 0
        self._transfer_in_flight: Optional[asyncio.Task] = None

    def attach_bus(self, bus) -> None:
        """Wires bus mode in after the fact: the watcher needs to emit events through this core, and
        this core needs to start and stop the watcher, so one of the two has to be set afterwards."""
        self._bus = bus
        # The watcher is built after the first `audio` write may already have arrived, so it is told
        # the current target rather than starting on its own default and speaking over the choice.
        bus.audio_target = self.audio_target

    def camera_ready(self) -> None:
        """The camera finished starting in the background (`__main__`, since 2026-10-05). If the user
        entered bus mode while it was still starting, the watcher could not begin then: it begins now,
        without them having to press again."""
        if self.modes.current is Mode.BUS:
            self._apply_bus_mode(Mode.BUS)

    def emit_event(self, obj: dict) -> None:
        """Send an event from ANY thread. Bus mode announces from its own frame thread, and
        `create_task` off the loop thread is a silent no-op that would lose every reading."""
        self._loop.call_soon_threadsafe(self._event, obj)

    # --- reads (synchronous: that is how BlueZ and CoreBluetooth ask for them) --------------

    def read_mode(self) -> bytes:
        return bytes([int(self.modes.current)])

    def read_status(self) -> bytes:
        """Never raises (2026-10-06): it runs in the GATT read, `notify_status` and the 15 s heartbeat,
        and an exception from it took the daemon down. `network` is the one field whose length nobody
        on this side controls — it is the name of whatever WiFi profile the board is on."""
        status = self._read_status()
        try:
            return fit(status, "network")
        except ValueError:
            log.error("status does not fit in one notification even without the network name")
            return _json({"version": status.get("version")})

    def read_wifi(self) -> bytes:
        """The AP's credentials so the app can join on its own. Empty when this device has no AP."""
        return _json(self._read_wifi()) if self._read_wifi else b"{}"

    # --- writes -----------------------------------------------------------------------------

    def write_mode(self, value: bytes) -> None:
        self._change_mode(int(value[0]) if value else 0)

    # --- physical button (ADR 0007) ----------------------------------------------------------
    # These come in here and not through `write_mode` because the button expresses a gesture, not a
    # mode: which mode each gesture maps to is decided by `ModeMachine`, which also knows which state
    # it is allowed from. The announcement to the app is the same, so the app cannot tell whether the
    # mode was changed by the user's finger or by itself over BLE.

    def from_button(self, clicks: int) -> None:
        """1 click = bus, 2 clicks = supermarket, from wherever the device is (ADR 0007, 2026-09-09
        update). Entering a mode leaves the previous one; leaving altogether is the long press.

        Two clicks ALSO ask for a reading, every time (ADR 0007, 2026-09-10 update) — see
        `_request_reading`. Until that date a repeated double click did nothing, because the capture
        was keyed off the mode transition and there was none; in front of the shelf that reads as a
        dead button, which is the same complaint the previous update fixed one level up.
        """
        if self.modes.mode_for_clicks(clicks) is None:
            log.debug("button: %d click(s) names no mode", clicks)
            return
        if self.modes.from_clicks(clicks):
            self._announce_mode()
        elif self.modes.current is Mode.BUS and self._bus is not None:
            # Already watching: the user did not catch the last announcement. There is nothing new to
            # read —bus mode watches on its own— so the click repeats what it said.
            self._in_executor(self._bus.repeat_last)
        else:
            log.debug("button: already in %s", self.modes.current.name)
        if self.modes.requests_reading(clicks):
            self._request_reading()

    def button_long_press(self) -> None:
        """Hold it down: leave the current mode, from wherever."""
        if self.modes.long_press():
            self._announce_mode()

    def write_control(self, value: bytes, mtu: int = 0) -> None:
        """`mtu` is the one negotiated with this central when the transport knows it (BlueZ passes it
        on the write); it is the datum the app cannot know from our side."""
        try:
            cmd = json.loads(bytes(value).decode())
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            self._event({"t": "error", "msg": f"unreadable command: {exc}"})
            return
        if not isinstance(cmd, dict):
            # `[]`, `"photo"` or `3` are valid JSON: `.get` on them raised inside BlueZ's D-Bus setter.
            self._event({"t": "error", "msg": "a command is a JSON object"})
            return
        log.info("control ← %s (mtu %s)", cmd, mtu or "?")
        # Every field below arrives over the air and goes through `int()`: `{"bytes": "lots"}` or
        # `{"value": null}` raised out of the D-Bus setter, the app got no answer at all and the
        # journal a traceback (review of 2026-10-06). The app hears why instead.
        try:
            self._dispatch(cmd, mtu)
        except (TypeError, ValueError, KeyError, OverflowError) as exc:
            log.warning("control: bad %s command: %s", cmd.get("cmd"), exc)
            self._event({"t": "error", "msg": f"bad {cmd.get('cmd')} command: {exc}"})

    def _dispatch(self, cmd: dict, mtu: int) -> None:
        name = cmd.get("cmd")
        if name == "measure":
            amount = max(0, min(int(cmd.get("bytes", DEFAULT_BYTES)), MEASURE_MAX_BYTES))
            # Parsed before the source exists: a bad `chunk` raising after it would leave an
            # un-awaited coroutine (or, for a photo, a capture already running for nobody).
            chunk, interval_ms = self._chunk(cmd, mtu), self._interval(cmd)
            self._start_transfer(source=self._synthetic_source(amount), chunk=chunk, interval_ms=interval_ms, kind="measurement")
        elif name == "photo":
            if self._capture is None:
                self._event({"t": "error", "msg": "no camera: use measure"})
                return
            chunk, interval_ms = self._chunk(cmd, mtu), self._interval(cmd)
            self._start_transfer(source=self._capture(), chunk=chunk, interval_ms=interval_ms, kind="photo")
        elif name == "mode":
            self._change_mode(int(cmd.get("value", 0)))
        elif name == "audio":
            # Where the user wants to hear ViroVision (the app's setting). The device is the default:
            # its announcements are pre-recorded and work with no phone and no internet.
            target = str(cmd.get("target", DEFAULT_AUDIO_TARGET))
            if target not in AUDIO_TARGETS:
                self._event({"t": "error", "msg": f"unknown audio target: {target}"})
            else:
                self.audio_target = target
                if self._bus is not None:
                    self._bus.audio_target = target
                log.info("audio → %s", target)
        elif name == "say":
            self._say_notice(str(cmd.get("clip", "")))
        elif name == "hush":
            # The phone is about to speak: the board goes quiet. One voice at a time, whichever side
            # it comes from (ADR 0003, 2026-09-18 update). No reply and no event: it is the most
            # urgent thing the app can ask for and there is nothing to answer.
            if self._hush is not None:
                self._hush()
                log.info("hush: speaker cut off")
        elif name == "status":
            self._schedule(self._notify(STATUS, self.read_status()))
        elif name == "ap":
            self._ap(bool(cmd.get("value", True)), int(cmd.get("minutes", AP_MINUTES_DEFAULT)))
        else:
            self._event({"t": "error", "msg": f"unknown command: {name}"})

    def _say_notice(self, clip: str) -> None:
        """Play one of the pre-recorded system notices (`notices.py`).

        **The target is deliberately not checked here.** The app has already applied the user's
        choice —it only sends `say` when the answer was the device— and asking twice would turn a
        failed `audio` write into silence instead of a notice from the wrong speaker. Silence is the
        worse of the two: it is indistinguishable from a device that died.

        The name is checked against the closed set instead of being joined to a path: `clip` arrives
        over the air, and the one thing it must not be able to do is name a file we did not record.
        """
        if not is_known(clip):
            self._event({"t": "error", "msg": f"unknown notice: {clip}"})
            return
        if self._say is None:
            log.debug("say %s: this device has no speaker", clip)
            return
        # In an executor: playing spawns a process, and that does not belong on the event loop that
        # BLE is answering from.
        self._in_executor(self._play_notice, clip)

    def _play_notice(self, clip: str) -> None:
        """Runs on a worker thread. Reports a clip the SD does not have.

        Without this the failure is invisible from the phone: the app sends `say`, the board answers
        nothing, `aplay` fails into /dev/null and the user hears silence — which is exactly what
        happened on 2026-09-16, when the app shipped with the notices and the `.wav` files had not
        been copied yet. Saying *why* it is quiet is the difference between a one-line fix and an
        afternoon.

        `emit_event` and not `_event`: this is not the loop thread, and `create_task` from here would
        be a silent no-op.
        """
        if self._say(clip):
            return
        log.warning("notice %s is not on this board", clip)
        self.emit_event({"t": "error", "msg": f"missing notice: {clip}"})

    def _ap(self, on: bool, minutes: int) -> None:
        """ADR 0003's plan B. The AP is always turned on for a bounded time: the device has a single
        radio and with the AP up it loses its network (and SSH); if the app does not turn it off, it
        turns itself off."""
        if self._ap_control is None:
            self._event({"t": "error", "msg": "this device does not manage the AP"})
            return
        if self._ap_off_timer:
            self._ap_off_timer.cancel()
            self._ap_off_timer = None
        minutes = max(1, min(minutes, AP_MINUTES_MAX)) if on else 0
        self._schedule(self._toggle_ap(on, minutes))

    async def _toggle_ap(self, on: bool, minutes: int) -> None:
        # `nmcli con up` takes several seconds: it goes to a thread so BLE keeps answering.
        try:
            await self._loop.run_in_executor(None, self._ap_control, on)
        except Exception as exc:
            await self._notify(EVENT, event_bytes({"t": "error", "msg": f"ap: {exc}"}))
            return
        if on:
            self._ap_off_timer = self._loop.call_later(minutes * 60, self._ap, False, 0)
        # The event and the new status (with the AP's IP) go out over BLE, which is untouched: that is
        # how the app knows which network to join and where to download the photo from.
        await self._notify(EVENT, _json({"t": "ap", "on": on, "minutes": minutes}))
        await self._notify(STATUS, self.read_status())

    def notify_status(self) -> None:
        self._schedule(self._notify(STATUS, self.read_status()))

    # --- internals ---------------------------------------------------------------------------

    def _schedule(self, coroutine: Awaitable[None]) -> asyncio.Task:
        return self._loop.create_task(coroutine)

    def _in_executor(self, fn: Callable, *args) -> asyncio.Future:
        """`run_in_executor` for work nobody awaits. Until 2026-10-06 those futures were dropped, so
        an exception in `bus.start`, `bus.stop` or a notice was stored in a future no one looked at
        and vanished — not even a journal line. Now it is logged, which also sends it to the app
        (`log_relay.py`)."""
        future = self._loop.run_in_executor(None, fn, *args)
        future.add_done_callback(_log_failure(getattr(fn, "__name__", repr(fn))))
        return future

    def _event(self, obj: dict) -> None:
        self._schedule(self._notify(EVENT, event_bytes(obj)))

    def _change_mode(self, value: int) -> None:
        try:
            new = Mode(value)
        except ValueError:
            self._event({"t": "error", "msg": f"mode {value} does not exist"})
            return
        if self.modes.change(new):
            self._announce_mode()

    def _request_reading(self) -> None:
        """Tell the app to read NOW (ADR 0007, 2026-09-10 update).

        It is its own event and not a re-announcement of the mode for two reasons. The app ignores a
        `mode` event that names the mode it is already in —as it should, or every heartbeat would
        speak— so re-announcing would be silently dropped. And even if it were not, it would make the
        app say "Modo supermercado activado" a second time, which is noise for someone reading three
        products in a row: they asked for a photo, not for a status report.

        The device does not take the photo itself: the app pulls it over HTTP (ADR 0003), so what
        travels here is the intent, not the image.
        """
        log.info("button: reading requested in %s", self.modes.current.name)
        self._event({"t": "read", "mode": int(self.modes.current)})

    def _announce_mode(self) -> None:
        """The transition already happened: report it. The single announcement point, whether the app
        asked for it over BLE or the user with the button, so the two paths cannot drift apart."""
        current = self.modes.current
        log.info("mode → %s", current.name)
        # The transition is also announced by audio on the device once there is a speaker; today only
        # the app is notified.
        self._schedule(self._notify(MODE, self.read_mode()))
        self._event({"t": "mode", "value": int(current)})
        self._apply_bus_mode(current)
        # Since 2026-09-07 the AP does NOT follow the mode: it stays on while the device is powered
        # (`__main__` brings it up at startup) so the phone is already on the network when the user
        # activates a mode. Waiting 20 s for the AP to come up and the phone to join, every time, was
        # unacceptable for the user; the cost is battery, and it is measured. `ap` still exists as a
        # manual command.

    def _apply_bus_mode(self, current: Mode) -> None:
        """Bus mode is the only one that keeps the camera busy, so entering and leaving it starts and
        stops the watcher. In an executor: starting it touches the camera and the OCR, and neither
        belongs on the event loop."""
        if self._bus is None:
            return
        if current is Mode.BUS:
            self._in_executor(self._start_bus)
        else:
            # Always, not only when it is running: a start still building (a cold OCR, up to minutes)
            # is not running yet, and only `stop` tells it the user already left (2026-10-06).
            self._in_executor(self._bus.stop)

    def _start_bus(self) -> None:
        """Runs on a worker thread. A start that cannot watch says why (2026-10-06).

        Its False used to die in the executor's future: the user pressed the button, heard "modo
        ómnibus activado" from the app and then nothing, ever — no detector, no OCR, and no way to
        tell from the phone. Only the failures the watcher names are reported: "the camera is still
        starting" is already said out loud (`warming`), and "the user left meanwhile" is no failure."""
        if self._bus.start():
            return
        reason = getattr(self._bus, "unavailable_reason", None)
        if reason:
            self.emit_event({"t": "error", "msg": f"bus unavailable: {reason}"})

    @staticmethod
    def _interval(cmd: dict) -> int:
        return max(0, min(int(cmd.get("interval_ms", 0)), INTERVAL_MAX_MS))

    @staticmethod
    def _chunk(cmd: dict, mtu: int) -> int:
        requested = int(cmd.get("chunk", 0)) or (mtu - 3 if mtu else DEFAULT_CHUNK)
        # Never larger than what the link accepts: the transport would split or drop the notification
        # and the receiver would see broken chunks with no error at all on this side.
        return min(requested, mtu - 3) if mtu else requested

    async def _synthetic_source(self, amount: int) -> bytes:
        return self._synthetic_payload(amount)

    def _start_transfer(self, source: Awaitable[bytes], chunk: int, interval_ms: int, kind: str) -> None:
        if self._transfer_in_flight and not self._transfer_in_flight.done():
            self._event({"t": "error", "msg": "a transfer is already in progress"})
            if hasattr(source, "close"):
                source.close()  # close the coroutine we are not going to await, or Python warns on collection
            return
        self._transfer_id += 1
        self._transfer_in_flight = self._schedule(
            self._transfer(self._transfer_id, source, chunk, interval_ms, kind)
        )

    async def _transfer(self, id_: int, source: Awaitable[bytes], chunk: int, interval_ms: int, kind: str) -> None:
        try:
            payload = await source
            chunks = split(payload, chunk)
        except InvalidChunkError as exc:
            self._event({"t": "error", "msg": str(exc)})
            return
        except Exception as exc:
            log.exception("could not prepare the transfer")
            self._event({"t": "error", "msg": f"{kind}: {exc}"})
            return

        await self._notify(EVENT, _json({"t": "start", "id": id_, "kind": kind, "bytes": len(payload), "chunks": len(chunks), "chunk": chunk}))
        t0 = time.monotonic()
        for c in chunks:
            await self._notify(TRANSFER, c)
            if interval_ms:
                await asyncio.sleep(interval_ms / 1000)
        ms = int((time.monotonic() - t0) * 1000)
        # `device_ms` is how long this side took to HAND the chunks to the Bluetooth stack, not how
        # long they took to reach the phone: the number that counts is the one the app measures. If
        # they differ a lot, the bottleneck is the path towards the stack (on BlueZ, D-Bus; see README).
        await self._notify(EVENT, _json({"t": "end", "id": id_, "bytes": len(payload), "chunks": len(chunks), "device_ms": ms}))
        log.info("transfer %d (%s): %d bytes in %d chunks, %d ms on this side", id_, kind, len(payload), len(chunks), ms)


def _log_failure(what: str) -> Callable[[asyncio.Future], None]:
    def done(future: asyncio.Future) -> None:
        if future.cancelled():
            return
        exc = future.exception()
        if exc is not None:
            log.error("%s failed in the background: %s", what, exc, exc_info=exc)

    return done
