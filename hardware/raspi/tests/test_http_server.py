"""Exists because this server is the photo path ADR 0003 decided on (WiFi, 46 ms against 4.5 s over
BLE): if `/measure/<n>` returned n bytes short, or `/photos/latest` did not report the missing camera
as a 503, the app would measure wrong or break with no clue, and both environments (device and
emulator) would fail identically."""

import json
import os
import sys
import urllib.error
import urllib.request

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.http_server import HttpServer  # noqa: E402


@pytest.fixture
def server():
    s = HttpServer(
        read_status=lambda: {"version": "t", "ip": "127.0.0.1"},
        synthetic_payload=lambda n: bytes(n),
        capture=None,
        port=0,  # the system picks a free one
    )
    s.start()
    yield s
    s.stop()


def _get(server, path):
    return urllib.request.urlopen(f"http://127.0.0.1:{server.port}{path}", timeout=5)


def test_health_returns_the_status(server):
    with _get(server, "/health") as r:
        assert r.status == 200
        assert json.loads(r.read()) == {"version": "t", "ip": "127.0.0.1"}


def test_measure_returns_exactly_the_requested_bytes(server):
    with _get(server, "/measure/53000") as r:
        body = r.read()
        assert len(body) == 53000
        assert r.headers["Content-Length"] == "53000"
        assert r.headers["Content-Type"] == "application/octet-stream"


def test_measure_rejects_invalid_values(server):
    for path in ("/measure/abc", "/measure/-1", "/measure/999999999"):
        with pytest.raises(urllib.error.HTTPError) as exc:
            _get(server, path)
        assert exc.value.code == 400


def test_photo_without_a_camera_is_503(server):
    with pytest.raises(urllib.error.HTTPError) as exc:
        _get(server, "/photos/latest")
    assert exc.value.code == 503


def test_photo_while_the_camera_starts_is_503_not_500():
    """A 500 reads as a crash; a camera still loading its detector after a boot is not one."""
    from virovision.camera import CameraNotReady

    def capture():
        raise CameraNotReady("the camera is still starting")

    s = HttpServer(lambda: {}, bytes, capture=capture, port=0)
    s.start()
    try:
        with pytest.raises(urllib.error.HTTPError) as exc:
            _get(s, "/photos/latest")
        assert exc.value.code == 503
        assert "still starting" in json.loads(exc.value.read())["error"]
    finally:
        s.stop()


def test_photo_with_a_camera_returns_the_jpeg():
    s = HttpServer(lambda: {}, bytes, capture=lambda: b"\xff\xd8JPEG", port=0)
    s.start()
    try:
        with _get(s, "/photos/latest") as r:
            assert r.headers["Content-Type"] == "image/jpeg"
            assert r.read() == b"\xff\xd8JPEG"
    finally:
        s.stop()


def test_audio_is_stored_and_answers_202(server, tmp_path, monkeypatch):
    import virovision.http_server as m

    monkeypatch.setattr(m, "AUDIO_DIRECTORY", str(tmp_path))
    req = urllib.request.Request(
        f"http://127.0.0.1:{server.port}/audio", data=b"ID3mp3", method="POST", headers={"Content-Type": "audio/mpeg"}
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        assert r.status == 202
        response = json.loads(r.read())
    assert response["bytes"] == 6
    assert response["file"].endswith(".mp3")
    assert open(response["file"], "rb").read() == b"ID3mp3"


def test_base64_audio_is_decoded(server, tmp_path, monkeypatch):
    import base64

    import virovision.http_server as m

    monkeypatch.setattr(m, "AUDIO_DIRECTORY", str(tmp_path))
    req = urllib.request.Request(
        f"http://127.0.0.1:{server.port}/audio",
        data=base64.b64encode(b"ID3mp3"),
        method="POST",
        headers={"Content-Type": "audio/mpeg", "X-Encoding": "base64"},
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        response = json.loads(r.read())
    assert response["bytes"] == 6
    assert open(response["file"], "rb").read() == b"ID3mp3"


def test_an_unknown_path_is_404(server):
    with pytest.raises(urllib.error.HTTPError) as exc:
        _get(server, "/nothing")
    assert exc.value.code == 404


def test_a_malformed_content_length_is_400_not_a_traceback(server):
    import socket

    with socket.create_connection(("127.0.0.1", server.port), timeout=5) as s:
        s.sendall(b"POST /audio HTTP/1.1\r\nHost: board\r\nContent-Length: lots\r\n\r\n")
        assert s.recv(64).startswith(b"HTTP/1.1 400")


def test_old_readings_are_deleted_so_tmp_does_not_eat_the_ram(server, tmp_path, monkeypatch):
    """/tmp is a tmpfs on Trixie: every MP3 the phone sent stayed in RAM until the next boot
    (2026-10-06). The newest few stay, so the file a player was just handed is never pulled away."""
    import virovision.http_server as m

    monkeypatch.setattr(m, "AUDIO_DIRECTORY", str(tmp_path))
    for stamp in (1000000000001, 1000000000002, 1000000000003, 1000000000004):
        (tmp_path / f"audio-{stamp}.mp3").write_bytes(b"old")
    req = urllib.request.Request(
        f"http://127.0.0.1:{server.port}/audio", data=b"ID3mp3", method="POST", headers={"Content-Type": "audio/mpeg"}
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        newest = json.loads(r.read())["file"]
    left = sorted(p.name for p in tmp_path.iterdir())
    assert len(left) == m.AUDIO_FILES_KEPT
    assert os.path.basename(newest) in left
    assert "audio-1000000000001.mp3" not in left and "audio-1000000000004.mp3" in left
