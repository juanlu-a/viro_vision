"""Exists because on 2026-09-05 an AI Camera capture never finished and the app waited 20 s to fail:
the camera has to answer or fail fast, and one hung capture cannot leave the rest of the session
without a camera. It is tested with a fake picamera2: the real one only exists on the device."""

import os
import sys
import threading

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision import camera  # noqa: E402
from virovision.camera import Camera  # noqa: E402


class FakePicam:
    def __init__(self, behaviour):
        self.behaviour = behaviour
        self.closed = False

    def capture_file(self, buffer, format):
        if self.behaviour == "ok":
            buffer.write(b"\xff\xd8JPEG")
        elif self.behaviour in ("hangs", "will not close"):
            threading.Event().wait(2)  # longer than the test's timeout
        else:
            raise RuntimeError("frontend timeout")

    def stop(self):
        if self.behaviour == "will not close":
            threading.Event().wait(2)

    def close(self):
        self.closed = True


def with_picam(behaviour):
    c = Camera()
    c._picam = FakePicam(behaviour)
    c.start = lambda: False  # the restart "fails": there is no picamera2 on the Mac
    return c


def test_a_normal_capture_returns_the_jpeg():
    assert with_picam("ok").capture_jpeg(timeout_s=1) == b"\xff\xd8JPEG"


def test_a_hung_capture_expires_fast_and_restarts_the_camera():
    c = with_picam("hangs")
    picam = c._picam
    with pytest.raises(TimeoutError, match="did not deliver"):
        c.capture_jpeg(timeout_s=0.2)
    assert picam.closed
    assert not c.available  # the restart failed on the Mac; on the device it reopens the sensor


def test_a_capture_that_fails_propagates_the_error_and_restarts():
    c = with_picam("fails")
    with pytest.raises(RuntimeError, match="frontend timeout"):
        c.capture_jpeg(timeout_s=1)
    assert not c.available


def test_without_a_started_camera_it_says_so():
    with pytest.raises(RuntimeError, match="not started"):
        Camera().capture_jpeg()


def test_while_starting_it_says_it_is_coming():
    from virovision.camera import CameraNotReady

    c = Camera()
    c.starting = True
    with pytest.raises(CameraNotReady, match="still starting"):
        c.capture_jpeg()


def test_a_sensor_that_will_not_close_ends_the_process_instead_of_holding_the_lock(monkeypatch):
    """2026-09-23: the phone asked for a photo and got nothing at all, not even an error. A jammed
    sensor blocks in `stop()` under the capture lock; waiting on it forever leaves the whole board
    mute. Past the deadline the process gives up so systemd can start a clean one."""
    monkeypatch.setattr(camera, "CLOSE_TIMEOUT_S", 0.2)
    c = with_picam("will not close")
    gave_up = threading.Event()
    c._give_up = gave_up.set
    with pytest.raises(TimeoutError, match="did not deliver"):
        c.capture_jpeg(timeout_s=0.2)
    assert gave_up.is_set()
    assert not c.available


def test_a_photo_behind_a_restart_fails_on_time_instead_of_waiting_for_it():
    c = with_picam("ok")
    c._lock.acquire()  # a restart in progress
    try:
        with pytest.raises(TimeoutError, match="busy restarting"):
            c.capture_jpeg(timeout_s=0.2)
    finally:
        c._lock.release()
    assert c.capture_jpeg(timeout_s=1) == b"\xff\xd8JPEG"


class FakePicamera2:
    """Just enough of picamera2's class for `Camera._start` to run on the Mac."""

    opened: list = []
    fail_on = None

    def __init__(self, camera_num=None):
        FakePicamera2.opened.append(self)
        self.camera_num = camera_num
        self.options = {}
        self.sensor_resolution = (4056, 3040)
        self.closed = False

    def create_preview_configuration(self, **kwargs):
        return kwargs

    def create_still_configuration(self, **kwargs):
        return kwargs

    def configure(self, config):
        if FakePicamera2.fail_on == "configure":
            raise RuntimeError("Failed to configure")

    def start(self):
        pass

    def stop(self):
        pass

    def close(self):
        self.closed = True


@pytest.fixture
def picamera2(monkeypatch):
    import types

    module = types.ModuleType("picamera2")
    module.Picamera2 = FakePicamera2
    monkeypatch.setitem(sys.modules, "picamera2", module)
    FakePicamera2.opened = []
    FakePicamera2.fail_on = None
    return FakePicamera2


def test_a_restart_reopens_the_camera_and_keeps_the_detector(picamera2):
    """2026-10-06. Each restart used to load the `.rpk` into the sensor again, holding the capture
    lock through it; a watchdog restarting over and over kept every photo waiting behind that."""
    import types

    c = Camera(model="/home/virovision/models/bus_sign.rpk")
    sensor = types.SimpleNamespace(camera_num=1)
    c._imx500 = sensor
    c._picam = old = FakePicamera2(1)
    loads = []
    c._load_model = lambda: loads.append("loaded")
    c.restart()
    assert loads == [], "the detector is not pushed again"
    assert c.sensor is sensor and c.available
    assert old.closed and c._picam is not old and c._picam.camera_num == 1


def test_a_half_started_camera_is_closed_and_the_detector_dropped(picamera2):
    """Opened but failing to configure: unclosed, libcamera keeps it acquired by a handle nobody
    holds and every later start fails as busy. The detector handle is dropped so the next try loads
    it fresh instead of reusing whatever state the failure left."""
    import types

    picamera2.fail_on = "configure"
    c = Camera(model="/home/virovision/models/bus_sign.rpk")
    c._load_model = lambda: types.SimpleNamespace(camera_num=1)
    assert not c.start()
    assert picamera2.opened and picamera2.opened[-1].closed
    assert c.sensor is None and not c.available
