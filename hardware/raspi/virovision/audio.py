"""Playing the audio the phone sends back (supermarket mode, ADR 0003).

The whole flow the user feels: **two clicks** → the app pulls the photo over WiFi → the cloud model
reads it → the app synthesizes the sentence and POSTs it to `/audio` → **this plays it on the
device's speaker**. That last step is what was missing: `http_server.py` already accepted the file,
wrote it to `/tmp/virovision-audio/` and called a `play` callable that `__main__` never passed, so
every reading arrived at the device and died there, silently, with a 202 that claimed success.

Three decisions worth keeping:

**It does not wait for the audio to finish.** `Popen`, not `run`. The HTTP handler that calls this
runs on the server's thread and has to answer right away — the app `await`s that response, and
holding it open for the length of the sentence would make the phone think the device is slow when it
is actually talking.

**A new reading interrupts the one playing.** In front of the shelf the user asks for the next
product before the previous sentence has finished, and two voices at once is worse than either one:
for someone who cannot see the screen, overlapping audio is not information. The app's own `speak()`
already interrupts for the same reason.

**It degrades to a log, never to an exception.** No decoder installed, no sound card, no speaker
wired yet: the daemon has to keep answering BLE. A device that stops working because the earphone
is not soldered would be much worse than a silent one.
"""

from __future__ import annotations

import logging
import queue
import shutil
import subprocess
import threading
import time
from pathlib import Path
from typing import Callable, Optional

log = logging.getLogger(__name__)

# Set at startup so the level is the same after every boot. Before this it was whatever `amixer` had
# been left at by hand, which on 2026-09-11 meant the first real reading came out too quiet to use.
#
# 50 since 2026-11-18. It was 90 while the transducer hung straight off the GPIO, where the problem was
# being heard at all (ADR 0012: under 1 mW). With the PAM8403 amplifier in between (ADR 0012, update
# of 2026-11-18) 90 % was far too loud on a bone-conduction transducer pressed against the head. Half
# is a starting point; the user's own level comes from the app (`cmd: 'volume'`) and is persisted, so
# this only applies to a board that was never told one. Still under 100 for the original reason: PWM
# audio clips at the top, and a distorted sentence is harder to understand than a soft one.
DEFAULT_VOLUME_PERCENT = 50

# Where the level the user chose survives a reboot. Under /var/lib because the daemon runs as root
# (`virovision.service`) and this is state, not configuration: `/etc/default/virovision` is what the
# team writes by hand, this is what the user writes from the app.
VOLUME_FILE = Path("/var/lib/virovision/volume")

# Tried in order; the first control that exists wins. `Softvol` is the one an I2S DAC will need (the
# MAX98357A has no volume control of its own), `PCM` is what the Pi's own output is called.
MIXER_CONTROLS = ("Softvol", "PCM", "Master", "Speaker", "Digital")


def set_output_volume(percent: int = DEFAULT_VOLUME_PERCENT) -> bool:
    """Sets the output level, best-effort. Returns whether it was applied.

    `amixer -M` and not plain `amixer`: without `-M` the percentage is a position on the control's dB
    scale, where 40 % is nearly inaudible; `-M` maps it to *perceived* volume, which is what a person
    means by "louder".

    Failing is not an error worth stopping for: a board with no sound card yet still has to run.
    """
    percent = max(0, min(100, percent))
    control = _find_control()
    if control is None:
        log.warning("audio: no ALSA control to set the volume on")
        return False
    try:
        subprocess.run(
            ["amixer", "-M", "-q", "set", control, f"{percent}%"],
            check=True, capture_output=True, timeout=5,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        log.warning("audio: could not set %s to %d%%: %s", control, percent, exc)
        return False
    log.info("audio: %s at %d%%", control, percent)
    return True


class Volume:
    """The output level the user chose from the app, applied and remembered across reboots.

    Since 2026-11-18, when the amplifier made the fixed startup level unusable and the device has no
    volume buttons. **The persisted value wins over `--volume`**: the flag is the team's default for a
    fresh board, the file is what the person wearing the device asked for, and a reboot that put the
    level back to the default would be the device ignoring them.

    `apply` is injectable so tests do not need `amixer`; the file path too, so they do not need root.
    A failed write is logged and the level still applies: losing the setting at the next reboot is
    better than refusing to change the volume now.
    """

    def __init__(self, path: Path = VOLUME_FILE, default: int = DEFAULT_VOLUME_PERCENT, apply: Optional[Callable[[int], bool]] = None) -> None:
        self._path = Path(path)
        self._apply = apply or set_output_volume
        self._lock = threading.Lock()
        self.current = _clamp(self._read(default))

    def apply_current(self) -> bool:
        """At startup: put the remembered (or default) level on the mixer."""
        return self._apply(self.current)

    def set(self, percent: int) -> int:
        """Clamp, apply and persist. Returns the level now in force. Runs on a worker thread: `amixer`
        is a process, and the BLE loop must not wait for it."""
        percent = _clamp(percent)
        with self._lock:
            self._apply(percent)
            self.current = percent
            self._write(percent)
        return percent

    def _read(self, default: int) -> int:
        try:
            return int(self._path.read_text().strip())
        except (OSError, ValueError):
            # Missing on a fresh board; garbage if someone edited it by hand. Either way, the default.
            return default

    def _write(self, percent: int) -> None:
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            # Write and rename: a power cut halfway through (this board runs on a battery) must leave
            # the old level, not an empty file.
            tmp = self._path.with_suffix(".tmp")
            tmp.write_text(f"{percent}\n")
            tmp.replace(self._path)
        except OSError as exc:
            log.warning("audio: could not remember the volume in %s: %s", self._path, exc)


def _clamp(percent: int) -> int:
    return max(0, min(100, int(percent)))


def _find_control() -> Optional[str]:
    try:
        output = subprocess.run(["amixer", "scontrols"], capture_output=True, text=True, timeout=5).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    # Lines look like: Simple mixer control 'PCM',0
    available = {line.split("'")[1] for line in output.splitlines() if "'" in line}
    return next((c for c in MIXER_CONTROLS if c in available), None)

# One decoder per format. `aplay` comes with alsa-utils and plays WAV with nothing else installed;
# MP3 needs a decoder, and `mpg123` is the small standard one (`setup.sh` installs it). If apt is not
# an option on a given board, the way out is the app sending WAV instead of MP3 — hence both.
PLAYERS = {
    ".mp3": ["mpg123", "-q"],
    ".wav": ["aplay", "-q"],
}


def command_for(path: str) -> Optional[list]:
    """The command that plays this file, or None when nothing on this board can.

    Split out and pure so the mapping is testable on the Mac, where neither binary exists: what
    breaks in practice is choosing the wrong decoder for an extension, and that is checkable without
    a speaker.
    """
    player = PLAYERS.get(Path(path).suffix.lower())
    if player is None:
        return None
    return [*player, path]


# The PWM pin keeps switching after a clip ends. Straight into an earphone that was inaudible; into
# the PAM8403 amplifier (2026-11-18) it is a loud hiss that never stops. So between clips the pin is
# taken away from the PWM block and held low, and handed back right before the next clip.
# GPIO 18 is where `audremap,pins_18_19` puts the left channel (ADR 0012); ALT5 is PWM0 on it.
AUDIO_GPIO = 18
PWM_FUNCTION = "a5"
# How long the output has to be idle before the pin is parked: a bus announcement is two or three
# clips in a row, and parking between them would put a click in the middle of the sentence.
PARK_AFTER_S = 1.0


class PwmGate:
    """Connects and disconnects the PWM audio pin with `pinctrl` (Raspberry Pi OS). Best-effort: a
    board without `pinctrl`, or the Mac, gets a gate that does nothing, and the audio still plays."""

    def __init__(self, gpio: int = AUDIO_GPIO, run: Optional[Callable[[list], None]] = None) -> None:
        self._gpio = str(gpio)
        self._run = run or _run_quietly
        self._enabled = run is not None or shutil.which("pinctrl") is not None
        self.is_open = True  # the overlay leaves the pin on PWM at boot
        if not self._enabled:
            log.info("audio: no pinctrl, the PWM pin stays connected between clips")

    def open(self) -> None:
        if self._enabled and not self.is_open:
            self._run(["pinctrl", "set", self._gpio, PWM_FUNCTION])
        self.is_open = True

    def park(self) -> None:
        if self._enabled and self.is_open:
            # Output low and not input: a floating amplifier input picks up hum.
            self._run(["pinctrl", "set", self._gpio, "op", "dl"])
        self.is_open = False


def _run_quietly(command: list) -> None:
    try:
        subprocess.run(command, check=True, capture_output=True, timeout=5)
    except (OSError, subprocess.SubprocessError) as exc:
        log.warning("audio: %s failed: %s", " ".join(command), exc)


class Player:
    """Plays files on the device's speaker, one at a time."""

    def __init__(self, gate: Optional[PwmGate] = None) -> None:
        self._gate = gate
        if gate is not None:
            gate.park()  # nothing is playing yet, and the overlay left the pin hissing since boot
        self._idle_since: Optional[float] = None
        self._process: Optional[subprocess.Popen] = None
        self._queue: queue.Queue = queue.Queue()
        self._queue_lock = threading.Lock()
        self._worker: Optional[threading.Thread] = None
        # Guards `_process` and `_generation`. `stop` comes from the BLE loop (`hush`), the clips
        # start on the audio worker and the readings on the HTTP thread: unguarded, a clip the worker
        # was launching while `stop` ran was never stopped — the board talking over the phone it had
        # just been told to yield to (2026-10-06).
        self._process_lock = threading.Lock()
        # Bumped by every `stop`. A clip dequeued before a stop must not start after it.
        self._generation = 0
        self._parker: Optional[threading.Thread] = None
        # Reported once, at startup, because it is the difference between "the audio did not arrive"
        # and "the audio arrived and there was nothing to play it with" — and on a device with no
        # screen the log is the only place anyone can tell them apart.
        available = {ext: shutil.which(cmd[0]) is not None for ext, cmd in PLAYERS.items()}
        log.info(
            "audio: %s",
            ", ".join(f"{ext} {'yes' if ok else 'NO'}" for ext, ok in available.items()) or "no players",
        )
        if not any(available.values()):
            log.warning("audio: no player installed; readings will arrive and not be heard")

    def play(self, path: str) -> None:
        """Start playing `path`, interrupting whatever was playing. Returns immediately."""
        command = command_for(path)
        if command is None:
            log.warning("audio: nothing can play %s", path)
            return
        self.stop()
        try:
            with self._process_lock:
                # Output to DEVNULL: mpg123 and aplay write progress to stderr, and at one line per
                # reading the journal would be mostly theirs.
                self._open_gate()
                process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                self._process = process
        except (OSError, subprocess.SubprocessError) as exc:
            # Typically FileNotFoundError: the decoder is not installed. It is a warning and not a
            # raise because the caller is an HTTP handler answering the phone.
            log.warning("audio: could not play %s: %s", path, exc)
            return
        log.info("audio: playing %s (pid %d)", path, process.pid)

    def play_sequence(self, paths: list) -> None:
        """Play these files one after another, without cutting each other off. Returns immediately.

        Two lessons from the board (2026-09-15). `aplay a.wav b.wav` fails to reconfigure the device
        for the second file ("Unable to install hw params") and only the first is heard, so there is
        one process per file. And a bus announcement is two or three clips in a row ("a bus is
        coming", "115", "Luis Braille"): `play` would have each one kill the previous.
        """
        if not paths:
            return
        with self._queue_lock:
            for path in paths:
                self._queue.put(str(path))
            if self._worker is None or not self._worker.is_alive():
                self._worker = threading.Thread(target=self._play_queued, name="audio", daemon=True)
                self._worker.start()

    def _play_queued(self) -> None:
        while True:
            # Empty-check and exit under the same lock `play_sequence` enqueues under. Outside it, a
            # clip queued between this worker finding the queue empty and returning saw a live worker,
            # started none, and was never played (2026-10-06).
            with self._queue_lock:
                try:
                    path = self._queue.get_nowait()
                except queue.Empty:
                    self._worker = None
                    return
                generation = self._generation
            command = command_for(path)
            if command is None:
                log.warning("audio: nothing can play %s", path)
                continue
            try:
                with self._process_lock:
                    if generation != self._generation:
                        continue  # stopped after this clip was dequeued: it is not to be heard
                    self._open_gate()
                    process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    self._process = process
            except (OSError, subprocess.SubprocessError) as exc:
                log.warning("audio: could not play %s: %s", path, exc)
                continue
            process.wait()

    def _open_gate(self) -> None:
        """Called with `_process_lock` held, right before a player starts."""
        if self._gate is None:
            return
        self._gate.open()
        self._idle_since = None
        if self._parker is None or not self._parker.is_alive():
            self._parker = threading.Thread(target=self._park_when_idle, name="audio-park", daemon=True)
            self._parker.start()

    def _park_when_idle(self) -> None:
        """Parks the pin once nothing has played for `PARK_AFTER_S`, then exits; the next clip starts
        it again. Polls instead of hooking every exit path (`play`, the queue, `stop`): three places
        to forget one in, and a missed one is the endless hiss this exists to stop."""
        while True:
            time.sleep(0.2)
            with self._process_lock:
                process = self._process
                busy = (process is not None and process.poll() is None) or not self._queue.empty()
                if busy:
                    self._idle_since = None
                    continue
                now = time.monotonic()
                if self._idle_since is None:
                    self._idle_since = now
                    continue
                if now - self._idle_since < PARK_AFTER_S:
                    continue
                self._gate.park()
                self._parker = None
                return

    def stop(self) -> None:
        """Silence whatever is playing, and drop whatever was queued behind it."""
        while True:
            try:
                self._queue.get_nowait()
            except queue.Empty:
                break
        with self._process_lock:
            self._generation += 1
            process, self._process = self._process, None
        if process is None or process.poll() is not None:
            return
        log.debug("audio: interrupting pid %d", process.pid)
        try:
            process.terminate()
        except OSError:
            pass
