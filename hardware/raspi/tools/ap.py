"""Turns the board's access point on and off over BLE, from the Mac.

It exists to **get into the board without the microSD**. In product mode the board brings up its AP
and leaves the home WiFi, so there is no SSH; pulling the card to create `SIN-AP` means powering it
off and opening the case. The repo's to-do list already named this path ("turn the AP off over BLE
from the Mac with the app closed"), but there was nothing to do it with. This is that.

It is not a trick: `AccessPoint.turn_off()` hands wlan0 back to a known network on purpose
(`AccessPoint.reconnect`), so the board rejoins the home WiFi on its own.

```sh
cd hardware/raspi
./.venv-mac/bin/python tools/ap.py --status   # only looks
./.venv-mac/bin/python tools/ap.py            # turns the AP off -> back to the home WiFi -> SSH
./.venv-mac/bin/python tools/ap.py --on       # turns it back on (20 min)
```

**The phone app has to be closed.** While a central is connected the board stops advertising and
the scan does not find it, which is also why the app learned to look first at what is already
connected to the system (ADR 0003, upd. 2026-09-13).

It also leaves a counter-test of the ADR: this reads `status` and writes to `control` **without
pairing**. If a bond were ever needed for it to work, someone put authentication on a
characteristic and it needs discussing.

The first run asks for Bluetooth permission for the terminal (macOS). Without it the scan comes back
empty with no error at all: if "it does not show up" and the board is on right next to you, that is
why.
"""

import asyncio
import json
import sys
from pathlib import Path

from bleak import BleakClient, BleakScanner

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from virovision.profile import CH_CONTROL, CH_STATUS, CH_WIFI, SERVICE_UUID as SERVICE  # noqa: E402


async def main() -> int:
    turn_on = "--on" in sys.argv
    only_status = "--status" in sys.argv

    print("Looking for the board by its service UUID (up to 20 s)...")
    device = await BleakScanner.find_device_by_filter(
        lambda d, ad: SERVICE.lower() in [u.lower() for u in (ad.service_uuids or [])],
        timeout=20.0,
    )
    if device is None:
        print("\nNot found.  It may be that:")
        print("  - the board is off or out of range;")
        print("  - the phone app has it connected (a connected central stops advertising);")
        print("  - the Mac has no Bluetooth permission for the terminal (Settings > Privacy).")
        return 1

    print(f"Found: {device.name or 'ViroVision'}  [{device.address}]")
    async with BleakClient(device) as client:
        status = json.loads((await client.read_gatt_char(CH_STATUS)).decode())
        print("\nCurrent status:")
        print(f"  version  {status.get('version')}")
        print(f"  ap       {status.get('ap')}")
        print(f"  ip       {status.get('ip')}:{status.get('port')}")
        print(f"  camera   {status.get('camera')}")
        try:
            print(f"  wifi     {json.loads((await client.read_gatt_char(CH_WIFI)).decode())}")
        except Exception:
            pass

        if only_status:
            return 0

        command = {"cmd": "ap", "value": True, "minutes": 20} if turn_on else {"cmd": "ap", "value": False}
        print(f"\nSending {command} ...")
        await client.write_gatt_char(CH_CONTROL, json.dumps(command).encode(), response=True)

        # `nmcli con up/down` + `device connect wlan0` takes several seconds; the board reports it
        # through `status`, but here reading it again is enough.
        for attempt in range(12):
            await asyncio.sleep(5)
            try:
                status = json.loads((await client.read_gatt_char(CH_STATUS)).decode())
            except Exception as exc:
                print(f"  (the link dropped: {exc}) — normal if the radio was reconfigured")
                break
            print(f"  [{(attempt + 1) * 5:>3}s] ap={status.get('ap')}  ip={status.get('ip')}")
            if status.get("ap") is turn_on and status.get("ip"):
                break

    print("\nDone.  If the AP is off, the board should be rejoining the home WiFi.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
