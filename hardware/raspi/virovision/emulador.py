"""Emulador de la placa en una Mac: el mismo núcleo, publicado por CoreBluetooth con `bless`.

Sirve para probar la app contra el perfil GATT real sin tener la placa alimentada: conexión, modos,
eventos, y el reensamblado de una transferencia. **El throughput que se mide contra la Mac no es el
de la placa** (otro chip, Bluetooth 5, otro stack); vale para validar la app, no para decidir el ADR
0003. Correr con:

    python3 -m virovision.emulador            # anuncia «ViroVision»
    python3 -m virovision.emulador --nombre ViroVision-Mac

macOS pide permiso de Bluetooth para la terminal la primera vez (Privacidad y seguridad → Bluetooth).
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import signal
import sys
from functools import partial
from typing import Any

from .camara import payload_sintetico
from .estado import leer_estado
from .http_servidor import PUERTO_POR_DEFECTO, ServidorHttp
from .perfil import (
    CH_CONTROL,
    CH_ESTADO,
    CH_EVENTO,
    CH_MODO,
    CH_TRANSFERENCIA,
    NOMBRE_ANUNCIADO,
    SERVICE_UUID,
    UUID_POR_NOMBRE,
)
from .nucleo import Nucleo

log = logging.getLogger("virovision.emulador")

ESTADO_CADA_SEGUNDOS = 15
# Si CoreBluetooth no acepta una notificación en este tiempo, no hay nadie escuchando o la conexión
# murió; se corta en vez de esperar para siempre.
ESPERA_MAX_NOTIFICACION_S = 5.0


def _argumentos() -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="virovision.emulador", description="Emula la placa ViroVision desde la Mac")
    parser.add_argument("--nombre", default=NOMBRE_ANUNCIADO, help="nombre BLE anunciado")
    parser.add_argument("--puerto", type=int, default=PUERTO_POR_DEFECTO, help="puerto del servidor HTTP (plan B)")
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args()


async def _main(args: argparse.Namespace) -> None:
    from bless import BlessServer, GATTAttributePermissions as Perms, GATTCharacteristicProperties as Props

    loop = asyncio.get_running_loop()
    server = BlessServer(name=args.nombre, loop=loop)

    async def notificar(nombre: str, valor: bytes) -> None:
        uuid = UUID_POR_NOMBRE[nombre]
        server.get_characteristic(uuid).value = bytearray(valor)
        # `update_value` devuelve False cuando la cola de transmisión de CoreBluetooth está llena: es
        # el control de flujo. Se reintenta con una pausa mínima, que además da un ritmo realista.
        limite = loop.time() + ESPERA_MAX_NOTIFICACION_S
        while not server.update_value(SERVICE_UUID, uuid):
            if loop.time() > limite:
                log.warning("CoreBluetooth no aceptó la notificación de %s en %.0f s", nombre, ESPERA_MAX_NOTIFICACION_S)
                return
            await asyncio.sleep(0.002)

    http = ServidorHttp(
        leer_estado=lambda: leer_estado(camara=False, puerto_http=args.puerto),
        payload_sintetico=payload_sintetico,
        capturar=None,
        puerto=args.puerto,
    )
    http.iniciar()

    nucleo = Nucleo(
        loop=loop,
        leer_estado=partial(leer_estado, camara=False, puerto_http=args.puerto),
        capturar=None,
        payload_sintetico=payload_sintetico,
        notificar=notificar,
    )

    # Los callbacks de bless llegan desde el hilo de CoreBluetooth: las lecturas son sincrónicas y
    # devuelven bytes; las escrituras se pasan al loop de asyncio con `call_soon_threadsafe`.
    def al_leer(caracteristica: Any, **_: Any) -> bytearray:
        uuid = str(caracteristica.uuid).lower()
        if uuid == CH_MODO:
            return bytearray(nucleo.leer_modo())
        if uuid == CH_ESTADO:
            return bytearray(nucleo.leer_estado())
        return bytearray(caracteristica.value or b"")

    def al_escribir(caracteristica: Any, valor: Any, **_: Any) -> None:
        uuid = str(caracteristica.uuid).lower()
        datos = bytes(valor)
        if uuid == CH_CONTROL:
            loop.call_soon_threadsafe(nucleo.escribir_control, datos, 0)
        elif uuid == CH_MODO:
            loop.call_soon_threadsafe(nucleo.escribir_modo, datos)

    server.read_request_func = al_leer
    server.write_request_func = al_escribir

    await server.add_new_service(SERVICE_UUID)
    # Siempre `value=None`: CoreBluetooth sólo admite un valor en caché en características de sólo
    # lectura ("Characteristics with cached values must be read-only"); todo lo demás se sirve desde
    # `al_leer` o por notificación.
    await server.add_new_characteristic(SERVICE_UUID, CH_MODO, Props.read | Props.notify | Props.write, None, Perms.readable | Perms.writeable)
    await server.add_new_characteristic(SERVICE_UUID, CH_CONTROL, Props.write | Props.write_without_response, None, Perms.writeable)
    await server.add_new_characteristic(SERVICE_UUID, CH_EVENTO, Props.notify, None, Perms.readable)
    await server.add_new_characteristic(SERVICE_UUID, CH_TRANSFERENCIA, Props.notify, None, Perms.readable)
    await server.add_new_characteristic(SERVICE_UUID, CH_ESTADO, Props.read | Props.notify, None, Perms.readable)

    # prioritize_local_name=False: la app escanea por el UUID del servicio, así que tiene que ir en el
    # paquete de anuncio aunque el nombre se recorte.
    await server.start(prioritize_local_name=False)
    log.info("emulando la placa como «%s», servicio %s. Ctrl-C para parar.", args.nombre, SERVICE_UUID)

    parar = asyncio.Event()
    for senal in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(senal, parar.set)
    while not parar.is_set():
        try:
            await asyncio.wait_for(parar.wait(), ESTADO_CADA_SEGUNDOS)
        except asyncio.TimeoutError:
            nucleo.notificar_estado()
    log.info("apagando")
    http.parar()
    await server.stop()


def main() -> None:
    if sys.platform != "darwin":
        raise SystemExit("el emulador es para macOS; en la placa corre `python -m virovision`")
    args = _argumentos()
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    asyncio.run(_main(args))


if __name__ == "__main__":
    main()
