"""The system notices the device can say: what ViroVision reports about itself.

Bus readings are announced with the clips `bus_banner.announcements` names (a `.wav` per line and per
destination, generated from the STM catalogue). These are the other half: the link, the network, the
mode, the setting — everything the app used to say only through the phone's speech synthesizer, and
which since 2026-09-16 comes out of whatever output the user chose (`features/audio/audioOutput.ts`).

**Why recordings and not a TTS on the board.** Same reason as ADR 0003 §5, only sharper here: these
notices exist to report that something broke, and the first thing that breaks is the network. A
notice that needs the cloud to be spoken is a notice that goes silent exactly when it is needed. The
set is closed and tiny, so a `.wav` each costs a few hundred kilobytes on the SD and zero latency.

**SHARED SOURCE OF TRUTH with the app:** `app/src/features/audio/notices.ts` has these same file
names. `notices.test.ts` on that side reads this file and fails if they drift — the names cannot be
left to convention, because a name that does not exist here fails the way this whole feature fails,
in silence: the board logs "nothing can play" and the user simply hears nothing.

The Spanish is here and not only in the app because this is what gets recorded
(`tools/make_system_announcements.py`). The two texts differ on purpose for the three notices that
carry a variable detail: the phone appends it, the board says a self-contained sentence, because
nobody can record one clip per error message.
"""

from __future__ import annotations

SYSTEM_DIR = "system"
"""Subdirectory of the announcements directory. Separate from the bus clips so a regenerated
catalogue of lines cannot wipe the system notices, and so `ls` says which is which."""

NOTICES = {
    "connected.wav": "Dispositivo conectado.",
    "network_ready.wav": "Red con el dispositivo lista.",
    # The app appends which step failed; here the sentence has to stand on its own.
    "network_failed.wav": "No se pudo usar la red del dispositivo.",
    "device_warning.wav": "El dispositivo tiene un aviso. Miralo en el teléfono.",
    "mode_write_failed.wav": "No pude avisarle el modo al dispositivo.",
    "mode_idle.wav": "Esperando. Reconocimiento apagado.",
    "mode_bus.wav": "Modo ómnibus activado.",
    "mode_supermarket.wav": "Modo supermercado activado.",
    "output_device.wav": "Dónde se escucha: en el dispositivo.",
    "audio_test.wav": "Hola, soy ViroVision. La salida de audio funciona correctamente.",
}
"""Clip file name -> what it says. Everything here is speech."""

EARCON_FILE = "earcon_start.wav"
"""The chirp played the instant a reading is requested. Not speech, so it is not in `NOTICES`: the
generator synthesizes it instead of recording it. It is the app's `earcon-start.m4a` moved to the
board — the sound that tells the user the button did something during the seconds the cloud takes."""

CLIPS = frozenset(NOTICES) | {EARCON_FILE}
"""Every name the app is allowed to ask for. The board refuses anything else rather than joining a
path it was handed: `clip` arrives over BLE and must not be able to name a file outside this set."""


def is_known(clip: str) -> bool:
    """Whether this is a notice the board publishes.

    An allow-list and not a `..` check on purpose. Sanitizing a path is a thing that gets subtly
    wrong; the set of notices is closed and known at import time, so comparing against it is both
    simpler and complete.
    """
    return clip in CLIPS
