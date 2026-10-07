"""Restarts the board's camera over BLE, from the Mac, to test the recovery path.

The daemon only restarts the camera when it fails — 12 s without frames in bus mode, or a photo that
hangs — and neither can be provoked on purpose. This sends `{"cmd":"restart_camera"}`, which calls the
same `Camera.restart()` the watchdog uses (2026-10-06).

```sh
cd hardware/raspi
./.venv-mac/bin/python tools/restart_camera.py
```

Watch the result in the board's journal (`journalctl -u virovision -f`): in bus mode, frames and
detections must come back after the restart, with no `detector loaded into the sensor` line in
between. **The phone app must be closed**: a connected central stops the board from advertising
(same caveat as `tools/ap.py`).
"""

import asyncio
import json
import sys

from bleak import BleakClient, BleakScanner

SERVICE = "4380c500-7ca3-4e37-b27d-f60e8d8d73d1"
CH_CONTROL = "4380c502-7ca3-4e37-b27d-f60e8d8d73d1"
CH_EVENT = "4380c503-7ca3-4e37-b27d-f60e8d8d73d1"


async def main() -> int:
    print("Looking for the board by its service UUID (up to 20 s)...")
    device = await BleakScanner.find_device_by_filter(
        lambda d, ad: SERVICE.lower() in [u.lower() for u in (ad.service_uuids or [])],
        timeout=20.0,
    )
    if device is None:
        print("Not found: board off or out of range, the phone app connected to it, or the terminal")
        print("lacks Bluetooth permission (System Settings > Privacy).")
        return 1

    print(f"Found: {device.name or 'ViroVision'}  [{device.address}]")
    async with BleakClient(device) as client:
        events = []
        await client.start_notify(CH_EVENT, lambda _, data: events.append(data.decode(errors="replace")))
        await client.write_gatt_char(CH_CONTROL, json.dumps({"cmd": "restart_camera"}).encode(), response=True)
        print("Sent restart_camera. Listening for events for 15 s...")
        await asyncio.sleep(15)
        for event in events:
            print(f"  event: {event}")
        if not events:
            print("  (no events: the restart was accepted; check the journal)")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
