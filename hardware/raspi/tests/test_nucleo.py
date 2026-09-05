"""Existe porque el núcleo es el código que corre tanto en la placa como en el emulador de la Mac:
si el comando `medir` no envolviera la transferencia en `inicio`/`fin`, o partiera con otro tamaño
de chunk del que la app pidió, la app mediría mal o no terminaría nunca, y los dos entornos
fallarían igual sin que ninguno lo mostrara."""

import asyncio
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.nucleo import ESTADO, EVENTO, MODO, TRANSFERENCIA, Nucleo  # noqa: E402
from virovision.transferencia import armar  # noqa: E402


class Notificaciones:
    def __init__(self):
        self.recibidas: list[tuple[str, bytes]] = []

    async def __call__(self, nombre: str, valor: bytes) -> None:
        self.recibidas.append((nombre, bytes(valor)))

    def de(self, nombre: str) -> list[bytes]:
        return [v for n, v in self.recibidas if n == nombre]

    def eventos(self) -> list[dict]:
        return [json.loads(v) for v in self.de(EVENTO)]


def crear(loop, capturar=None, control_ap=None):
    n = Notificaciones()
    nucleo = Nucleo(loop, lambda: {"version": "t"}, capturar, lambda cant: bytes(range(256)) * (cant // 256) + bytes(cant % 256), n, control_ap=control_ap)
    return nucleo, n


@pytest.fixture
def loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


async def _correr(loop_):
    # dejar que las tareas programadas terminen
    for _ in range(5):
        await asyncio.sleep(0)
    pendientes = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
    if pendientes:
        await asyncio.gather(*pendientes)


def test_medir_envuelve_la_transferencia_y_respeta_el_chunk(loop):
    nucleo, n = crear(loop)
    nucleo.escribir_control(b'{"cmd":"medir","bytes":53000,"chunk":182}', mtu=185)
    loop.run_until_complete(_correr(loop))

    eventos = n.eventos()
    assert eventos[0]["t"] == "inicio" and eventos[0]["bytes"] == 53000 and eventos[0]["chunks"] == 298
    assert eventos[-1]["t"] == "fin" and eventos[-1]["chunks"] == 298
    chunks = n.de(TRANSFERENCIA)
    assert len(chunks) == 298 and max(len(c) for c in chunks) == 182
    assert len(armar(chunks)) == 53000


def test_el_chunk_nunca_supera_el_mtu_negociado(loop):
    nucleo, n = crear(loop)
    nucleo.escribir_control(b'{"cmd":"medir","bytes":1000,"chunk":500}', mtu=185)
    loop.run_until_complete(_correr(loop))
    assert n.eventos()[0]["chunk"] == 182


def test_sin_mtu_ni_chunk_usa_el_default_de_ios(loop):
    nucleo, n = crear(loop)
    nucleo.escribir_control(b'{"cmd":"medir","bytes":1000}')
    loop.run_until_complete(_correr(loop))
    assert n.eventos()[0]["chunk"] == 182


def test_comando_desconocido_o_ilegible_es_un_evento_de_error_no_una_excepcion(loop):
    nucleo, n = crear(loop)
    nucleo.escribir_control(b'{"cmd":"bailar"}')
    nucleo.escribir_control(b"esto no es json")
    loop.run_until_complete(_correr(loop))
    assert [e["t"] for e in n.eventos()] == ["error", "error"]


def test_cambiar_de_modo_notifica_modo_y_evento(loop):
    nucleo, n = crear(loop)
    nucleo.escribir_control(b'{"cmd":"modo","valor":2}')
    loop.run_until_complete(_correr(loop))
    assert n.de(MODO) == [b"\x02"]
    assert n.eventos() == [{"t": "modo", "valor": 2}]
    assert nucleo.leer_modo() == b"\x02"


def test_foto_sin_camara_avisa_en_vez_de_romper(loop):
    nucleo, n = crear(loop)
    nucleo.escribir_control(b'{"cmd":"foto"}')
    loop.run_until_complete(_correr(loop))
    assert n.eventos() == [{"t": "error", "msg": "sin cámara: usá medir"}]


def test_foto_con_camara_transfiere_lo_capturado(loop):
    async def capturar():
        return b"JPEG" * 100

    nucleo, n = crear(loop, capturar)
    nucleo.escribir_control(b'{"cmd":"foto","chunk":24}')
    loop.run_until_complete(_correr(loop))
    assert n.eventos()[0]["tipo"] == "foto"
    assert armar(n.de(TRANSFERENCIA)) == b"JPEG" * 100


def test_ap_enciende_por_tiempo_acotado_y_avisa(loop):
    llamadas = []
    nucleo, n = crear(loop, control_ap=llamadas.append)
    nucleo.escribir_control(b'{"cmd":"ap","valor":true,"minutos":999}')
    loop.run_until_complete(_correr(loop))
    assert llamadas == [True]
    assert n.eventos()[0] == {"t": "ap", "encendido": True, "minutos": 60}  # tope: nunca queda sin red para siempre
    assert nucleo._apagado_ap is not None  # el apagado automático quedó programado
    nucleo.escribir_control(b'{"cmd":"ap","valor":false}')
    loop.run_until_complete(_correr(loop))
    assert llamadas == [True, False]
    assert nucleo._apagado_ap is None


def test_ap_sin_soporte_es_un_error_no_una_excepcion(loop):
    nucleo, n = crear(loop)
    nucleo.escribir_control(b'{"cmd":"ap"}')
    loop.run_until_complete(_correr(loop))
    assert n.eventos()[0]["t"] == "error"


def test_estado_se_puede_pedir_por_comando(loop):
    nucleo, n = crear(loop)
    nucleo.escribir_control(b'{"cmd":"estado"}')
    loop.run_until_complete(_correr(loop))
    assert json.loads(n.de(ESTADO)[0]) == {"version": "t"}
