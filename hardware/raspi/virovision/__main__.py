"""Entry point: `python -m virovision [--no-camera] [--name ViroVision] [-v]`.

It starts BlueZ as a peripheral (no-IO agent, GATT service, advertisement) and keeps running. systemd
launches it (`virovision.service`); by hand it is useful for debugging with `-v`.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import signal

from bluez_peripheral.advert import Advertisement
from bluez_peripheral.agent import NoIoAgent
from bluez_peripheral.util import Adapter, get_message_bus, is_bluez_available

from .ap import AP_IP, AccessPoint
from .audio import Player
from .button import DEFAULT_GPIO, try_connect
from .camera import Camera, synthetic_payload
from .state import local_ip, read_status
from .http_server import DEFAULT_PORT, HttpServer
from .gatt import ADVERTISED_NAME, SERVICE_UUID, ViroVisionService

log = logging.getLogger("virovision")

STATUS_EVERY_SECONDS = 15


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="virovision", description="ViroVision device BLE daemon")
    parser.add_argument("--no-camera", action="store_true", help="do not try to open the camera (measure only)")
    parser.add_argument("--name", default=ADVERTISED_NAME, help="advertised BLE name")
    parser.add_argument("--hci", default="hci0", help="Bluetooth adapter (default hci0)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="HTTP server port (plan B)")
    parser.add_argument("--no-http", action="store_true", help="do not bring the HTTP server up")
    parser.add_argument("--no-audio", action="store_true", help="receive the reading's audio but do not play it (only store it)")
    parser.add_argument("--no-ap", action="store_true", help="do not bring the access point up at startup (development on the home network)")
    parser.add_argument("--no-button", action="store_true", help="do not use the physical button (modes come in over BLE only)")
    parser.add_argument("--button-gpio", type=int, default=DEFAULT_GPIO, help=f"GPIO of the mode button (default {DEFAULT_GPIO} = physical pin 29)")
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args()


async def _get_adapter(bus, hci: str) -> Adapter:
    """`Adapter.get_first` in bluez-peripheral 0.1.7 walks every child of /org/bluez and assumes each
    one is an adapter; BlueZ 5.82 (Trixie) also exposes `/org/bluez/test`, without `Adapter1`, and the
    library blows up with InterfaceNotFoundError. The adapter is built by hand from its path."""
    path = f"/org/bluez/{hci}"
    introspection = await bus.introspect("org.bluez", path)
    return Adapter(bus.get_proxy_object("org.bluez", path, introspection))


async def _main(args: argparse.Namespace) -> None:
    loop = asyncio.get_running_loop()

    camera = Camera()
    has_camera = False if args.no_camera else camera.start()
    capture = (lambda: loop.run_in_executor(None, camera.capture_jpeg)) if has_camera else None

    # The HTTP server (ADR 0003's plan B) runs on its own thread; its port travels through `status` so
    # the app knows where to download the photo from. The capture is the same blocking function BLE
    # uses.
    ap = AccessPoint()

    def ap_control(on: bool) -> None:
        ap.turn_on() if on else ap.turn_off()

    # The device's speaker. It is built even with `--no-http`, so the log says at startup whether
    # there is anything on this board able to play a reading.
    player = Player()

    http = None
    if not args.no_http:
        http = HttpServer(
            # `camera.available` and not `has_camera`: if a capture hangs the camera restarts, and if
            # it does not come back, the status has to say so.
            read_status=lambda: read_status(camera=camera.available, http_port=args.port, ap=ap.on, network=ap.active_connection()),
            synthetic_payload=synthetic_payload,
            capture=camera.capture_jpeg if has_camera else None,
            port=args.port,
            # THE closing of the supermarket loop: until this was passed, `/audio` wrote the MP3 to
            # /tmp, answered 202 and nobody ever heard it. `--no-audio` keeps that old behaviour for
            # debugging a reading without the sound.
            play=None if args.no_audio else player.play,
        )
        http.start()

    bus = await get_message_bus()
    if not await is_bluez_available(bus):
        raise SystemExit("BlueZ is not available on D-Bus: is bluetooth.service running?")

    adapter = await _get_adapter(bus, args.hci)

    service = ViroVisionService(
        loop=loop,
        read_status=lambda: read_status(camera=camera.available, http_port=args.port if http else None, ap=ap.on, network=ap.active_connection()),
        capture=capture,
        synthetic_payload=synthetic_payload,
        ap_control=ap_control,
        read_wifi=lambda: {**ap.credentials(), "port": args.port if http else None},
    )
    await service.register(bus, adapter=adapter)

    # The physical button (ADR 0007) goes against the same core as BLE: it is a user gesture, not a
    # transport. If there is no button (or no gpiozero, or no permissions on the pin) the daemon starts
    # all the same and modes keep coming in from the app; a board without a daemon would be far worse.
    button = None if args.no_button else try_connect(
        loop,
        on_clicks=service.core.from_button,
        on_hold=service.core.button_long_press,
        gpio=args.button_gpio,
    )

    # Without an agent, BlueZ rejects any pairing attempt. NoIo = "just works", no PIN: the user cannot
    # read a PIN on the device, and ADR 0003 deliberately does not encrypt the payload.
    agent = NoIoAgent()
    await agent.register(bus)

    await adapter.set_powered(True)
    await adapter.set_alias(args.name)

    # The AP stays on while the device is powered (ADR 0003, 2026-09-07 update): the phone joins when
    # it connects over BLE and the photo is available the instant a mode is activated. With no time
    # cap: the user configures nothing and cannot "reactivate" it. It costs battery; that is measured.
    # `--no-ap` is for developing with the device on the home network (with the AP up the device leaves
    # any other network and SSH is lost).
    if not args.no_ap:
        # At startup NetworkManager may not be ready yet (on 2026-09-07 the device was left "with no
        # network" after the first boot with the AP): it is retried with growing backoff and it is
        # verified that the interface has the AP's IP, not just that nmcli returned.
        for attempt, wait in enumerate((0, 5, 10, 20, 30), start=1):
            if wait:
                await asyncio.sleep(wait)
            try:
                await loop.run_in_executor(None, ap.turn_on)
                if local_ip() == AP_IP:
                    break
                log.warning("AP up but wlan0 does not have %s (attempt %d)", AP_IP, attempt)
            except Exception as exc:  # noqa: BLE001
                log.error("could not bring the AP up (attempt %d): %s", attempt, exc)
        else:
            log.error("the AP did not end up operational after several attempts; carrying on without it")

    # timeout 0 = advertise until the process dies; the device has to be discoverable always, because
    # the app reconnects on its own when it comes back into range.
    advert = Advertisement(args.name, [SERVICE_UUID], 0x0000, 0)
    await advert.register(bus, adapter)
    log.info("advertising \"%s\" with service %s (camera: %s)", args.name, SERVICE_UUID, "yes" if has_camera else "no")

    stop = asyncio.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    no_network_since = None
    while not stop.is_set():
        try:
            await asyncio.wait_for(stop.wait(), STATUS_EVERY_SECONDS)
        except asyncio.TimeoutError:
            service.notify_status()
            # Network watchdog: if it is not an AP and it has gone more than a minute with no network,
            # ask NM to connect. A device on no network at all is useless and cannot be fixed remotely.
            if not ap.on and ap.active_connection() is None:
                no_network_since = no_network_since or loop.time()
                if loop.time() - no_network_since > 60:
                    log.warning("no network for %d s: reconnecting", int(loop.time() - no_network_since))
                    await loop.run_in_executor(None, ap.reconnect)
                    no_network_since = None
            else:
                no_network_since = None
    log.info("shutting down")
    if button:
        button.close()
    # Silence a reading still playing: otherwise a restart of the service leaves a voice talking
    # about a product from before, with no daemon behind it.
    player.stop()
    if http:
        http.stop()
    bus.disconnect()


def main() -> None:
    args = _arguments()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(_main(args))


if __name__ == "__main__":
    main()
