"""The BLE link seen from the board: bonding policy and what the journal says about it.

Two jobs, and both exist because of the same complaint (2026-09-13): *reconnecting takes several
pairing attempts*.

**1. The board does not bond.** ADR 0003 deliberately leaves the payload unencrypted — no
characteristic asks for authentication, so the app never needs a bond to read, write or subscribe to
anything. A bond therefore buys nothing and costs the failure mode the user reported: iOS keeps a
long-term key for the board, the board's copy and the phone's copy stop agreeing (a reflash, a
cleared `/var/lib/bluetooth`, a rotating random address that stops resolving), and from then on
every connection ends in the system alert "ViroVision wants to pair" — which the user has to accept,
sometimes more than once, before the app sees the device. With `Pairable = false` there is no key to
disagree about. `--pairable` puts the old behaviour back in one flag if the trade ever turns out
wrong.

> One-time cost on a phone that already bonded: iOS keeps its half of the key and will try to
> encrypt. *Settings → Bluetooth → ViroVision → Forget This Device*, once, and it stops.

**2. The journal says who is connected.** Until now the board logged nothing at all about centrals:
it advertised, and everything from there on was only visible from the phone. That is the wrong half
to be blind in, because the symptom we are chasing —the app scans and finds nothing— has two
completely different causes that look identical from the phone: the board is not advertising, or the
board still believes the previous connection is alive (BlueZ stops advertising while a central is
connected, and iOS does not always tear the link down when the app dies). `CentralWatcher` makes
them distinguishable with a single `journalctl`.
"""

from __future__ import annotations

import logging
from typing import Optional

from dbus_next import Message, MessageType
from dbus_next.aio import MessageBus

log = logging.getLogger(__name__)

_DEVICE_INTERFACE = "org.bluez.Device1"
_ADAPTER_INTERFACE = "org.bluez.Adapter1"
_ADVERTISING_INTERFACE = "org.bluez.LEAdvertisingManager1"
_PROPERTIES_INTERFACE = "org.freedesktop.DBus.Properties"


async def set_bonding(adapter, pairable: bool) -> None:
    """Turns bonding on or off on the adapter, and says so in the journal.

    `bluez-peripheral`'s `Adapter` wrapper only exposes `Powered` and `Alias`, so the property is
    reached through its dbus-next proxy: dbus-next generates `set_<property>` for everything on
    `org.bluez.Adapter1`. It is a private attribute of somebody else's class, which is why it is
    touched HERE and in one place only.
    """
    try:
        interface = adapter._proxy.get_interface(_ADAPTER_INTERFACE)  # noqa: SLF001 — see docstring
        await interface.set_pairable(pairable)
    except Exception as exc:  # noqa: BLE001 — an old BlueZ, a property that will not take: not fatal
        log.warning("could not set Pairable=%s: %s", pairable, exc)
        return
    if pairable:
        log.info("bonding ENABLED (--pairable): centrals may pair with this board")
    else:
        # Not a debug line: this is the setting that decides whether the user gets a pairing alert,
        # and when they report one, the first question is whether this board was actually running
        # with it off.
        log.info("bonding disabled: no central can pair (ADR 0003 does not encrypt, so none needs to)")


async def log_existing_bonds(bus: MessageBus, adapter_path: str) -> None:
    """Lists the bonds already stored for this adapter.

    They are reported and NOT deleted on purpose. Removing somebody's bond is the kind of thing that
    silently fixes the board and breaks the next person's phone, and the remedy the user needs is on
    the phone anyway (*Forget This Device*). What the journal has to answer is only: does a stale
    bond exist here, yes or no.
    """
    try:
        objects = await _managed_objects(bus)
    except Exception as exc:  # noqa: BLE001
        log.debug("could not list bonded devices: %s", exc)
        return
    bonded = [
        _address(path)
        for path, interfaces in objects.items()
        if path.startswith(adapter_path + "/") and _is_bonded(interfaces.get(_DEVICE_INTERFACE, {}))
    ]
    if bonded:
        log.warning(
            "%d device(s) still bonded to this board: %s. With bonding off they cannot re-pair; if a "
            "phone will not connect, forget the device on the PHONE (Settings > Bluetooth) or remove "
            "it here with `bluetoothctl remove <MAC>`",
            len(bonded),
            ", ".join(bonded),
        )
    else:
        log.info("no bonded devices stored")


def _is_bonded(device_properties: dict) -> bool:
    return _flag(device_properties, "Paired")


def _is_connected(device_properties: dict) -> bool:
    return _flag(device_properties, "Connected")


def _flag(device_properties: dict, name: str) -> bool:
    """Properties come off `GetManagedObjects` wrapped in dbus-next `Variant`s, never as plain
    values: `properties["Paired"]` is truthy even when the device is NOT paired."""
    value = device_properties.get(name)
    return bool(value is not None and value.value)


def _address(device_path: str) -> str:
    """`/org/bluez/hci0/dev_4A_BF_.._..` -> `4A:BF:..:..`, which is what `bluetoothctl` takes."""
    return device_path.rsplit("/", 1)[-1].removeprefix("dev_").replace("_", ":")


class CentralWatcher:
    """Who is connected to this board, kept current from BlueZ's own signals.

    It holds the set and not just a count because the address is what makes a journal line
    actionable: iOS rotates its random address, so "the same phone" across two sessions is not the
    same string, and noticing that is sometimes the answer.

    It hooks the raw `PropertiesChanged` signal rather than building a proxy per device, for that
    same reason: devices appear and disappear as the address rotates, so there is nothing stable to
    hold a proxy on, and a match rule survives all of it.
    """

    def __init__(self) -> None:
        self.connected: set[str] = set()

    async def start(self, bus: MessageBus) -> None:
        # The match rule first: without it the handler is installed and never called, which is a
        # silent no-op and the worst kind of bug to leave in a diagnostic.
        await bus.call(
            Message(
                destination="org.freedesktop.DBus",
                path="/org/freedesktop/DBus",
                interface="org.freedesktop.DBus",
                member="AddMatch",
                signature="s",
                body=[
                    "type='signal',interface='org.freedesktop.DBus.Properties',"
                    f"member='PropertiesChanged',arg0='{_DEVICE_INTERFACE}'"
                ],
            )
        )
        bus.add_message_handler(self._handle)
        # Seeded from what is connected right now: `PropertiesChanged` only fires on a CHANGE, so a
        # daemon that restarted under a live connection would otherwise believe nobody is there and
        # report the board as silently broken.
        try:
            for path, interfaces in (await _managed_objects(bus)).items():
                if _is_connected(interfaces.get(_DEVICE_INTERFACE, {})):
                    self.connected.add(_address(path))
        except Exception as exc:  # noqa: BLE001
            log.debug("could not seed the connected centrals: %s", exc)
        if self.connected:
            log.info("central already connected at startup: %s", ", ".join(sorted(self.connected)))

    def _handle(self, message: Message) -> None:
        if message.message_type is not MessageType.SIGNAL:
            return
        if message.interface != _PROPERTIES_INTERFACE or message.member != "PropertiesChanged":
            return
        body = message.body
        if len(body) < 2 or body[0] != _DEVICE_INTERFACE:
            return
        changed = body[1]
        if "Connected" not in changed:
            return
        address = _address(message.path or "")
        if changed["Connected"].value:
            self.connected.add(address)
            log.info("central connected: %s (BlueZ stops advertising while it is)", address)
        else:
            # The important half. A phone that vanished without closing the link leaves the board
            # believing it is still connected —and therefore not advertising— until the supervision
            # timeout expires, which is exactly what "it takes several tries to reconnect" looks
            # like from the app's side.
            self.connected.discard(address)
            log.info("central disconnected: %s (advertising should resume)", address)


async def report_visibility(adapter, centrals: CentralWatcher) -> None:
    """Says, on the heartbeat, whether a phone could find this board at all.

    The warning is conditioned on nobody being connected **on purpose**. BlueZ legitimately stops
    advertising while a central is connected, so warning on 0 instances alone would fire through
    every normal session — and a log that cries wolf is a log nobody reads, which would cost us
    exactly the signal this function exists to give. Zero instances with zero centrals is the real
    fault: the board is invisible, and no amount of retrying on the phone can fix it.
    """
    try:
        interface = adapter._proxy.get_interface(_ADVERTISING_INTERFACE)  # noqa: SLF001 — as in `set_bonding`
        instances = int(await interface.get_active_instances())
    except Exception:  # noqa: BLE001 — a BlueZ that will not answer is not worth taking the daemon down for
        return
    if instances == 0 and not centrals.connected:
        log.warning("NOT advertising and no central connected: no phone can find this board")
    else:
        log.debug("advertising instances: %d, centrals: %d", instances, len(centrals.connected))


async def _managed_objects(bus: MessageBus) -> dict:
    introspection = await bus.introspect("org.bluez", "/")
    proxy = bus.get_proxy_object("org.bluez", "/", introspection)
    manager = proxy.get_interface("org.freedesktop.DBus.ObjectManager")
    return await manager.call_get_managed_objects()
