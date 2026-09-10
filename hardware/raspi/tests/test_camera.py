"""Exists because on 2026-09-05 an AI Camera capture never finished and the app waited 20 s to fail:
the camera has to answer or fail fast, and one hung capture cannot leave the rest of the session
without a camera. It is tested with a fake picamera2: the real one only exists on the device."""

import os
import sys
import threading

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.camera import Camera  # noqa: E402


class FakePicam:
    def __init__(self, behaviour):
        self.behaviour = behaviour
        self.closed = False

    def capture_file(self, buffer, format):
        if self.behaviour == "ok":
            buffer.write(b"\xff\xd8JPEG")
        elif self.behaviour == "hangs":
            threading.Event().wait(2)  # longer than the test's timeout
        else:
            raise RuntimeError("frontend timeout")

    def stop(self):
        pass

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
