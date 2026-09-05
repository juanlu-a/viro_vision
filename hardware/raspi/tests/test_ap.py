"""Existe porque el AP se maneja por nmcli y un argumento mal puesto deja a la placa sin red y sin
SSH en la calle: el orden y el contenido de las llamadas es el contrato con NetworkManager."""

import os
import subprocess
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.ap import NOMBRE_CONEXION, PuntoDeAcceso  # noqa: E402


class NmcliFalso:
    def __init__(self, existente=False):
        self.llamadas = []
        self.existente = existente

    def __call__(self, args):
        self.llamadas.append(list(args))
        if args[:1] == ["-t"]:
            return subprocess.CompletedProcess(args, 0, stdout=(NOMBRE_CONEXION + "\n") if self.existente else "Jack_2.4\n", stderr="")
        return subprocess.CompletedProcess(args, 0, stdout="", stderr="")


def test_encender_crea_la_conexion_una_sola_vez_y_la_levanta():
    nm = NmcliFalso(existente=False)
    ap = PuntoDeAcceso(nm)
    ap.encender()
    assert ap.encendido
    verbos = [l[:2] for l in nm.llamadas]
    assert ["con", "add"] in verbos and ["con", "modify"] in verbos and ["con", "up"] in verbos
    modificar = next(l for l in nm.llamadas if l[:2] == ["con", "modify"])
    assert "802-11-wireless.mode" in modificar and "ap" in modificar
    assert "ipv4.method" in modificar and "shared" in modificar
    assert "802-11-wireless.band" in modificar and "bg" in modificar  # la Zero 2 W es sólo 2,4 GHz


def test_encender_con_la_conexion_ya_creada_solo_la_levanta():
    nm = NmcliFalso(existente=True)
    PuntoDeAcceso(nm).encender()
    assert [l[:2] for l in nm.llamadas] == [["-t", "-f"], ["con", "up"]]


def test_apagar_baja_la_conexion_y_marca_estado():
    nm = NmcliFalso(existente=True)
    ap = PuntoDeAcceso(nm)
    ap.encender()
    ap.apagar()
    assert not ap.encendido
    assert nm.llamadas[-1] == ["con", "down", NOMBRE_CONEXION]


def test_un_nmcli_que_falla_lanza_con_el_motivo():
    def nm(args):
        return subprocess.CompletedProcess(args, 1, stdout="", stderr="Error: wlan0 no existe")

    with pytest.raises(RuntimeError, match="wlan0 no existe"):
        PuntoDeAcceso(nm).encender()
