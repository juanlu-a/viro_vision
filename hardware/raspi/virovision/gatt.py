"""Perfil GATT del dispositivo ViroVision y su adaptador a BlueZ (la placa).

FUENTE DE VERDAD COMPARTIDA con la app: `app/src/features/device/gatt.ts` tiene estos mismos UUIDs
copiados a mano. Si cambia algo acá, cambia allá en el mismo PR. Los UUIDs son de 128 bits generados
al azar (`uuidgen`), con el 3.er y 4.º byte como índice de característica; el rango 0000xxxx-0000-
1000-8000-00805f9b34fb que usaban los placeholders es el de los UUIDs de 16 bits asignados por el
Bluetooth SIG y no se puede inventar ahí.

La lógica (comandos, modos, transferencias) vive en `nucleo.py`; acá sólo se la conecta a
`bluez_peripheral`. El emulador de la Mac (`emulador.py`) conecta el mismo núcleo a CoreBluetooth.
"""

from __future__ import annotations

import asyncio
from typing import Callable, Optional

from bluez_peripheral.gatt.characteristic import CharacteristicFlags as Flags
from bluez_peripheral.gatt.characteristic import characteristic
from bluez_peripheral.gatt.service import Service

from .nucleo import ESTADO, EVENTO, MODO, TRANSFERENCIA, Capturar, Nucleo

SERVICE_UUID = "4380c500-7ca3-4e37-b27d-f60e8d8d73d1"
CH_MODO = "4380c501-7ca3-4e37-b27d-f60e8d8d73d1"
CH_CONTROL = "4380c502-7ca3-4e37-b27d-f60e8d8d73d1"
CH_EVENTO = "4380c503-7ca3-4e37-b27d-f60e8d8d73d1"
CH_TRANSFERENCIA = "4380c504-7ca3-4e37-b27d-f60e8d8d73d1"
CH_ESTADO = "4380c505-7ca3-4e37-b27d-f60e8d8d73d1"

UUID_POR_NOMBRE = {MODO: CH_MODO, EVENTO: CH_EVENTO, TRANSFERENCIA: CH_TRANSFERENCIA, ESTADO: CH_ESTADO}

NOMBRE_ANUNCIADO = "ViroVision"


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
