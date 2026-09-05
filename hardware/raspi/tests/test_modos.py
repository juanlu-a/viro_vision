"""Existe porque las transiciones son el contrato con el usuario ciego (ADR 0007): un click que
cambiara de modo estando dentro de otro, o un click largo que no volviera a esperando, dejaría al
usuario sin saber en qué estado está, y el audio es su único indicador."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.modos import MaquinaDeModos, Modo  # noqa: E402


def test_un_click_desde_esperando_es_omnibus():
    m = MaquinaDeModos()
    assert m.desde_clicks(1) is True
    assert m.actual is Modo.OMNIBUS


def test_dos_clicks_desde_esperando_es_supermercado():
    m = MaquinaDeModos()
    assert m.desde_clicks(2) is True
    assert m.actual is Modo.SUPERMERCADO


def test_dentro_de_un_modo_los_clicks_no_cambian_de_modo():
    m = MaquinaDeModos()
    m.desde_clicks(1)
    assert m.desde_clicks(2) is False
    assert m.actual is Modo.OMNIBUS


def test_click_largo_siempre_vuelve_a_esperando():
    m = MaquinaDeModos()
    m.desde_clicks(2)
    assert m.click_largo() is True
    assert m.actual is Modo.ESPERANDO
    assert m.click_largo() is False  # ya estaba: no hay transición que anunciar
