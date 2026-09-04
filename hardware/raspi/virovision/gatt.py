"""Adaptador del núcleo a BlueZ (`bluez_peripheral`): lo que corre en la placa.

Los UUIDs viven en `perfil.py` (compartidos con el emulador de la Mac y copiados a mano en la app);
la lógica de comandos, modos y transferencias en `nucleo.py`. Acá sólo se conectan las dos cosas a
las características de BlueZ.
"""

from __future__ import annotations

import asyncio
from typing import Callable, Optional

from bluez_peripheral.gatt.characteristic import CharacteristicFlags as Flags
from bluez_peripheral.gatt.characteristic import characteristic
from bluez_peripheral.gatt.service import Service

from .nucleo import ESTADO, EVENTO, MODO, TRANSFERENCIA, Capturar, Nucleo
from .perfil import (  # noqa: F401  (re-exportados para __main__)
    CH_CONTROL,
    CH_ESTADO,
    CH_EVENTO,
    CH_MODO,
    CH_TRANSFERENCIA,
    NOMBRE_ANUNCIADO,
    SERVICE_UUID,
)


class ViroVisionService(Service):
    """Un servicio, cinco características. Los getters/setters son sincrónicos porque así los llama
    BlueZ; el trabajo largo lo despacha el núcleo como tareas asyncio."""

    def __init__(
        self,
        loop: asyncio.AbstractEventLoop,
        leer_estado: Callable[[], dict],
        capturar: Optional[Capturar],
        payload_sintetico: Callable[[int], bytes],
    ) -> None:
        super().__init__(SERVICE_UUID, True)
        self.nucleo = Nucleo(loop, leer_estado, capturar, payload_sintetico, self._notificar)

    async def _notificar(self, nombre: str, valor: bytes) -> None:
        caracteristica = {MODO: self.modo, EVENTO: self.evento, TRANSFERENCIA: self.transferencia, ESTADO: self.estado}[nombre]
        caracteristica.changed(valor)
        # `changed` sólo encola el mensaje D-Bus: sin ceder el loop, dbus-next no escribe nada al
        # socket hasta que terminamos, y BlueZ recibiría los 300 chunks de golpe.
        await asyncio.sleep(0)

    @characteristic(CH_MODO, Flags.READ | Flags.NOTIFY | Flags.WRITE)
    def modo(self, options):
        return self.nucleo.leer_modo()

    @modo.setter
    def modo(self, value, options):
        self.nucleo.escribir_modo(bytes(value))

    @characteristic(CH_CONTROL, Flags.WRITE | Flags.WRITE_WITHOUT_RESPONSE)
    def control(self, options):
        pass  # sólo escritura

    @control.setter
    def control(self, value, options):
        # BlueZ nos pasa el MTU negociado con este central en las opciones de escritura.
        self.nucleo.escribir_control(bytes(value), options.mtu or 0)

    @characteristic(CH_EVENTO, Flags.NOTIFY)
    def evento(self, options):
        return b""

    @characteristic(CH_TRANSFERENCIA, Flags.NOTIFY)
    def transferencia(self, options):
        return b""

    @characteristic(CH_ESTADO, Flags.READ | Flags.NOTIFY)
    def estado(self, options):
        return self.nucleo.leer_estado()

    def notificar_estado(self) -> None:
        self.nucleo.notificar_estado()
