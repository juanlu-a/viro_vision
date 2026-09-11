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
import shutil
import subprocess
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

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


class Player:
    """Plays files on the device's speaker, one at a time."""

    def __init__(self) -> None:
        self._process: Optional[subprocess.Popen] = None
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
            # Output to DEVNULL: mpg123 and aplay write progress to stderr, and at one line per
            # reading the journal would be mostly theirs.
            self._process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except (OSError, subprocess.SubprocessError) as exc:
            # Typically FileNotFoundError: the decoder is not installed. It is a warning and not a
            # raise because the caller is an HTTP handler answering the phone.
            log.warning("audio: could not play %s: %s", path, exc)
            return
        log.info("audio: playing %s (pid %d)", path, self._process.pid)

    def stop(self) -> None:
        """Silence whatever is playing. Safe to call with nothing playing."""
        process = self._process
        self._process = None
        if process is None or process.poll() is not None:
            return
        log.debug("audio: interrupting pid %d", process.pid)
        try:
            process.terminate()
        except OSError:
            pass
