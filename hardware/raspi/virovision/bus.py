"""Bus mode: the camera watches, the sensor detects, the Pi reads the sign and the device speaks.

This is case B of the canonical diagram running for real (ADR 0006, amended 2026-09-07): the detector
lives inside the IMX500 sensor, so every frame costs the Pi nothing; the Pi only crops the sign the
sensor found, reads it with the OCR and plays a pre-recorded announcement (ADR 0003 §5 — the lines of
Montevideo are a finite set, so a `.wav` per line beats running a TTS in half a gigabyte of RAM).

Two things decide the shape of this module:

- **The OCR cannot run on the camera thread.** A read takes about 0.9 s on a Pi 3 B+, and libcamera
  declares the sensor dead after roughly a second without anyone consuming frames ("Camera frontend
  has timed out", seen on the board on 2026-09-15). So there are two threads: one drains frames, one
  reads, and they talk through queues.
- **Everything that decides what to announce is in `bus_banner`,** the package shared with the
  pipeline repo, which is tested on a laptop. What lives here is the wiring: the camera, the speaker,
  the BLE event and the mode.

Without `bus_banner` installed or without a `.rpk` in the sensor the watcher reports itself
unavailable and the daemon carries on: a device that cannot read bus lines still takes photos.
"""

from __future__ import annotations

import inspect
import logging
import queue
import threading
import time
from pathlib import Path
from typing import Callable, Optional

log = logging.getLogger(__name__)

DEFAULT_MODEL = Path("/home/virovision/models/bus_sign.rpk")
DEFAULT_ANNOUNCEMENTS = Path("/home/virovision/announcements")
DEFAULT_CATALOG = Path("/home/virovision/models/catalog_stm.csv")
NOTICES_DIR = "system"
WARMING_UP_CLIP = "bus_warming_up.wav"
"""Said when the button asks for bus mode before the OCR has finished loading. Its text lives with
the other system notices, in `notices.py`."""
DEFAULT_PIPELINE_STAMP = Path("/home/virovision/models/bus-banner-version")
"""Branch and commit of the `bus_banner` checkout the board was deployed from, written by that repo's
`deploy_pi.sh`. Its PRs are merged by someone else, so a branch can be the one under test for days,
and every build calls itself 0.2.0: without this, knowing which code a field run used meant grepping
the installed sources for a symbol."""
MIN_CONFIDENCE = 0.3
CONFIRM_SECONDS = 0.6
VOTES_NEEDED = 2
MIN_BANNER_HEIGHT_PX = 22
FRAME_SILENCE_S = 12.0
"""How long without a single frame before the watchdog reopens the camera. The sensor delivers 15 per
second, so this is very long on purpose: the first frame after the camera starts took **3,7 s**
measured on the board (2026-09-22) while the detector's firmware loads, and a limit under that turns
every start into a restart. It buys three of those and some more."""
WATCHDOG_EVERY_S = 1.0
HEARTBEAT_S = 5.0
"""Bus mode says how many frames it saw, and how many carried detections, this often. A run with no
bus in the video and a run with no frames from the camera used to leave the same empty journal."""

PRESENCE_SILENCE_S = 15.0
"""«Se acerca un ómnibus» no se repite dentro de esta ventana, venga del track que venga. Un ómnibus
que se pierde y vuelve es un track nuevo, y con eso el aviso salía una vez por corte: probando con
videos el 2026-09-15 se repitió muchas veces seguidas. La frase no distingue un ómnibus de otro, así
que repetirla no agrega información aunque el segundo ómnibus sea real; lo que sí distingue es la
línea, y ésa tiene su propia ventana."""

SAME_LINE_SILENCE_S = 10.0
"""A line just announced is not announced again this soon. One bus is one announcement, and the
tracker alone cannot guarantee that: on the first run from the button the board said "115, Luis
Braille" twice within a second because the camera was moved while the bus was in frame, the track was
lost and the same bus came back as a new one (2026-09-15). Whatever makes the tracker lose a bus -
a hand on the camera, a pole in the way, someone walking past - would repeat the announcement, and a
blind user hearing the same line twice cannot tell whether a second bus arrived. Ten seconds is
shorter than any real gap between two buses of the same line at a stop."""

Announce = Callable[[list], None]
"""Plays a list of `.wav` files, in order, without cutting each other off."""
Emit = Callable[[dict], None]
"""Sends an event to the app over BLE (the `event` characteristic)."""


class Timeline:
    """Writes to the journal what tells a slow detector from a slow reader.

    Before this, a field run left three kinds of line - "there is a bus", "read in N ms", "115, Luis
    Braille" - and no way to say where the seconds went between the bus entering the frame and the
    line being spoken (2026-09-21: "sometimes it takes long to even notice the bus, sometimes it
    reads half the sign"). Now every track gets a birth line, a status line per second while it is
    unread, one line per read attempt, and a closing line. Everything is relative to the moment the
    sensor first reported that bus, which is the only clock the user cares about.
    """

    def __init__(self, clock: Callable[[], float] = time.monotonic, status_every_s: float = 1.0) -> None:
        self._clock = clock
        self._every = status_every_s
        self._born: dict[int, float] = {}
        self._last_status: dict[int, float] = {}
        self._gone: set[int] = set()
        self._last_orphan = float("-inf")

    def age(self, track_id: int) -> float:
        born = self._born.get(track_id)
        return self._clock() - born if born is not None else 0.0

    def frame(self, tracks: list, detections: list) -> None:
        """Called once per frame with the tracker's live tracks and the sensor's detections."""
        now = self._clock()
        signs = [d for d in detections if d.label == "bus_sign"]
        if signs and not tracks and now - self._last_orphan >= self._every:
            # Third run of 2026-09-21: 23 s in bus mode and not one line, because no track was born.
            # Whether the sensor saw nothing or saw a sign nobody used must be visible.
            self._last_orphan = now
            sign = max(signs, key=lambda d: d.box.height)
            log.info("bus: no track; %s", f"sign {_box(sign.box)} aspect {sign.box.aspect:.1f} conf {sign.conf:.2f}")
        for track in tracks:
            if track.id not in self._born:
                self._born[track.id] = now
                self._last_status[track.id] = now
                log.info(
                    "bus: track %d appeared: bus %s, conf %.2f, %s",
                    track.id, _box(track.box), track.conf, _sign(signs, track.box),
                )
            elif track.id in self._gone:
                # The tracker recognised a bus it had lost: same id, same announcements. Its clock
                # keeps running from the first sighting, which is when the user could have been told.
                self._gone.discard(track.id)
                log.info("bus: track %d is back at %.1f s: bus %s, %s", track.id, now - self._born[track.id], _box(track.box), _sign(signs, track.box))
            elif not track.announced_reading and now - self._last_status[track.id] >= self._every:
                self._last_status[track.id] = now
                log.info(
                    "bus: track %d at %.1f s: bus %s, %s, %d reads",
                    track.id, now - self._born[track.id], _box(track.box), _sign(signs, track.box), track.read_attempts,
                )

    def read_queued(self, track_id: int, attempt: int, banner_box, bus_box) -> None:
        what = f"sign {_box(banner_box)}" if banner_box is not None else f"top strip of the bus {_box(bus_box)}"
        log.info("bus: track %d read #%d queued at %.1f s: %s", track_id, attempt, self.age(track_id), what)

    def read_done(self, track_id: int, reading, ocr_ms: int) -> None:
        log.info(
            "bus: track %d read in %d ms at %.1f s: %s",
            track_id, ocr_ms, self.age(track_id), reading.raw if reading else "nothing",
        )

    def decided(self, event) -> None:
        log.info(
            "bus: track %d decided at %.1f s after %d reads: %s",
            event.track, self.age(event.track), event.attempts, event.phrase(),
        )

    def lost(self, event, announced: bool) -> None:
        log.info(
            "bus: track %d gone at %.1f s, %s",
            event.track, self.age(event.track), "line announced" if announced else "line never read",
        )
        self._gone.add(event.track)


def _box(box) -> str:
    """`120x400 px at (10,30)`: height first, because height is what decides whether a sign is readable."""
    return f"{box.height:.0f}x{box.width:.0f} px at ({box.x1:.0f},{box.y1:.0f})"


def _sign(signs: list, bus) -> str:
    """This bus's own sign, and why the picker would take it or not: the banner must sit inside the bus
    box, in its top half, and be a wide strip (aspect >= 2).

    Only signs whose center falls inside THIS bus box are considered. Reporting the tallest sign in the
    frame instead, as the first version did, printed "NOT in the top half of the bus" for a sign that
    belonged to a different bus and was being read perfectly well by its own track (2026-09-22) - a
    diagnostic that invents a problem is worse than none."""
    mine = [d for d in signs if bus.contains(d.box.center)]
    if not mine:
        return "no sign of its own"
    sign = max(mine, key=lambda d: d.box.height)
    what = f"sign {_box(sign.box)} aspect {sign.box.aspect:.1f} conf {sign.conf:.2f}"
    if sign.box.aspect < 2.0:
        return f"{what}, too square to be a banner"
    if sign.box.center[1] > bus.y1 + bus.height * 0.5:
        return f"{what}, below the bus's top half (it gets a track of its own)"
    return what


def pipeline_stamp(path: Path = DEFAULT_PIPELINE_STAMP) -> str:
    """What the stamp says, or why there is none. Never raises: this is a log line, not a feature."""
    try:
        stamp = path.read_text().strip()
    except OSError:
        return "unstamped (deployed by hand, or before deploy_pi.sh stamped it)"
    return stamp or "unstamped (the file is empty)"


def is_available() -> bool:
    """Whether the reading half is installed at all. Checked before promising bus mode."""
    try:
        import bus_banner  # noqa: F401
        import rapidocr  # noqa: F401
    except ImportError:
        return False
    return True


class BusWatcher:
    """Owns bus mode while it is active: the frame loop, the OCR thread and what gets announced."""

    def __init__(
        self,
        camera,
        announce: Announce,
        emit: Emit,
        *,
        announcements: Path = DEFAULT_ANNOUNCEMENTS,
        catalog: Path = DEFAULT_CATALOG,
        labels: Optional[list] = None,
        signs_only: bool = True,
        min_conf: float = MIN_CONFIDENCE,
        audio_target: str = "device",
    ) -> None:
        self._camera = camera
        self._announce = announce
        self._emit = emit
        self._announcements = Path(announcements)
        self._catalog = Path(catalog)
        self._labels = labels
        self._signs_only = signs_only
        self._min_conf = min_conf
        self.audio_target = audio_target
        self._pipeline = None
        self._watcher = None
        self._settings: dict = {}
        self._stop = threading.Event()
        self._threads: list[threading.Thread] = []
        self._jobs: queue.Queue = queue.Queue()
        self._results: queue.Queue = queue.Queue()
        self._timeline = Timeline()
        self._last_frame_at = 0.0
        self._last_announcement: list = []
        self._last_line: tuple = ()
        self._last_line_at: float | None = None
        self._last_voice_at: float | None = None
        """None means «todavía no habló». Cero no sirve: `time.monotonic()` cuenta desde el arranque
        del proceso en macOS y desde el arranque de la máquina en Linux, así que un cero literal
        silencia el primer aviso en una plataforma y no en la otra."""
        self.running = False

    @property
    def ready(self) -> bool:
        """Whether a button press would start watching now, or first spend tens of seconds building
        the OCR. `warm_up` at startup is what makes this true before anyone presses anything."""
        return self._pipeline is not None

    @property
    def available(self) -> bool:
        """Ready to watch: the reading half is installed and the sensor has a detector loaded."""
        return is_available() and getattr(self._camera, "sensor", None) is not None

    def warm_up(self) -> bool:
        """Builds the OCR ahead of time, at startup. The first `create_ocr` loads two ONNX models and
        takes about 17 s on a Pi 3 B+; paying that when the user presses the button would make bus
        mode feel broken."""
        if not self.available:
            return False
        try:
            self._build()
        except Exception as exc:  # noqa: BLE001
            log.warning("bus mode could not be prepared: %s", exc)
            return False
        log.info("bus mode ready (%s)", self._settings)
        log.info("bus mode reading with bus_banner: %s", pipeline_stamp())
        return True

    def start(self) -> bool:
        """Begins watching. Returns False when bus mode cannot run, so the caller can say so."""
        if self.running:
            return True
        if not self.available:
            log.warning("bus mode unavailable: %s", "no detector in the sensor" if is_available() else "bus_banner is not installed")
            return False
        if not self.ready:
            # The OCR takes tens of seconds to load and `_build` below is where that happens. Until
            # 2026-09-22 a button press inside that window left the device silent, which for someone
            # who cannot see the screen is the same thing as a device that died. It is said before
            # building, not after, or it would arrive with the answer it was meant to precede.
            log.info("bus: asked to watch before the OCR finished loading; saying so")
            self._warming_up()
        try:
            self._build()
        except Exception as exc:  # noqa: BLE001 — a model or a catalog that will not load
            log.error("bus mode could not start: %s", exc)
            return False
        self._stop.clear()
        self._last_frame_at = time.monotonic()
        self._threads = [
            threading.Thread(target=self._read_loop, name="bus-ocr", daemon=True),
            threading.Thread(target=self._frame_loop, name="bus-frames", daemon=True),
            threading.Thread(target=self._watchdog, name="bus-watchdog", daemon=True),
        ]
        for thread in self._threads:
            thread.start()
        self.running = True
        log.info("bus mode watching (%s)", self._settings)
        return True

    def stop(self) -> None:
        """Stops watching and gives the camera back. Safe to call when it is not running."""
        if not self.running:
            return
        self._stop.set()
        self._jobs.put(None)
        for thread in self._threads:
            thread.join(timeout=3)
        self._threads = []
        self.running = False
        log.info("bus mode stopped")

    def repeat_last(self) -> bool:
        """Says the last reading again. A short click inside bus mode: the user did not catch it, and
        there is nothing new to read — the mode keeps watching on its own."""
        if not self._last_announcement:
            log.info("bus: nothing to repeat yet")
            return False
        log.info("bus: repeating the last announcement")
        self._announce(self._last_announcement)
        return True

    # --- internals -------------------------------------------------------------------------

    def _build(self) -> None:
        from bus_banner.catalog import Catalog
        from bus_banner.detection import NullDetector
        from bus_banner.imx500 import network_settings
        from bus_banner.ocr import create_ocr
        from bus_banner.pipeline import Pipeline
        from bus_banner.tracking import Tracker, Watcher

        if self._pipeline is None:
            catalog = Catalog.from_csv(self._catalog) if self._catalog.exists() else None
            if catalog is None:
                log.warning("no catalog at %s: readings will not be corrected", self._catalog)
            # The detector is the sensor's, so the pipeline needs none of its own.
            self._pipeline = Pipeline(NullDetector(), create_ocr("rapid"), catalog)
        self._settings = network_settings(self._camera.sensor.network_intrinsics, labels=self._labels)
        fps = self._settings["fps"]
        tracker = Tracker(max_missed=max(1, round(0.5 * fps)), memory=max(1, round(5 * fps)))
        options = {}
        if "signs_expected" in inspect.signature(Watcher).parameters:
            # Only in `bus_banner` since the sign can carry its own track (PR #4 of the pipeline repo).
            # The daemon installs that package as a wheel with no version pin, so it must run against
            # the published one too: with an older one bus mode still works, reading the bus's top
            # strip as it did before, instead of refusing to start.
            options["signs_expected"] = "bus_sign" in self._settings["labels"]
        else:
            log.warning("bus_banner is older than PR #4: the top strip will be read when a sign is missed")
        self._watcher = Watcher(
            self._queue_read,
            tracker=tracker,
            confirm_frames=max(1, round(CONFIRM_SECONDS * fps)),
            min_banner_height_px=MIN_BANNER_HEIGHT_PX,
            votes_needed=VOTES_NEEDED,
            async_reads=True,
            **options,
        )

    def _queue_read(self, frame, banner_box, bus_box):
        """The reader the `Watcher` calls. Hands the job to the OCR thread and returns None, which is
        how `async_reads` says "in progress": the camera loop must not wait 0.9 s here."""
        track_id = self._watcher.reading_track
        attempts = next((t.read_attempts for t in self._watcher.tracker.tracks if t.id == track_id), 0)
        self._timeline.read_queued(track_id, attempts, banner_box, bus_box)
        self._jobs.put((frame, banner_box, bus_box, track_id))
        return None

    def _read_loop(self) -> None:
        while True:
            job = self._jobs.get()
            if job is None:
                return
            frame, banner_box, bus_box, track_id = job
            started = time.monotonic()
            try:
                reading = self._pipeline.process_with_boxes(frame, banner_box, bus_box).reading
            except Exception as exc:  # noqa: BLE001 — one bad frame must not end the mode
                log.warning("bus: the reading failed: %s", exc)
                reading = None
            self._results.put((track_id, reading, round((time.monotonic() - started) * 1000)))

    def _watchdog(self) -> None:
        """Reopens the camera when no frame has arrived for FRAME_SILENCE_S.

        It lives in its own thread because the frame loop, when the camera goes quiet, is blocked
        inside `capture_request` and cannot notice anything. Closing the sensor from here is what
        unblocks it. Giving the capture call its own deadline instead was tried on 2026-09-21 and
        jammed the camera for good: see `Camera.capture_request`."""
        while not self._stop.wait(WATCHDOG_EVERY_S):
            silence = time.monotonic() - self._last_frame_at
            if silence < FRAME_SILENCE_S:
                continue
            log.error("bus: no frame from the camera in %.0f s; reopening it", silence)
            self._last_frame_at = time.monotonic()  # the restart takes seconds; do not fire again meanwhile
            try:
                self._camera.restart()
            except Exception as exc:  # noqa: BLE001 — a camera that will not come back is reported, not fatal
                log.error("bus: the camera did not come back (%s)", exc)
                return
            self._last_frame_at = time.monotonic()

    def _heartbeat(self, frames: int, with_detections: int, buses: int, signs: int) -> None:
        log.info("bus: %d frames in %.0f s, %d with detections (bus %d, sign %d)", frames, HEARTBEAT_S, with_detections, buses, signs)

    def _frame_loop(self) -> None:
        from bus_banner.imx500 import detections_from_tensors

        sensor = self._camera.sensor
        frame_number = 0
        beat_at = time.monotonic()
        frames = with_detections = buses = signs = 0
        while not self._stop.is_set():
            try:
                request = self._camera.capture_request()
            except Exception as exc:  # noqa: BLE001
                log.error("bus: the camera stopped delivering frames (%s)", exc)
                return
            self._last_frame_at = time.monotonic()
            try:
                metadata = request.get_metadata()
                detections = detections_from_tensors(
                    sensor.get_outputs(metadata),
                    self._settings["labels"],
                    input_size=sensor.get_input_size(),
                    to_stream=lambda y1, x1, y2, x2, m=metadata: self._camera.to_stream((y1, x1, y2, x2), m),
                    min_conf=self._min_conf,
                    signs_only=self._signs_only,
                    normalize=self._settings["normalize"],
                    order=self._settings["order"],
                )
                # Copying the frame is the expensive part on a Pi 3 B+: only when there is something in
                # it. A sign alone counts: it carries its own track when the bus box is missing or bad.
                frame = request.make_array("main") if detections else None
            finally:
                request.release()

            frames += 1
            if detections:
                with_detections += 1
                buses += sum(d.label == "bus" for d in detections)
                signs += sum(d.label == "bus_sign" for d in detections)
            if time.monotonic() - beat_at >= HEARTBEAT_S:
                self._heartbeat(frames, with_detections, buses, signs)
                beat_at = time.monotonic()
                frames = with_detections = buses = signs = 0

            self._drain_results(frame_number)
            events = self._watcher.process(frame, detections, frame_number)
            self._timeline.frame(self._watcher.tracker.tracks, detections)
            for event in events:
                self._handle(event)
            frame_number += 1

    def _drain_results(self, frame_number: int) -> None:
        while True:
            try:
                track_id, reading, ocr_ms = self._results.get_nowait()
            except queue.Empty:
                return
            self._timeline.read_done(track_id, reading, ocr_ms)
            self._watcher.submit_reading(track_id, reading, frame_number)

    def _is_an_echo(self, number: str, destination: str) -> bool:
        """True when this line was just announced, so saying it again would be an echo of the same
        bus rather than news. See SAME_LINE_SILENCE_S. Records the line when it is news, so calling
        this is what arms the silence."""
        now = time.monotonic()
        if (
            (number, destination) == self._last_line
            and self._last_line_at is not None
            and now - self._last_line_at < SAME_LINE_SILENCE_S
        ):
            return True
        self._last_line, self._last_line_at = (number, destination), now
        return False

    def _presence_is_worth_saying(self) -> bool:
        """False while the last announcement is still recent. See PRESENCE_SILENCE_S. Records the
        moment when it says yes, so calling this is what arms the silence."""
        now = time.monotonic()
        if self._last_voice_at is not None and now - self._last_voice_at < PRESENCE_SILENCE_S:
            return False
        self._last_voice_at = now
        return True

    def _handle(self, event) -> None:
        if event.kind == "bus":
            if not self._presence_is_worth_saying():
                log.info("bus: there is a bus, said %.1f s ago", time.monotonic() - (self._last_voice_at or 0.0))
                return
            self._announce_presence()
        elif event.kind == "reading":
            self._timeline.decided(event)
            if self._is_an_echo(event.number, event.destination):
                log.info("bus: %s again, still the same bus", event.phrase())
                return
            log.info("bus: %s", event.phrase())
            self._last_voice_at = time.monotonic()
            self._last_announcement = self._files_for(event.number, event.destination)
            self._speak(self._last_announcement)
            self._emit(self._result_event(event))
        elif event.kind == "lost":
            track = next((t for t in self._watcher.tracker.recent if t.id == event.track), None)
            self._timeline.lost(event, bool(track and track.announced_reading))

    def _warming_up(self) -> None:
        """Says «preparando la lectura» through whichever output the user chose.

        Both halves, like every reading: the clip when the device is the output, and the event always,
        so a phone that is listening says it instead. A board with no `.wav` for it (deployed before
        the clip existed) stays quiet here rather than failing to start the mode."""
        clip = self._announcements / NOTICES_DIR / WARMING_UP_CLIP
        self._speak([clip] if clip.exists() else [])
        self._emit({"t": "warming"})

    def _announce_presence(self) -> None:
        from bus_banner.announcements import BUS_FILE

        files = [self._announcements / BUS_FILE]
        self._speak([f for f in files if f.exists()])

    def _files_for(self, number: str, destination: str) -> list:
        from bus_banner.announcements import files_to_play

        return files_to_play(self._announcements, number, destination)

    def _speak(self, files: list) -> None:
        """The device speaks unless the user chose to hear readings on the phone. The BLE event goes
        out either way: the app shows the reading even when it is not the one saying it."""
        if self.audio_target != "device" or not files:
            return
        self._announce(files)

    @staticmethod
    def _result_event(event) -> dict:
        from bus_banner.types import Reading, Result

        reading = Reading(event.number, event.destination, "", 0.9)
        return Result(reading, None, None, [], {}).to_event()
