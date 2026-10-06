"""Entry point: `python -m virovision [--no-camera] [--name ViroVision] [-v]`.

It starts BlueZ as a peripheral (no-IO agent, GATT service, advertisement) and keeps running. systemd
launches it (`virovision.service`); by hand it is useful for debugging with `-v`.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from pathlib import Path
import signal

from bluez_peripheral.advert import Advertisement
from bluez_peripheral.agent import NoIoAgent
from bluez_peripheral.util import Adapter, get_message_bus, is_bluez_available

from .ap import AP_IP, AccessPoint
from .audio import DEFAULT_VOLUME_PERCENT, Player, set_output_volume
from .button import DEBOUNCE_S, DEFAULT_GPIO, DOUBLE_CLICK_WINDOW_S, LONG_PRESS_S, try_connect
from .bus import DEFAULT_ANNOUNCEMENTS as BUS_DEFAULT_ANNOUNCEMENTS
from .bus import DEFAULT_CATALOG as BUS_DEFAULT_CATALOG
from .bus import DEFAULT_MODEL as BUS_DEFAULT_MODEL
from .bus import BusWatcher
from .camera import Camera, synthetic_payload
from .log_relay import LogRelay
from .notices import SYSTEM_DIR
from .state import NetworkSnapshot, local_ip, read_status
from .http_server import DEFAULT_PORT, HttpServer
from .gatt import ADVERTISED_NAME, SERVICE_UUID, ViroVisionService
from .modes import Mode
from .link import CentralWatcher, log_existing_bonds, report_visibility, set_bonding

log = logging.getLogger("virovision")

STATUS_EVERY_SECONDS = 15
AP_REFRESH_WAIT_S = 10.0
"""How long an AP change waits for a network refresh already in flight before giving up on its own."""


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="virovision", description="ViroVision device BLE daemon")
    parser.add_argument("--no-camera", action="store_true", help="do not try to open the camera (measure only)")
    parser.add_argument("--name", default=ADVERTISED_NAME, help="advertised BLE name")
    parser.add_argument("--hci", default="hci0", help="Bluetooth adapter (default hci0)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="HTTP server port (plan B)")
    parser.add_argument("--no-http", action="store_true", help="do not bring the HTTP server up")
    parser.add_argument("--no-audio", action="store_true", help="receive the reading's audio but do not play it (only store it)")
    parser.add_argument("--volume", type=int, default=DEFAULT_VOLUME_PERCENT, help=f"output level 0-100, applied at startup (default {DEFAULT_VOLUME_PERCENT})")
    parser.add_argument("--no-ap", action="store_true", help="do not bring the access point up at startup (development on the home network)")
    parser.add_argument(
        "--bus-model",
        type=Path,
        default=BUS_DEFAULT_MODEL,
        help="detector (.rpk) loaded into the IMX500 sensor for bus mode",
    )
    parser.add_argument(
        "--bus-labels",
        default=None,
        help=(
            "classes the detector emits, in order, comma separated (e.g. 'bus_sign,bus'). Needed when "
            "the .rpk does not carry them. A model that has a 'bus' class is used as is; one that only "
            "finds signs has each sign stand in for its bus, so the tracker has something to follow"
        ),
    )
    parser.add_argument("--announcements", type=Path, default=BUS_DEFAULT_ANNOUNCEMENTS, help="folder with the pre-recorded .wav")
    parser.add_argument("--bus-catalog", type=Path, default=BUS_DEFAULT_CATALOG, help="CSV number,destination used to fix the OCR")
    parser.add_argument("--no-bus", action="store_true", help="do not load the detector nor watch in bus mode")
    parser.add_argument("--no-button", action="store_true", help="do not use the physical button (modes come in over BLE only)")
    parser.add_argument("--button-gpio", type=int, default=DEFAULT_GPIO, help=f"GPIO of the mode button (default {DEFAULT_GPIO} = physical pin 29)")
    # The three button timings, on the command line because they are calibrated against a real
    # finger: editing `button.py` over SSH for every try is why they went untested for days.
    parser.add_argument("--debounce-ms", type=float, default=DEBOUNCE_S * 1000, help=f"button debounce, ms (default {int(DEBOUNCE_S * 1000)}); an upper bound on how short a click may be")
    parser.add_argument("--long-press-ms", type=float, default=LONG_PRESS_S * 1000, help=f"hold threshold to leave the mode, ms (default {int(LONG_PRESS_S * 1000)})")
    parser.add_argument("--double-click-ms", type=float, default=DOUBLE_CLICK_WINDOW_S * 1000, help=f"wait after a release before deciding how many clicks there were, ms (default {int(DOUBLE_CLICK_WINDOW_S * 1000)})")
    parser.add_argument(
        "--pairable",
        action="store_true",
        help="let centrals bond with this board (off by default: ADR 0003 does not encrypt, so the app never needs a bond, and a stale bond is what makes iOS ask to pair again)",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args()


async def _get_adapter(bus, hci: str) -> Adapter:
    """`Adapter.get_first` in bluez-peripheral 0.1.7 walks every child of /org/bluez and assumes each
    one is an adapter; BlueZ 5.82 (Trixie) also exposes `/org/bluez/test`, without `Adapter1`, and the
    library blows up with InterfaceNotFoundError. The adapter is built by hand from its path."""
    path = f"/org/bluez/{hci}"
    introspection = await bus.introspect("org.bluez", path)
    return Adapter(bus.get_proxy_object("org.bluez", path, introspection))


def _log_task_failure(task: asyncio.Task) -> None:
    """A background task's exception otherwise surfaces only as "Task exception was never retrieved",
    whenever the garbage collector gets to it — or never, for a task held in a variable (2026-10-06)."""
    if not task.cancelled() and task.exception() is not None:
        log.error("%s failed", task.get_name(), exc_info=task.exception())


async def _main(args: argparse.Namespace) -> None:
    loop = asyncio.get_running_loop()
    # Right away, not after startup (2026-10-06): startup takes from seconds to minutes (BlueZ, the
    # AP's retries), and a SIGTERM in that window killed the process on Python's default handler
    # without the shutdown below — a reading left playing with no daemon behind it.
    stop = asyncio.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    # The journal's warnings and errors, to the phone (`log_relay.py`). Installed first so the boot —
    # where the camera and the AP fail if they are going to — is buffered for the first phone.
    relay = LogRelay()
    logging.getLogger().addHandler(relay)

    camera = Camera(model=None if args.no_bus else args.bus_model)
    # The camera is NOT started here: it starts in the background once the board is advertising
    # (`_bring_camera_up`, below). Loading the detector into the IMX500 takes about a minute after a
    # boot, and while it ran here the board was invisible to every phone; any hang in it left the board
    # invisible for good (2026-10-05). Capture is wired now and answers "still starting" until then.
    wants_camera = not args.no_camera
    capture = (lambda: loop.run_in_executor(None, camera.capture_jpeg)) if wants_camera else None

    # The HTTP server (ADR 0003's plan B) runs on its own thread; its port travels through `status` so
    # the app knows where to download the photo from. The capture is the same blocking function BLE
    # uses.
    ap = AccessPoint()
    network = NetworkSnapshot(ap.active_connection)

    def ap_control(on: bool) -> None:
        """Runs in an executor (`Core._toggle_ap`), so the snapshot is refreshed right here: the
        status the core pushes next must already carry the AP's address, or the phone learns where to
        download the photo from only on the next heartbeat."""
        try:
            if on:
                ap.turn_on()
            else:
                ap.turn_off()
        finally:
            network.refresh(wait_s=AP_REFRESH_WAIT_S)

    def status() -> dict:
        """The one status, for BLE and HTTP alike. It reads only memory: the network lookups are
        refreshed off the loop (`NetworkSnapshot`). `camera.available` and not a flag taken at
        startup: if a capture hangs the camera restarts, and if it does not come back, the status has
        to say so."""
        name, ip = network.current
        return read_status(camera=camera.available, http_port=None if args.no_http else args.port, ap=ap.on, network=name, ip=ip)

    # The device's speaker. It is built even with `--no-http`, so the log says at startup whether
    # there is anything on this board able to play a reading. The level is set here and not left to
    # whatever `amixer` was last told by hand: on 2026-09-11 the first real reading came out too quiet
    # to use, and a level that depends on who ran what is not a level.
    player = Player()
    set_output_volume(args.volume)

    def say(clip: str) -> bool:
        """Play a system notice the app asked for over BLE (`cmd: 'say'`). True if the file was there.

        The path is built here and nowhere else: the core validates the NAME against the closed set
        in `notices.py` and never sees a directory, so nothing that arrives over the air can point at
        a file outside `announcements/system/`.

        **The existence check is the whole return value.** `player.play` cannot report it: it spawns
        `aplay` and does not wait, and `aplay` writes its complaint to a /dev/null we chose on
        purpose. So a board whose `announcements/system/` was never copied plays nothing and says
        nothing about it — which is how this looked from the phone on 2026-09-16.

        `player.play` and not `play_sequence`: a notice is one file, and a newer one should cut off
        the one still talking — hearing "red lista" finish on top of "se perdió la conexión" is worse
        than losing the first.
        """
        path = args.announcements / SYSTEM_DIR / clip
        if not path.exists():
            return False
        player.play(str(path))
        return True

    http = None
    if not args.no_http:
        http = HttpServer(
            read_status=status,
            synthetic_payload=synthetic_payload,
            capture=camera.capture_jpeg if wants_camera else None,
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
        read_status=status,
        capture=capture,
        synthetic_payload=synthetic_payload,
        ap_control=ap_control,
        read_wifi=lambda: {**ap.credentials(), "port": args.port if http else None},
        # `--no-audio` silences the notices for the same reason it silences a reading: it exists to
        # debug the pipeline without the board talking over you.
        say=None if args.no_audio else say,
        hush=None if args.no_audio else player.stop,
    )
    await service.register(bus, adapter=adapter)
    relay.attach(service.core.emit_event)
    service.on_status_read = relay.subscriber_ready

    def _push_status(refresh: asyncio.Future) -> None:
        if not refresh.cancelled() and refresh.exception() is not None:
            log.error("network refresh failed", exc_info=refresh.exception())
        service.notify_status()

    async def _refresh_network() -> None:
        await loop.run_in_executor(None, network.refresh)
        service.notify_status()

    # The first lookup, off the loop and without waiting for it: with NetworkManager still coming up
    # it can take the whole `nmcli` timeout, and advertising does not wait for that.
    network_task = asyncio.create_task(_refresh_network(), name="network-refresh")
    network_task.add_done_callback(_log_task_failure)

    # Bus mode (ADR 0006, amended 2026-09-07): the detector already lives in the sensor, so what is
    # wired here is who speaks and where the reading goes. Built after the service because it emits
    # its readings through this core, and the core starts and stops it on every mode change.
    bus_watcher = None
    if not args.no_bus and wants_camera:
        labels = [name.strip() for name in args.bus_labels.split(",") if name.strip()] if args.bus_labels else None
        # Derived, never passed separately: a detector that emits a `bus` class gives real bus boxes,
        # and synthesizing one from the sign on top of that would give the tracker two boxes per bus.
        # With a sign-only detector the sign has to stand in for its bus or there is nothing to track.
        # Two flags for one fact is how they end up contradicting each other on the board at night.
        signs_only = "bus" not in labels if labels else True
        bus_watcher = BusWatcher(
            camera,
            announce=player.play_sequence,
            emit=service.core.emit_event,
            announcements=args.announcements,
            catalog=args.bus_catalog,
            labels=labels,
            signs_only=signs_only,
        )
        service.core.attach_bus(bus_watcher)

    # The physical button (ADR 0007) goes against the same core as BLE: it is a user gesture, not a
    # transport. If there is no button (or no gpiozero, or no permissions on the pin) the daemon starts
    # all the same and modes keep coming in from the app; a board without a daemon would be far worse.
    button = None if args.no_button else try_connect(
        loop,
        on_clicks=service.core.from_button,
        on_hold=service.core.button_long_press,
        gpio=args.button_gpio,
        long_press_s=args.long_press_ms / 1000,
        window_s=args.double_click_ms / 1000,
        debounce_s=args.debounce_ms / 1000,
    )

    # The agent stays registered even with bonding off: it is what lets BlueZ answer a pairing
    # attempt instead of leaving the central waiting on a request nobody handles. NoIo = "just
    # works", no PIN — the user cannot read a PIN on a device with no screen.
    agent = NoIoAgent()
    await agent.register(bus)

    try:
        await adapter.set_powered(True)
    except Exception as exc:
        # BlueZ answers a blocked radio with a bare `DBusError: Failed`, which says nothing. The usual
        # cause is an rfkill soft block restored at boot (2026-10-05); the unit lifts it before
        # starting, so reaching this means something blocked it again or the controller is gone.
        raise SystemExit(
            f"could not power the Bluetooth adapter on ({exc}); check `bluetoothctl show` for "
            "PowerState: off-blocked and /sys/class/rfkill/*/soft"
        ) from exc
    await adapter.set_alias(args.name)
    # No bonding by default (`link.py` explains why): the app needs no bond, and a bond the phone and
    # the board stop agreeing on is what turns every reconnection into a pairing alert.
    await set_bonding(adapter, args.pairable)
    await log_existing_bonds(bus, f"/org/bluez/{args.hci}")
    # Who connects and who leaves, in the journal. Until 2026-09-13 the board said nothing about the
    # link at all, and "the app finds nothing" had two indistinguishable causes.
    centrals = CentralWatcher(on_change=lambda anyone: None if anyone else relay.central_gone())
    await centrals.start(bus)
    # A phone already connected at startup (the daemon restarted under a live link) is NOT taken as
    # subscribed: the GATT application was registered again with fresh notify state, and replaying
    # the boot buffer then would send the boot errors to nobody. The buffer waits for the first
    # `status` read — the next connection's, at worst (2026-10-06).

    # timeout 0 = advertise until the process dies; the device has to be discoverable always, because
    # the app reconnects on its own when it comes back into range.
    advert = Advertisement(args.name, [SERVICE_UUID], 0x0000, 0)
    await advert.register(bus, adapter)
    log.info("advertising \"%s\" with service %s (camera: %s)", args.name, SERVICE_UUID, "starting" if wants_camera else "no")

    # Discoverable first, everything slow after (2026-10-05). The camera and the AP each take from
    # seconds to a minute, and the phone can connect meanwhile: `status` says what is not up yet and
    # is pushed again the moment each one is.
    async def _bring_camera_up() -> None:
        if not await loop.run_in_executor(None, camera.start):
            return
        service.notify_status()
        if bus_watcher is None:
            return
        if not await loop.run_in_executor(None, lambda: bus_watcher.available):
            log.warning("bus mode unavailable: no detector in the sensor or the reading half is not installed")
            return
        # Loading the OCR takes tens of seconds (two ONNX models), in its own process so it cannot
        # freeze this one (`ocr_worker.py`). Doing it now, while the user is not waiting, is what
        # makes the button answer in a second later. Unless they already pressed it: then the mode
        # starts right away and `start` builds the OCR itself.
        # (A press during the warm-up needs nothing from here: the camera is up by then, so `start`
        # runs normally and says it is preparing.)
        if service.core.modes.current is Mode.BUS:
            service.core.camera_ready()
        else:
            await loop.run_in_executor(None, bus_watcher.warm_up)

    # Held in a variable because asyncio keeps only a weak reference to a task: an unreferenced one
    # can be garbage-collected halfway.
    camera_task = asyncio.create_task(_bring_camera_up(), name="camera-start") if wants_camera else None
    if camera_task is not None:
        # An exception here used to stay inside the task: the board advertised and served forever
        # with a camera that never came up, and not one line in the journal said why (2026-10-06).
        camera_task.add_done_callback(_log_task_failure)

    # The AP stays on while the device is powered (ADR 0003, 2026-09-07 update): the phone joins when
    # it connects over BLE and the photo is available the instant a mode is activated. With no time
    # cap: the user configures nothing and cannot "reactivate" it. It costs battery; that is measured.
    # `--no-ap` is for developing with the device on the home network (with the AP up the device leaves
    # any other network and SSH is lost).
    if not args.no_ap:
        # At startup NetworkManager may not be ready yet (on 2026-09-07 the device was left "with no
        # network" after the first boot with the AP): it is retried with growing backoff and it is
        # verified that the interface has the AP's IP, not just that nmcli returned. And since the
        # daemon stopped waiting for NetworkManager to start (2026-10-06), it first waits for NM to
        # answer, polling, so the first attempt is not wasted on "NetworkManager is not running".
        if not await loop.run_in_executor(None, ap.wait_for_network_manager):
            log.warning("NetworkManager did not answer in 30 s; trying the AP anyway")
        for attempt, wait in enumerate((0, 5, 10, 20, 30), start=1):
            if wait:
                # Interruptible: the signal handlers are installed before this, and a stop must not
                # sit through 65 s of retries until systemd gives up and kills the process.
                try:
                    await asyncio.wait_for(stop.wait(), wait)
                except asyncio.TimeoutError:
                    pass
            if stop.is_set():
                break
            try:
                await loop.run_in_executor(None, ap.turn_on)
                # `ip` is a subprocess: off the loop, like every other network lookup.
                if await loop.run_in_executor(None, local_ip) == AP_IP:
                    break
                log.warning("AP up but wlan0 does not have %s (attempt %d)", AP_IP, attempt)
            except Exception as exc:  # noqa: BLE001
                log.error("could not bring the AP up (attempt %d): %s", attempt, exc)
        else:
            log.error("the AP did not end up operational after several attempts; carrying on without it")
        # Pushed now and not on the next 15 s heartbeat: a phone that connected before the AP was up
        # learns the address to join the instant there is one.
        await loop.run_in_executor(None, lambda: network.refresh(wait_s=AP_REFRESH_WAIT_S))
        service.notify_status()

    no_network_since = None
    heartbeats = 0
    while not stop.is_set():
        try:
            await asyncio.wait_for(stop.wait(), STATUS_EVERY_SECONDS)
        except asyncio.TimeoutError:
            # Not awaited (2026-10-06): `nmcli` can take its whole 30 s timeout, and awaiting it held
            # the status push and the SIGTERM check that long. The status goes out when the refresh
            # ends; a refresh still running from the last beat makes this one return at once.
            refresh = loop.run_in_executor(None, network.refresh)
            refresh.add_done_callback(_push_status)
            # Once a minute: could a phone find this board at all right now (see `link.py`)? It is
            # the one hypothesis for "the app finds nothing" that could not be tested from the app.
            heartbeats += 1
            if heartbeats % 4 == 0:
                await report_visibility(adapter, centrals)
            # Network watchdog: if it is not an AP and it has gone more than a minute with no network,
            # ask NM to connect. A device on no network at all is useless and cannot be fixed remotely.
            if not ap.on and network.current[0] is None:
                no_network_since = no_network_since or loop.time()
                if loop.time() - no_network_since > 60:
                    log.warning("no network for %d s: reconnecting", int(loop.time() - no_network_since))
                    # Guarded: `nmcli` failing to even run (a timeout, NM restarting) raised out of
                    # the heartbeat and ended the daemon (2026-10-06). It is retried next minute.
                    try:
                        await loop.run_in_executor(None, ap.reconnect)
                    except Exception as exc:  # noqa: BLE001
                        log.error("reconnecting failed: %s", exc)
                    no_network_since = None
            else:
                no_network_since = None
    log.info("shutting down")
    logging.getLogger().removeHandler(relay)
    if button:
        button.close()
    # Silence a reading still playing: otherwise a restart of the service leaves a voice talking
    # about a product from before, with no daemon behind it.
    player.stop()
    if bus_watcher:
        bus_watcher.stop()
        bus_watcher.close()
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
