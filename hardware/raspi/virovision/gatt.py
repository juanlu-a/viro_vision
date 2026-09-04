"""Perfil GATT del dispositivo ViroVision (servidor BLE sobre BlueZ, vía D-Bus).

FUENTE DE VERDAD COMPARTIDA con la app: `app/src/features/device/gatt.ts` tiene estos mismos UUIDs
copiados a mano. Si cambia algo acá, cambia allá en el mismo PR. Los UUIDs son de 128 bits generados
al azar (`uuidgen`), con el 3.er y 4.º byte como índice de característica; el rango 0000xxxx-0000-
1000-8000-00805f9b34fb que usaban los placeholders es el de los UUIDs de 16 bits asignados por el
Bluetooth SIG y no se puede inventar ahí.

Qué viaja por dónde (ADR 0003): BLE es el plano de control, siempre vivo — es lo único que puede
despertar a la app con el teléfono bloqueado en el bolsillo. Si la foto también viaja por acá, o por
WiFi, lo decide la medición que hace el comando `medir`.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Awaitable, Callable, Optional

from bluez_peripheral.gatt.characteristic import CharacteristicFlags as Flags
from bluez_peripheral.gatt.characteristic import characteristic
from bluez_peripheral.gatt.service import Service

from .modos import MaquinaDeModos, Modo
from .transferencia import ChunkInvalidoError, partir

log = logging.getLogger(__name__)

SERVICE_UUID = "4380c500-7ca3-4e37-b27d-f60e8d8d73d1"
CH_MODO = "4380c501-7ca3-4e37-b27d-f60e8d8d73d1"
CH_CONTROL = "4380c502-7ca3-4e37-b27d-f60e8d8d73d1"
CH_EVENTO = "4380c503-7ca3-4e37-b27d-f60e8d8d73d1"
CH_TRANSFERENCIA = "4380c504-7ca3-4e37-b27d-f60e8d8d73d1"
CH_ESTADO = "4380c505-7ca3-4e37-b27d-f60e8d8d73d1"

NOMBRE_ANUNCIADO = "ViroVision"

# iOS negocia ATT MTU 185 → 182 bytes de notificación. Es el default cuando BlueZ no nos dice el MTU.
CHUNK_POR_DEFECTO = 182
BYTES_POR_DEFECTO = 53_000  # la foto de 1024 px que la app manda hoy a la nube
# Un evento entero tiene que entrar en una notificación con el MTU de iOS, sin partir.
EVENTO_MAX_BYTES = 180

Capturar = Callable[[], Awaitable[bytes]]


def _json(obj: dict) -> bytes:
    datos = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode()
    if len(datos) > EVENTO_MAX_BYTES:
        raise ValueError(f"evento de {len(datos)} bytes no entra en una notificación")
    return datos


class ViroVisionService(Service):
    """Un servicio, cinco características. Los getters/setters son sincrónicos porque así los llama
    BlueZ; el trabajo largo (transferir, capturar) se despacha como tarea asyncio."""

    def __init__(
        self,
        loop: asyncio.AbstractEventLoop,
        leer_estado: Callable[[], dict],
        capturar: Optional[Capturar],
        payload_sintetico: Callable[[int], bytes],
    ) -> None:
        super().__init__(SERVICE_UUID, True)
        self._loop = loop
        self._leer_estado = leer_estado
        self._capturar = capturar
        self._payload_sintetico = payload_sintetico
        self._modos = MaquinaDeModos()
        self._transferencia_id = 0
        self._transferencia_en_curso: Optional[asyncio.Task] = None

    # --- modo -------------------------------------------------------------------------------

    @characteristic(CH_MODO, Flags.READ | Flags.NOTIFY | Flags.WRITE)
    def modo(self, options):
        return bytes([int(self._modos.actual)])

    @modo.setter
    def modo(self, value, options):
        self._cambiar_modo(int(value[0]) if value else 0)

    def _cambiar_modo(self, valor: int) -> None:
        try:
            nuevo = Modo(valor)
        except ValueError:
            self._evento({"t": "error", "msg": f"modo {valor} no existe"})
            return
        if self._modos.cambiar(nuevo):
            log.info("modo → %s", nuevo.name)
            # La transición se anuncia también por audio en la placa cuando haya parlante; hoy sólo
            # se notifica a la app.
            self.modo.changed(bytes([int(nuevo)]))
            self._evento({"t": "modo", "valor": int(nuevo)})

    # --- control ------------------------------------------------------------------------------

    @characteristic(CH_CONTROL, Flags.WRITE | Flags.WRITE_WITHOUT_RESPONSE)
    def control(self, options):
        pass  # sólo escritura

    @control.setter
    def control(self, value, options):
        try:
            cmd = json.loads(bytes(value).decode())
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            self._evento({"t": "error", "msg": f"comando ilegible: {exc}"[:150]})
            return
        # BlueZ nos pasa el MTU negociado con este central en las opciones de escritura; es el dato
        # que la app no puede saber del lado nuestro, así que lo tomamos de acá si no lo mandó.
        mtu = options.mtu or 0
        log.info("control ← %s (mtu %s)", cmd, mtu or "?")
        nombre = cmd.get("cmd")
        if nombre == "medir":
            self._lanzar_transferencia(
                fuente=self._fuente_sintetica(int(cmd.get("bytes", BYTES_POR_DEFECTO))),
                chunk=self._chunk(cmd, mtu),
                intervalo_ms=int(cmd.get("intervalo_ms", 0)),
                tipo="medicion",
            )
        elif nombre == "foto":
            if self._capturar is None:
                self._evento({"t": "error", "msg": "sin cámara: usá medir"})
                return
            self._lanzar_transferencia(
                fuente=self._capturar(),
                chunk=self._chunk(cmd, mtu),
                intervalo_ms=int(cmd.get("intervalo_ms", 0)),
                tipo="foto",
            )
        elif nombre == "modo":
            self._cambiar_modo(int(cmd.get("valor", 0)))
        elif nombre == "estado":
            self.estado.changed(_json(self._leer_estado()))
        else:
            self._evento({"t": "error", "msg": f"comando desconocido: {nombre}"[:150]})

    @staticmethod
    def _chunk(cmd: dict, mtu: int) -> int:
        pedido = int(cmd.get("chunk", 0)) or (mtu - 3 if mtu else CHUNK_POR_DEFECTO)
        # Nunca más grande que lo que el enlace acepta: BlueZ partiría o descartaría la notificación
        # y el receptor vería chunks rotos sin ningún error de este lado.
        return min(pedido, mtu - 3) if mtu else pedido

    async def _fuente_sintetica(self, cantidad: int) -> bytes:
        return self._payload_sintetico(cantidad)

    # --- evento / transferencia -------------------------------------------------------------

    @characteristic(CH_EVENTO, Flags.NOTIFY)
    def evento(self, options):
        return b""

    @characteristic(CH_TRANSFERENCIA, Flags.NOTIFY)
    def transferencia(self, options):
        return b""

    def _evento(self, obj: dict) -> None:
        self.evento.changed(_json(obj))

    def _lanzar_transferencia(self, fuente: Awaitable[bytes], chunk: int, intervalo_ms: int, tipo: str) -> None:
        if self._transferencia_en_curso and not self._transferencia_en_curso.done():
            self._evento({"t": "error", "msg": "ya hay una transferencia en curso"})
            if hasattr(fuente, "close"):
                fuente.close()  # cerrar la corrutina que no vamos a esperar, o Python avisa al recolectarla
            return
        self._transferencia_id += 1
        self._transferencia_en_curso = self._loop.create_task(
            self._transferir(self._transferencia_id, fuente, chunk, intervalo_ms, tipo)
        )

    async def _transferir(self, id_: int, fuente: Awaitable[bytes], chunk: int, intervalo_ms: int, tipo: str) -> None:
        try:
            payload = await fuente
            chunks = partir(payload, chunk)
        except ChunkInvalidoError as exc:
            self._evento({"t": "error", "msg": str(exc)[:150]})
            return
        except Exception as exc:
            log.exception("no pude preparar la transferencia")
            self._evento({"t": "error", "msg": f"{tipo}: {exc}"[:150]})
            return

        self._evento({"t": "inicio", "id": id_, "tipo": tipo, "bytes": len(payload), "chunks": len(chunks), "chunk": chunk})
        t0 = time.monotonic()
        for c in chunks:
            self.transferencia.changed(c)
            # `changed` sólo encola el mensaje D-Bus: sin ceder el loop, dbus-next no escribe nada al
            # socket hasta que terminamos, y BlueZ recibiría los 300 chunks de golpe.
            await asyncio.sleep(intervalo_ms / 1000 if intervalo_ms else 0)
        ms = int((time.monotonic() - t0) * 1000)
        # `ms` es cuánto tardó la placa en ENTREGARLE los chunks a BlueZ, no cuánto tardaron en llegar
        # al teléfono: el número que vale es el que mide la app. Si difieren mucho, el cuello es D-Bus
        # (ver README: AcquireNotify).
        self._evento({"t": "fin", "id": id_, "bytes": len(payload), "chunks": len(chunks), "ms_placa": ms})
        log.info("transferencia %d (%s): %d bytes en %d chunks, %d ms del lado de la placa", id_, tipo, len(payload), len(chunks), ms)

    # --- estado -----------------------------------------------------------------------------

    @characteristic(CH_ESTADO, Flags.READ | Flags.NOTIFY)
    def estado(self, options):
        return _json(self._leer_estado())

    def notificar_estado(self) -> None:
        self.estado.changed(_json(self._leer_estado()))
