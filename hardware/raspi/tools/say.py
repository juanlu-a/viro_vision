"""Makes the board say a system notice, over BLE, from the Mac.

It exists because of what happened on 2026-09-16. System notices (ADR 0003, upd. 2026-09-16) travel
a long path (setting in the app → `notify` → write to `control` → `notices.py` → `aplay`) and
**every link fails silently**: a missing clip, a misspelled name, an old daemon that does not know
the command. Without this, the only way to test it was to install a build on the phone and put the
glasses on, and by then there is no telling which link broke.

It is the counterpart of `ap.py` and shares its shape: reads `status`, writes to `control`, no
pairing.

```sh
cd hardware/raspi
./.venv-mac/bin/python tools/say.py                    # connected.wav
./.venv-mac/bin/python tools/say.py mode_bus.wav       # a specific one
./.venv-mac/bin/python tools/say.py --all              # all of them, one after another
./.venv-mac/bin/python tools/say.py --list             # which names the board accepts
```

**The phone app has to be closed**, for the same reason as in `ap.py`: while a central is connected
the board stops advertising and the scan does not find it.

A name the board does not know comes back as an `error` event instead of breaking anything, and that
is also worth seeing work.
"""

import asyncio
import json
import sys
from pathlib import Path

from bleak import BleakClient, BleakScanner

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from virovision.notices import CLIPS, EARCON_FILE, NOTICES  # noqa: E402
from virovision.profile import CH_CONTROL, CH_EVENT, SERVICE_UUID as SERVICE  # noqa: E402

# How long a notice takes to say. Clips run from 0.1 s (the chirp) to 4 s (the audio test phrase);
# with less than this, `--all` talks over itself and none is heard whole.
BETWEEN_CLIPS_S = 4.5


def listing() -> str:
    lines = [f"  {clip:<24} {text}" for clip, text in sorted(NOTICES.items())]
    lines.append(f"  {EARCON_FILE:<24} (the button chirp, not a phrase)")
    return "\n".join(lines)


async def main() -> int:
    if "--list" in sys.argv:
        print(listing())
        return 0

    every = "--all" in sys.argv
    asked = [a for a in sys.argv[1:] if not a.startswith("--")]
    clips = sorted(CLIPS) if every else (asked or ["connected.wav"])

    unknown = [c for c in clips if c not in CLIPS]
    if unknown:
        # Caught here and not on the board: sending a made-up name tests the rejection, but a typo
        # while debugging something else only confuses.
        print(f"the board does not know: {', '.join(unknown)}\n\nit accepts:\n{listing()}")
        return 2

    print("looking for the board (the phone app has to be closed)…")
    device = await BleakScanner.find_device_by_filter(
        lambda d, ad: SERVICE.lower() in [u.lower() for u in (ad.service_uuids or [])], timeout=15.0
    )
    if device is None:
        print("not found: is it on, and is the app closed?")
        return 1

    async with BleakClient(device) as client:
        errors: list = []

        def on_event(_, data: bytearray) -> None:
            try:
                event = json.loads(data.decode())
            except (UnicodeDecodeError, json.JSONDecodeError):
                return
            if event.get("t") == "error":
                errors.append(event.get("msg", ""))
                print(f"  ← the board reports: {event.get('msg')}")

        await client.start_notify(CH_EVENT, on_event)
        for clip in clips:
            print(f"→ {clip}")
            # `response=False`: the same write-without-response the app uses, so what is tested here
            # is the real path and not a lookalike.
            await client.write_gatt_char(
                CH_CONTROL, json.dumps({"cmd": "say", "clip": clip}).encode(), response=False
            )
            await asyncio.sleep(BETWEEN_CLIPS_S if len(clips) > 1 else 1.5)
        await client.stop_notify(CH_EVENT)

        if errors:
            print(f"\n{len(errors)} error report(s) from the board: something on the path is not in place")
            return 1
    print("\nno errors from the board: listen for it on the speaker")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
