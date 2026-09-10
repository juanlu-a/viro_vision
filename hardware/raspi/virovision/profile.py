"""GATT profile of the ViroVision device: UUIDs and advertised name. Dependency-free, so that the
device's BlueZ adapter (`gatt.py`) and the Mac's CoreBluetooth emulator (`emulator.py`) can import it
alike.

SHARED SOURCE OF TRUTH with the app: `app/src/features/device/gatt.ts` has these very same UUIDs
copied by hand. If something changes here, it changes there in the same PR. They are randomly
generated 128-bit UUIDs (`uuidgen`), with the 3rd and 4th byte as the characteristic index; the old
placeholders' range 0000xxxx-0000-1000-8000-00805f9b34fb is that of the 16-bit UUIDs assigned by the
Bluetooth SIG and nothing can be invented there.
"""

from .core import STATUS, EVENT, MODE, TRANSFER

SERVICE_UUID = "4380c500-7ca3-4e37-b27d-f60e8d8d73d1"
CH_MODE = "4380c501-7ca3-4e37-b27d-f60e8d8d73d1"
CH_CONTROL = "4380c502-7ca3-4e37-b27d-f60e8d8d73d1"
CH_EVENT = "4380c503-7ca3-4e37-b27d-f60e8d8d73d1"
CH_TRANSFER = "4380c504-7ca3-4e37-b27d-f60e8d8d73d1"
CH_STATUS = "4380c505-7ca3-4e37-b27d-f60e8d8d73d1"
# Credentials of the device's access point (plan B, ADR 0003): the app reads them over BLE and joins
# the WiFi on its own; the user configures nothing.
CH_WIFI = "4380c506-7ca3-4e37-b27d-f60e8d8d73d1"

UUID_BY_NAME = {MODE: CH_MODE, EVENT: CH_EVENT, TRANSFER: CH_TRANSFER, STATUS: CH_STATUS}

ADVERTISED_NAME = "ViroVision"
