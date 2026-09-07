"""Existe porque el adaptador BlueZ sólo se ejecuta en la placa: el 2026-09-05 un argumento nuevo del
núcleo (`control_ap`) no se propagó al adaptador y el servicio entró en un bucle de reinicios que
ningún test de la Mac vio. Corre sólo donde está `bluez_peripheral` (la placa, o un venv que lo
tenga); en el resto se salta, no falla."""

import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

pytest.importorskip("bluez_peripheral")

from virovision.gatt import ViroVisionService  # noqa: E402


def test_el_adaptador_bluez_construye_con_todos_los_argumentos_del_nucleo():
    loop = asyncio.new_event_loop()
    try:
        servicio = ViroVisionService(
            loop=loop,
            leer_estado=lambda: {"version": "t"},
            capturar=None,
            payload_sintetico=bytes,
            control_ap=lambda encender: None,
        )
        assert len(servicio._characteristics) == 6
        assert servicio.modo.getter_func(servicio, None) == b"\x00"
    finally:
        loop.close()
