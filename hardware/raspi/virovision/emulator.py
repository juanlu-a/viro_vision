"""Emulator of the device on a Mac: the same core, published over CoreBluetooth with `bless`.

It is useful for testing the app against the real GATT profile without having the device powered:
connection, modes, events, and the reassembly of a transfer. **The throughput measured against the
Mac is not the device's** (different chip, Bluetooth 5, different stack); it is good for validating
the app, not for deciding ADR 0003. Run it with:

    python3 -m virovision.emulator            # advertises "ViroVision"
    python3 -m virovision.emulator --name ViroVision-Mac

macOS asks for Bluetooth permission for the terminal the first time (Privacy & Security → Bluetooth).
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import signal
import sys
from functools import partial
from typing import Any

from .camera import synthetic_payload
from .state import read_status
from .http_server import DEFAULT_PORT, HttpServer
from .profile import (
    CH_CONTROL,
    CH_STATUS,
    CH_EVENT,
    CH_MODE,
    CH_TRANSFER,
    CH_WIFI,
    ADVERTISED_NAME,
    SERVICE_UUID,
    UUID_BY_NAME,
)
from .core import Core

log = logging.getLogger("virovision.emulator")

STATUS_EVERY_SECONDS = 15
# If CoreBluetooth does not accept a notification within this time, nobody is listening or the
# connection died; it is cut instead of waiting forever.
MAX_NOTIFICATION_WAIT_S = 5.0


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="virovision.emulator", description="Emulates the ViroVision device from the Mac")
    parser.add_argument("--name", default=ADVERTISED_NAME, help="advertised BLE name")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="HTTP server port (plan B)")
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args()


async def _main(args: argparse.Namespace) -> None:
    from bless import BlessServer, GATTAttributePermissions as Perms, GATTCharacteristicProperties as Props

    loop = asyncio.get_running_loop()
    server = BlessServer(name=args.name, loop=loop)

    async def notify(name: str, value: bytes) -> None:
        uuid = UUID_BY_NAME[name]
        server.get_characteristic(uuid).value = bytearray(value)
        # `update_value` returns False when CoreBluetooth's transmission queue is full: that is the
        # flow control. It is retried with a minimal pause, which also gives a realistic rhythm.
        deadline = loop.time() + MAX_NOTIFICATION_WAIT_S
        while not server.update_value(SERVICE_UUID, uuid):
            if loop.time() > deadline:
                log.warning("CoreBluetooth did not accept the %s notification within %.0f s", name, MAX_NOTIFICATION_WAIT_S)
                return
            await asyncio.sleep(0.002)

    http = HttpServer(
        read_status=lambda: read_status(camera=False, http_port=args.port),
        synthetic_payload=synthetic_payload,
        capture=None,
        port=args.port,
    )
    http.start()

    core = Core(
        loop=loop,
        read_status=partial(read_status, camera=False, http_port=args.port),
        capture=None,
        synthetic_payload=synthetic_payload,
        notify=notify,
    )

    # bless's callbacks arrive from CoreBluetooth's thread: reads are synchronous and return bytes;
    # writes are handed to the asyncio loop with `call_soon_threadsafe`.
    def on_read(characteristic: Any, **_: Any) -> bytearray:
        uuid = str(characteristic.uuid).lower()
        if uuid == CH_MODE:
            return bytearray(core.read_mode())
        if uuid == CH_STATUS:
            return bytearray(core.read_status())
        if uuid == CH_WIFI:
            return bytearray(core.read_wifi())
        return bytearray(characteristic.value or b"")

    def on_write(characteristic: Any, value: Any, **_: Any) -> None:
        uuid = str(characteristic.uuid).lower()
        data = bytes(value)
        if uuid == CH_CONTROL:
            loop.call_soon_threadsafe(core.write_control, data, 0)
        elif uuid == CH_MODE:
            loop.call_soon_threadsafe(core.write_mode, data)

    server.read_request_func = on_read
    server.write_request_func = on_write

    await server.add_new_service(SERVICE_UUID)
    # Always `value=None`: CoreBluetooth only allows a cached value on read-only characteristics
    # ("Characteristics with cached values must be read-only"); everything else is served from
    # `on_read` or by notification.
    await server.add_new_characteristic(SERVICE_UUID, CH_MODE, Props.read | Props.notify | Props.write, None, Perms.readable | Perms.writeable)
    await server.add_new_characteristic(SERVICE_UUID, CH_CONTROL, Props.write | Props.write_without_response, None, Perms.writeable)
    await server.add_new_characteristic(SERVICE_UUID, CH_EVENT, Props.notify, None, Perms.readable)
    await server.add_new_characteristic(SERVICE_UUID, CH_TRANSFER, Props.notify, None, Perms.readable)
    await server.add_new_characteristic(SERVICE_UUID, CH_STATUS, Props.read | Props.notify, None, Perms.readable)
    await server.add_new_characteristic(SERVICE_UUID, CH_WIFI, Props.read, None, Perms.readable)

    # prioritize_local_name=False: the app scans by the service UUID, so it has to be in the
    # advertisement packet even if the name gets truncated.
    await server.start(prioritize_local_name=False)
    log.info("emulating the device as \"%s\", service %s. Ctrl-C to stop.", args.name, SERVICE_UUID)

    stop = asyncio.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    while not stop.is_set():
        try:
            await asyncio.wait_for(stop.wait(), STATUS_EVERY_SECONDS)
        except asyncio.TimeoutError:
            core.notify_status()
    log.info("shutting down")
    http.stop()
    await server.stop()


def main() -> None:
    if sys.platform != "darwin":
        raise SystemExit("the emulator is for macOS; on the device run `python -m virovision`")
    args = _arguments()
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    asyncio.run(_main(args))


if __name__ == "__main__":
    main()
