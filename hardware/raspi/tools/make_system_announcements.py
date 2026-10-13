"""Generates the device's system-notice clips (`announcements/system/*.wav`).

The counterpart of `make_announcements.py` in the bus-banner repo, which records the lines and
destinations of the STM. These are the other half: the link, the network, the mode, the setting —
what the app says about itself, and which since 2026-09-16 comes out of whatever output the user
chose (`app/src/features/audio/notices.ts`).

**It lives in this repo and not next to the bus generator on purpose.** The bus clips come from the
STM catalogue and belong with the pipeline that reads signs; these come from the app's own strings
and change when the app changes. Keeping them here means a change to a notice is one PR, in the repo
that owns both sides of it, and does not wait on a branch of the other repo to be merged.

Runs on the Mac: `say` and `afconvert` are macOS tools. 22 kHz mono 16-bit, the same format as the
bus clips, because `aplay` reconfigures the device between files and a format change mid-announcement
is one more way to lose a sentence.

    python3 tools/make_system_announcements.py
    scp -r announcements/system virovision.local:~/announcements/

Usage notes:
    --voice     a Spanish macOS voice; Mónica (es_ES) is what the bus clips use, and the two are
                heard one after another, so a different voice here would sound like two devices.
    --output    where to write; the default matches `scp`'s expectation above.
"""

from __future__ import annotations

import argparse
import math
import struct
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from virovision.notices import EARCON_FILE, NOTICES, SYSTEM_DIR  # noqa: E402

SAMPLE_RATE = 22_050


def speak_to_wav(text: str, wav: Path, voice: str, rate: int) -> None:
    wav.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".aiff", delete=False) as tmp:
        aiff = Path(tmp.name)
    try:
        subprocess.run(["say", "-v", voice, "-r", str(rate), "-o", str(aiff), text], check=True)
        subprocess.run(
            ["afconvert", "-f", "WAVE", "-d", f"LEI16@{SAMPLE_RATE}", "-c", "1", str(aiff), str(wav)],
            check=True,
        )
    finally:
        aiff.unlink(missing_ok=True)


def write_earcon(wav: Path) -> None:
    """The chirp that says the button was pressed: two short rising tones.

    Synthesized rather than recorded, and written with the standard library rather than through
    `say`, for the obvious reason that it is not a word. It is deliberately short (~120 ms) and
    rising: it has to finish before the reading starts and be recognisable as "heard you" rather
    than as an error, which is what a falling pair reads as.

    An envelope on each tone, and that is not decoration: a tone that starts and stops at full
    amplitude clicks, and on a PWM output the click is louder than the tone.
    """
    tones = [(880.0, 0.06), (1320.0, 0.06)]
    frames = bytearray()
    for frequency, seconds in tones:
        count = int(SAMPLE_RATE * seconds)
        for i in range(count):
            # Raised-cosine envelope over the whole tone: zero at both ends, so there is no click.
            envelope = 0.5 * (1.0 - math.cos(2.0 * math.pi * i / count))
            value = 0.5 * envelope * math.sin(2.0 * math.pi * frequency * i / SAMPLE_RATE)
            frames += struct.pack("<h", int(value * 32767))
    wav.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(wav), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SAMPLE_RATE)
        out.writeframes(bytes(frames))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--output", type=Path, default=Path("announcements") / SYSTEM_DIR)
    p.add_argument("--voice", default="Mónica", help="a Spanish macOS voice, the same one the bus clips use")
    p.add_argument("--rate", type=int, default=175, help="words per minute")
    args = p.parse_args()

    write_earcon(args.output / EARCON_FILE)
    for clip, text in NOTICES.items():
        speak_to_wav(text, args.output / clip, args.voice, args.rate)

    total = sum(f.stat().st_size for f in args.output.glob("*.wav"))
    print(f"{len(NOTICES) + 1} files, {total / 1024:.0f} KB -> {args.output}")


if __name__ == "__main__":
    if sys.platform != "darwin":
        raise SystemExit("`say` and `afconvert` are macOS tools: run this on the Mac, then scp the folder")
    main()
