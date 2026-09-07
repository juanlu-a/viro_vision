"""Existe porque este servidor es el camino de la foto que decidió el ADR 0003 (WiFi, 46 ms contra
4,5 s por BLE): si `/medir/<n>` devolviera n bytes de menos, o `/fotos/ultima` no reportara la falta
de cámara como 503, la app mediría mal o rompería sin pista, y los dos entornos (placa y emulador)
fallarían igual."""

import json
import os
import sys
import urllib.error
import urllib.request

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.http_servidor import ServidorHttp  # noqa: E402


@pytest.fixture
def servidor():
    s = ServidorHttp(
        leer_estado=lambda: {"version": "t", "ip": "127.0.0.1"},
        payload_sintetico=lambda n: bytes(n),
        capturar=None,
        puerto=0,  # el sistema elige uno libre
    )
    s.iniciar()
    yield s
    s.parar()


def _get(servidor, ruta):
    return urllib.request.urlopen(f"http://127.0.0.1:{servidor.puerto}{ruta}", timeout=5)


def test_salud_devuelve_el_estado(servidor):
    with _get(servidor, "/salud") as r:
        assert r.status == 200
        assert json.loads(r.read()) == {"version": "t", "ip": "127.0.0.1"}


def test_medir_devuelve_exactamente_los_bytes_pedidos(servidor):
    with _get(servidor, "/medir/53000") as r:
        cuerpo = r.read()
        assert len(cuerpo) == 53000
        assert r.headers["Content-Length"] == "53000"
        assert r.headers["Content-Type"] == "application/octet-stream"


def test_medir_rechaza_valores_invalidos(servidor):
    for ruta in ("/medir/abc", "/medir/-1", "/medir/999999999"):
        with pytest.raises(urllib.error.HTTPError) as exc:
            _get(servidor, ruta)
        assert exc.value.code == 400


def test_foto_sin_camara_es_503(servidor):
    with pytest.raises(urllib.error.HTTPError) as exc:
        _get(servidor, "/fotos/ultima")
    assert exc.value.code == 503


def test_foto_con_camara_devuelve_el_jpeg():
    s = ServidorHttp(lambda: {}, bytes, capturar=lambda: b"\xff\xd8JPEG", puerto=0)
    s.iniciar()
    try:
        with _get(s, "/fotos/ultima") as r:
            assert r.headers["Content-Type"] == "image/jpeg"
            assert r.read() == b"\xff\xd8JPEG"
    finally:
        s.parar()


def test_audio_se_guarda_y_responde_202(servidor, tmp_path, monkeypatch):
    import virovision.http_servidor as m

    monkeypatch.setattr(m, "DIRECTORIO_AUDIO", str(tmp_path))
    req = urllib.request.Request(
        f"http://127.0.0.1:{servidor.puerto}/audio", data=b"ID3mp3", method="POST", headers={"Content-Type": "audio/mpeg"}
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        assert r.status == 202
        respuesta = json.loads(r.read())
    assert respuesta["bytes"] == 6
    assert respuesta["archivo"].endswith(".mp3")
    assert open(respuesta["archivo"], "rb").read() == b"ID3mp3"


def test_audio_en_base64_se_decodifica(servidor, tmp_path, monkeypatch):
    import base64

    import virovision.http_servidor as m

    monkeypatch.setattr(m, "DIRECTORIO_AUDIO", str(tmp_path))
    req = urllib.request.Request(
        f"http://127.0.0.1:{servidor.puerto}/audio",
        data=base64.b64encode(b"ID3mp3"),
        method="POST",
        headers={"Content-Type": "audio/mpeg", "X-Encoding": "base64"},
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        respuesta = json.loads(r.read())
    assert respuesta["bytes"] == 6
    assert open(respuesta["archivo"], "rb").read() == b"ID3mp3"


def test_ruta_desconocida_es_404(servidor):
    with pytest.raises(urllib.error.HTTPError) as exc:
        _get(servidor, "/nada")
    assert exc.value.code == 404
