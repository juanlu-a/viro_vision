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
AP_MINUTES_DEFAULT = 10
AP_MINUTES_MAX = 60
# With a mode active the AP turns itself on (the app is going to ask for the photo over WiFi) and
# turns off in idle. The cap exists because the device has one radio: with the AP up it is on no
# other network, and a forgotten mode cannot leave it unreachable forever.
AP_MINUTES_WITH_MODE = 20


def _json(obj: dict) -> bytes:
    data = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode()
    if len(data) > EVENT_MAX_BYTES:
        raise ValueError(f"a {len(data)}-byte event does not fit in one notification")
    return data


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
    ) -> None:
        self._loop = loop
        self._read_status = read_status
        self._capture = capture
        self._synthetic_payload = synthetic_payload
        self._notify = notify
        self._ap_control = ap_control
        self._read_wifi = read_wifi
        self._ap_off_timer: Optional[asyncio.TimerHandle] = None
        self.modes = ModeMachine()
        self._transfer_id = 0
        self._transfer_in_flight: Optional[asyncio.Task] = None

    # --- reads (synchronous: that is how BlueZ and CoreBluetooth ask for them) --------------

    def read_mode(self) -> bytes:
        return bytes([int(self.modes.current)])

    def read_status(self) -> bytes:
        return _json(self._read_status())

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
            self._event({"t": "error", "msg": f"unreadable command: {exc}"[:150]})
            return
        log.info("control ← %s (mtu %s)", cmd, mtu or "?")
        name = cmd.get("cmd")
        if name == "measure":
            self._start_transfer(
                source=self._synthetic_source(int(cmd.get("bytes", DEFAULT_BYTES))),
                chunk=self._chunk(cmd, mtu),
                interval_ms=int(cmd.get("interval_ms", 0)),
                kind="measurement",
            )
        elif name == "photo":
            if self._capture is None:
                self._event({"t": "error", "msg": "no camera: use measure"})
                return
            self._start_transfer(
                source=self._capture(),
                chunk=self._chunk(cmd, mtu),
                interval_ms=int(cmd.get("interval_ms", 0)),
                kind="photo",
            )
        elif name == "mode":
            self._change_mode(int(cmd.get("value", 0)))
        elif name == "status":
            self._schedule(self._notify(STATUS, self.read_status()))
        elif name == "ap":
            self._ap(bool(cmd.get("value", True)), int(cmd.get("minutes", AP_MINUTES_DEFAULT)))
        else:
            self._event({"t": "error", "msg": f"unknown command: {name}"[:150]})

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
            await self._notify(EVENT, _json({"t": "error", "msg": f"ap: {exc}"[:150]}))
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

    def _event(self, obj: dict) -> None:
        self._schedule(self._notify(EVENT, _json(obj)))

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
        # Since 2026-09-07 the AP does NOT follow the mode: it stays on while the device is powered
        # (`__main__` brings it up at startup) so the phone is already on the network when the user
        # activates a mode. Waiting 20 s for the AP to come up and the phone to join, every time, was
        # unacceptable for the user; the cost is battery, and it is measured. `ap` still exists as a
        # manual command.

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
            self._event({"t": "error", "msg": str(exc)[:150]})
            return
        except Exception as exc:
            log.exception("could not prepare the transfer")
            self._event({"t": "error", "msg": f"{kind}: {exc}"[:150]})
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
