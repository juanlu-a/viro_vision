"""Núcleo del dispositivo, independiente del transporte BLE.

Acá viven los comandos, la máquina de modos y las transferencias; lo que cambia entre la placa
(BlueZ por D-Bus, `gatt.py`) y el emulador en la Mac (CoreBluetooth, `emulador.py`) es sólo cómo se
publica una notificación, y eso entra por `notificar`. Así el emulador ejecuta exactamente el código
que va a correr en la placa, y lo que se testea en la Mac es lo que se despliega.

Qué viaja por dónde (ADR 0003): BLE es el plano de control, siempre vivo. Si la foto también viaja
por acá, o por WiFi, lo decide la medición que hace el comando `medir`.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Awaitable, Callable, Optional

from .modos import MaquinaDeModos, Modo
from .transferencia import ChunkInvalidoError, partir

log = logging.getLogger(__name__)

# iOS negocia ATT MTU 185 → 182 bytes de notificación. Es el default cuando el transporte no nos dice
# el MTU y la app tampoco lo mandó.
CHUNK_POR_DEFECTO = 182
BYTES_POR_DEFECTO = 53_000  # la foto de 1024 px que la app manda hoy a la nube
# Un evento entero tiene que entrar en una notificación con el MTU de iOS, sin partir.
EVENTO_MAX_BYTES = 180

# Nombres lógicos de las características notificables; el transporte los mapea a sus UUIDs.
MODO = "modo"
EVENTO = "evento"
TRANSFERENCIA = "transferencia"
ESTADO = "estado"

Capturar = Callable[[], Awaitable[bytes]]
Notificar = Callable[[str, bytes], Awaitable[None]]
# Encender/apagar el AP WiFi; None cuando el transporte no lo ofrece (el emulador de la Mac).
ControlAp = Callable[[bool], None]
AP_MINUTOS_POR_DEFECTO = 10
AP_MINUTOS_MAX = 60


def _json(obj: dict) -> bytes:
    datos = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode()
    if len(datos) > EVENTO_MAX_BYTES:
        raise ValueError(f"evento de {len(datos)} bytes no entra en una notificación")
    return datos


class Nucleo:
    def __init__(
        self,
        loop: asyncio.AbstractEventLoop,
        leer_estado: Callable[[], dict],
        capturar: Optional[Capturar],
        payload_sintetico: Callable[[int], bytes],
        notificar: Notificar,
        control_ap: Optional[ControlAp] = None,
    ) -> None:
        self._loop = loop
        self._leer_estado = leer_estado
        self._capturar = capturar
        self._payload_sintetico = payload_sintetico
        self._notificar = notificar
        self._control_ap = control_ap
        self._apagado_ap: Optional[asyncio.TimerHandle] = None
        self.modos = MaquinaDeModos()
        self._transferencia_id = 0
        self._transferencia_en_curso: Optional[asyncio.Task] = None

    # --- lecturas (sincrónicas: así las piden BlueZ y CoreBluetooth) ------------------------

    def leer_modo(self) -> bytes:
        return bytes([int(self.modos.actual)])

    def leer_estado(self) -> bytes:
        return _json(self._leer_estado())

    # --- escrituras -------------------------------------------------------------------------

    def escribir_modo(self, valor: bytes) -> None:
        self._cambiar_modo(int(valor[0]) if valor else 0)

    def escribir_control(self, valor: bytes, mtu: int = 0) -> None:
        """`mtu` es el negociado con este central si el transporte lo conoce (BlueZ lo pasa en la
        escritura); es el dato que la app no puede saber de nuestro lado."""
        try:
            cmd = json.loads(bytes(valor).decode())
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            self._evento({"t": "error", "msg": f"comando ilegible: {exc}"[:150]})
            return
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
            self._programar(self._notificar(ESTADO, self.leer_estado()))
        elif nombre == "ap":
            self._ap(bool(cmd.get("valor", True)), int(cmd.get("minutos", AP_MINUTOS_POR_DEFECTO)))
        else:
            self._evento({"t": "error", "msg": f"comando desconocido: {nombre}"[:150]})

    def _ap(self, encender: bool, minutos: int) -> None:
        """Plan B del ADR 0003. El AP siempre se enciende por tiempo acotado: la placa tiene una sola
        radio y con el AP arriba pierde su red (y el SSH); si la app no lo apaga, se apaga solo."""
        if self._control_ap is None:
            self._evento({"t": "error", "msg": "este dispositivo no maneja el AP"})
            return
        if self._apagado_ap:
            self._apagado_ap.cancel()
            self._apagado_ap = None
        try:
            self._control_ap(encender)
        except Exception as exc:
            self._evento({"t": "error", "msg": f"ap: {exc}"[:150]})
            return
        if encender:
            minutos = max(1, min(minutos, AP_MINUTOS_MAX))
            self._apagado_ap = self._loop.call_later(minutos * 60, self._ap, False, 0)
        # El evento sale antes de que se caiga el enlace WiFi (BLE no se toca), así la app sabe qué pasó.
        self._evento({"t": "ap", "encendido": encender, "minutos": minutos if encender else 0})
        self._programar(self._notificar(ESTADO, self.leer_estado()))

    def notificar_estado(self) -> None:
        self._programar(self._notificar(ESTADO, self.leer_estado()))

    # --- internos ---------------------------------------------------------------------------

    def _programar(self, corrutina: Awaitable[None]) -> asyncio.Task:
        return self._loop.create_task(corrutina)

    def _evento(self, obj: dict) -> None:
        self._programar(self._notificar(EVENTO, _json(obj)))

    def _cambiar_modo(self, valor: int) -> None:
        try:
            nuevo = Modo(valor)
        except ValueError:
            self._evento({"t": "error", "msg": f"modo {valor} no existe"})
            return
        if self.modos.cambiar(nuevo):
            log.info("modo → %s", nuevo.name)
            # La transición se anuncia también por audio en la placa cuando haya parlante; hoy sólo
            # se notifica a la app.
            self._programar(self._notificar(MODO, self.leer_modo()))
            self._evento({"t": "modo", "valor": int(nuevo)})

    @staticmethod
    def _chunk(cmd: dict, mtu: int) -> int:
        pedido = int(cmd.get("chunk", 0)) or (mtu - 3 if mtu else CHUNK_POR_DEFECTO)
        # Nunca más grande que lo que el enlace acepta: el transporte partiría o descartaría la
        # notificación y el receptor vería chunks rotos sin ningún error de este lado.
        return min(pedido, mtu - 3) if mtu else pedido

    async def _fuente_sintetica(self, cantidad: int) -> bytes:
        return self._payload_sintetico(cantidad)

    def _lanzar_transferencia(self, fuente: Awaitable[bytes], chunk: int, intervalo_ms: int, tipo: str) -> None:
        if self._transferencia_en_curso and not self._transferencia_en_curso.done():
            self._evento({"t": "error", "msg": "ya hay una transferencia en curso"})
            if hasattr(fuente, "close"):
                fuente.close()  # cerrar la corrutina que no vamos a esperar, o Python avisa al recolectarla
            return
        self._transferencia_id += 1
        self._transferencia_en_curso = self._programar(
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

        await self._notificar(EVENTO, _json({"t": "inicio", "id": id_, "tipo": tipo, "bytes": len(payload), "chunks": len(chunks), "chunk": chunk}))
        t0 = time.monotonic()
        for c in chunks:
            await self._notificar(TRANSFERENCIA, c)
            if intervalo_ms:
                await asyncio.sleep(intervalo_ms / 1000)
        ms = int((time.monotonic() - t0) * 1000)
        # `ms_placa` es cuánto tardó este lado en ENTREGAR los chunks al stack Bluetooth, no cuánto
        # tardaron en llegar al teléfono: el número que vale es el que mide la app. Si difieren mucho,
        # el cuello es el camino hacia el stack (en BlueZ, D-Bus; ver README).
        await self._notificar(EVENTO, _json({"t": "fin", "id": id_, "bytes": len(payload), "chunks": len(chunks), "ms_placa": ms}))
        log.info("transferencia %d (%s): %d bytes en %d chunks, %d ms de este lado", id_, tipo, len(payload), len(chunks), ms)
