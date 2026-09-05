"""Punto de entrada: `python -m virovision [--sin-camara] [--nombre ViroVision] [-v]`.

Arranca BlueZ como periférico (agente sin IO, servicio GATT, anuncio) y se queda corriendo. Lo
lanza systemd (`virovision.service`); a mano sirve para depurar con `-v`.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import signal

from bluez_peripheral.advert import Advertisement
from bluez_peripheral.agent import NoIoAgent
from bluez_peripheral.util import Adapter, get_message_bus, is_bluez_available

from .ap import PuntoDeAcceso
from .camara import Camara, payload_sintetico
from .estado import leer_estado
from .http_servidor import PUERTO_POR_DEFECTO, ServidorHttp
from .gatt import NOMBRE_ANUNCIADO, SERVICE_UUID, ViroVisionService

log = logging.getLogger("virovision")

ESTADO_CADA_SEGUNDOS = 15


def _argumentos() -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="virovision", description="Daemon BLE de la placa ViroVision")
    parser.add_argument("--sin-camara", action="store_true", help="no intentar abrir la cámara (sólo medir)")
    parser.add_argument("--nombre", default=NOMBRE_ANUNCIADO, help="nombre BLE anunciado")
    parser.add_argument("--hci", default="hci0", help="adaptador Bluetooth (default hci0)")
    parser.add_argument("--puerto", type=int, default=PUERTO_POR_DEFECTO, help="puerto del servidor HTTP (plan B)")
    parser.add_argument("--sin-http", action="store_true", help="no levantar el servidor HTTP")
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args()


async def _obtener_adaptador(bus, hci: str) -> Adapter:
    """`Adapter.get_first` de bluez-peripheral 0.1.7 recorre todos los hijos de /org/bluez y asume
    que cada uno es un adaptador; BlueZ 5.82 (Trixie) expone además `/org/bluez/test`, sin
    `Adapter1`, y la librería explota con InterfaceNotFoundError. Se construye el adaptador a mano
    desde su ruta."""
    ruta = f"/org/bluez/{hci}"
    introspeccion = await bus.introspect("org.bluez", ruta)
    return Adapter(bus.get_proxy_object("org.bluez", ruta, introspeccion))


async def _main(args: argparse.Namespace) -> None:
    loop = asyncio.get_running_loop()

    camara = Camara()
    hay_camara = False if args.sin_camara else camara.iniciar()
    capturar = (lambda: loop.run_in_executor(None, camara.capturar_jpeg)) if hay_camara else None

    # El servidor HTTP (plan B del ADR 0003) corre en su hilo; su puerto viaja por `estado` para que
    # la app sepa de dónde bajar la foto. La captura es la misma función bloqueante que usa el BLE.
    ap = PuntoDeAcceso()

    def control_ap(encender: bool) -> None:
        ap.encender() if encender else ap.apagar()

    http = None
    if not args.sin_http:
        http = ServidorHttp(
            # `camara.disponible` y no `hay_camara`: si una captura se cuelga la cámara se reinicia, y
            # si no vuelve, el estado tiene que decirlo.
            leer_estado=lambda: leer_estado(camara=camara.disponible, puerto_http=args.puerto, ap=ap.encendido),
            payload_sintetico=payload_sintetico,
            capturar=camara.capturar_jpeg if hay_camara else None,
            puerto=args.puerto,
        )
        http.iniciar()

    bus = await get_message_bus()
    if not await is_bluez_available(bus):
        raise SystemExit("BlueZ no está disponible en D-Bus: ¿está corriendo bluetooth.service?")

    adaptador = await _obtener_adaptador(bus, args.hci)

    servicio = ViroVisionService(
        loop=loop,
        leer_estado=lambda: leer_estado(camara=camara.disponible, puerto_http=args.puerto if http else None, ap=ap.encendido),
        capturar=capturar,
        payload_sintetico=payload_sintetico,
        control_ap=control_ap,
        leer_wifi=lambda: {**ap.credenciales(), "puerto": args.puerto if http else None},
    )
    await servicio.register(bus, adapter=adaptador)

    # Sin agente, BlueZ rechaza cualquier intento de emparejar. NoIo = "just works", sin PIN: el
    # usuario no puede leer un PIN en la placa, y ADR 0003 no cifra el payload a propósito.
    agente = NoIoAgent()
    await agente.register(bus)

    await adaptador.set_powered(True)
    await adaptador.set_alias(args.nombre)

    # timeout 0 = anunciar hasta que el proceso muera; el dispositivo tiene que ser encontrable
    # siempre, porque la app reconecta sola cuando vuelve al alcance.
    anuncio = Advertisement(args.nombre, [SERVICE_UUID], 0x0000, 0)
    await anuncio.register(bus, adaptador)
    log.info("anunciando «%s» con servicio %s (cámara: %s)", args.nombre, SERVICE_UUID, "sí" if hay_camara else "no")

    parar = asyncio.Event()
    for senal in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(senal, parar.set)

    while not parar.is_set():
        try:
            await asyncio.wait_for(parar.wait(), ESTADO_CADA_SEGUNDOS)
        except asyncio.TimeoutError:
            servicio.notificar_estado()
    log.info("apagando")
    if http:
        http.parar()
    bus.disconnect()


def main() -> None:
    args = _argumentos()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(_main(args))


if __name__ == "__main__":
    main()
