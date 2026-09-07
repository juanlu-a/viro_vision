"""Existe porque el botón es el único control del usuario y no tiene forma de verificar lo que hizo:
si un click largo contara además como click, salir de un modo lo metería de inmediato en otro; si el
segundo click no cancelara la resolución del primero, un doble click sonaría como dos anuncios. Los
tiempos se prueban con un reloj falso: esperar 0,4 s de verdad por test no prueba nada más y hace los
tests lentos.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.boton import DetectorDeClicks  # noqa: E402
from virovision.modos import MaquinaDeModos, Modo  # noqa: E402


class _Agendado:
    def __init__(self, fn):
        self.fn = fn
        self.cancelado = False

    def cancel(self):
        self.cancelado = True


class RelojFalso:
    """Agenda sin esperar; el test decide cuándo vence la ventana."""

    def __init__(self):
        self.pendientes = []

    def programar(self, retardo_s, fn):
        agendado = _Agendado(fn)
        self.pendientes.append(agendado)
        return agendado

    def vencer(self):
        pendientes, self.pendientes = self.pendientes, []
        for a in pendientes:
            if not a.cancelado:
                a.fn()


def _detector():
    reloj = RelojFalso()
    clicks, largos = [], []
    d = DetectorDeClicks(clicks.append, lambda: largos.append(True), reloj.programar)
    return d, reloj, clicks, largos


def _click(d):
    d.presionado()
    d.soltado()


def test_un_click_se_resuelve_como_un_click():
    d, reloj, clicks, _ = _detector()
    _click(d)
    assert clicks == []  # todavía no: puede venir un segundo click
    reloj.vencer()
    assert clicks == [1]


def test_dos_clicks_seguidos_se_resuelven_como_uno_solo_de_dos():
    d, reloj, clicks, _ = _detector()
    _click(d)
    _click(d)
    reloj.vencer()
    assert clicks == [2]


def test_mantenerlo_no_cuenta_ademas_como_click():
    d, reloj, clicks, largos = _detector()
    d.presionado()
    d.mantenido()
    d.soltado()
    reloj.vencer()
    assert largos == [True]
    assert clicks == []


def test_mantenerlo_cancela_un_click_pendiente():
    """Click y, antes de que venza la ventana, mantenerlo apretado: gana el largo y el click previo
    no se aplica. Si no, el usuario saldría del modo y entraría a otro en el mismo gesto."""
    d, reloj, clicks, largos = _detector()
    _click(d)
    d.presionado()
    d.mantenido()
    d.soltado()
    reloj.vencer()
    assert largos == [True]
    assert clicks == []


def test_la_ventana_se_reinicia_con_cada_click():
    """El primer temporizador queda cancelado: si se disparara igual, un doble click daría un anuncio
    de "ómnibus" y otro de "supermercado"."""
    d, reloj, clicks, _ = _detector()
    _click(d)
    _click(d)
    assert sum(1 for a in reloj.pendientes if not a.cancelado) == 1
    reloj.vencer()
    assert clicks == [2]


def test_gestos_consecutivos_no_arrastran_el_contador():
    d, reloj, clicks, _ = _detector()
    _click(d)
    reloj.vencer()
    _click(d)
    reloj.vencer()
    assert clicks == [1, 1]


def test_los_gestos_llevan_a_los_modos_de_adr_0007():
    """El contrato completo, de punta a punta: gesto → modo."""
    modos = MaquinaDeModos()
    reloj = RelojFalso()
    d = DetectorDeClicks(modos.desde_clicks, modos.click_largo, reloj.programar)

    _click(d)
    reloj.vencer()
    assert modos.actual is Modo.OMNIBUS

    d.presionado()
    d.mantenido()
    d.soltado()
    assert modos.actual is Modo.ESPERANDO

    _click(d)
    _click(d)
    reloj.vencer()
    assert modos.actual is Modo.SUPERMERCADO

    d.presionado()
    d.mantenido()
    d.soltado()
    assert modos.actual is Modo.ESPERANDO
