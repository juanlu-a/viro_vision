"""Existe porque el 2026-09-05 una captura de la AI Camera no terminó nunca y la app esperó 20 s para
fallar: la cámara tiene que responder o fallar rápido, y una captura colgada no puede dejar sin
cámara el resto de la sesión. Se prueba con un picamera2 falso: el real sólo existe en la placa."""

import os
import sys
import threading

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.camara import Camara  # noqa: E402


class PicamFalso:
    def __init__(self, comportamiento):
        self.comportamiento = comportamiento
        self.cerrado = False

    def capture_file(self, buffer, format):
        if self.comportamiento == "ok":
            buffer.write(b"\xff\xd8JPEG")
        elif self.comportamiento == "cuelga":
            threading.Event().wait(2)  # más que el timeout del test
        else:
            raise RuntimeError("frontend timeout")

    def stop(self):
        pass

    def close(self):
        self.cerrado = True


def con_picam(comportamiento):
    c = Camara()
    c._picam = PicamFalso(comportamiento)
    c.iniciar = lambda: False  # el reinicio "falla": no hay picamera2 en la Mac
    return c


def test_captura_normal_devuelve_el_jpeg():
    assert con_picam("ok").capturar_jpeg(timeout_s=1) == b"\xff\xd8JPEG"


def test_captura_colgada_vence_rapido_y_reinicia_la_camara():
    c = con_picam("cuelga")
    picam = c._picam
    with pytest.raises(TimeoutError, match="no entregó"):
        c.capturar_jpeg(timeout_s=0.2)
    assert picam.cerrado
    assert not c.disponible  # el reinicio falló en la Mac; en la placa vuelve a abrir el sensor


def test_captura_que_falla_propaga_el_error_y_reinicia():
    c = con_picam("falla")
    with pytest.raises(RuntimeError, match="frontend timeout"):
        c.capturar_jpeg(timeout_s=1)
    assert not c.disponible


def test_sin_camara_iniciada_avisa():
    with pytest.raises(RuntimeError, match="no iniciada"):
        Camara().capturar_jpeg()
