"""Exists because the zoom moves the frame under the tracker's feet: a box that means one place in the
full view means another in a zoomed frame, and getting that translation wrong reads the bodywork
instead of the sign — silently, since the OCR still returns something. It also must not chase the
detector's jitter, nor zoom out on every frame that misses the sign."""

import os
import sys
from dataclasses import dataclass

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from virovision.zoom import HOLD_S, TARGET_SIGN_HEIGHT_PX, View, ZoomController, widest_sign  # noqa: E402

FULL = (0, 0, 4056, 3040)
SIZE = (1024, 768)
BINNED_MIN = (2048, 1536)  # 1024x768 frame over the 2028x1520 mode: 2x at most


@dataclass(frozen=True)
class Box:
    x1: float
    y1: float
    x2: float
    y2: float

    @property
    def width(self):
        return self.x2 - self.x1

    @property
    def height(self):
        return self.y2 - self.y1

    @property
    def area(self):
        return self.width * self.height

    @property
    def aspect(self):
        return self.width / self.height


@dataclass(frozen=True)
class Detection:
    label: str
    box: Box


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


def test_without_zoom_a_box_stays_where_it_was():
    view = View(FULL, FULL, SIZE)
    assert view.zoom == 1.0
    assert view.to_frame(Box(100, 50, 300, 90)) == Box(100, 50, 300, 90)


def test_a_zoomed_frame_shows_the_box_bigger_and_shifted():
    # The right half of the sensor's upper half: 2x, starting at x = 512 of the full view.
    view = View((2028, 0, 2028, 1520), FULL, SIZE)
    assert view.zoom == 2.0
    box = view.to_frame(Box(600, 100, 700, 120))
    assert (box.x1, box.y1, box.x2, box.y2) == (176, 200, 376, 240)
    assert isinstance(box, Box), "the pipeline's own type comes back, so `clip` and friends still work"


def test_a_sign_cut_by_the_zoom_is_not_shown():
    view = View((2028, 0, 2028, 1520), FULL, SIZE)
    assert view.shows(Box(600, 100, 700, 120))
    assert not view.shows(Box(480, 100, 560, 120)), "it starts left of the crop"
    assert not view.shows(Box(600, 370, 700, 400)), "it ends below the crop"


def test_a_small_sign_is_zoomed_on_up_to_the_mode_limit():
    zoom = ZoomController(FULL, BINNED_MIN, SIZE, clock=Clock())
    assert abs(zoom.max_zoom - 4056 / 2048) < 1e-9, "the binned mode gives a bit under 2x"
    crop = zoom.aim(Box(500, 300, 540, 310))  # 10 px tall: far away
    x, y, w, h = crop
    assert w == 2048 and h == 1536, "as far as the sensor mode has real pixels, no further"
    assert x <= 520 * 4056 / 1024 <= x + w and y <= 305 * 3040 / 768 <= y + h, "centered on the sign"


def test_with_the_full_mode_it_zooms_until_the_sign_is_tall_enough():
    zoom = ZoomController(FULL, (1024, 768), SIZE, clock=Clock())
    crop = zoom.aim(Box(500, 300, 540, 320))
    view = View(crop, FULL, SIZE)
    sign = view.to_frame(Box(500, 300, 540, 320))
    assert abs(sign.height - TARGET_SIGN_HEIGHT_PX) < 2, "zoomed just enough for the recognizer, not more"


def test_a_wide_sign_keeps_room_around_it():
    zoom = ZoomController(FULL, (1024, 768), SIZE, clock=Clock())
    sign = Box(300, 300, 500, 316)  # short but wide: the height alone would zoom it out of the frame
    view = View(zoom.aim(sign), FULL, SIZE)
    shown = view.to_frame(sign)
    assert shown.width <= SIZE[0] * 0.5 + 2
    assert view.shows(sign)


def test_the_crop_never_leaves_the_sensor():
    zoom = ZoomController(FULL, (1024, 768), SIZE, clock=Clock())
    x, y, w, h = zoom.aim(Box(0, 0, 30, 6))  # in the very corner
    assert x >= 0 and y >= 0 and x + w <= 4056 and y + h <= 3040


def test_jitter_does_not_move_the_zoom():
    zoom = ZoomController(FULL, BINNED_MIN, SIZE, clock=Clock())
    assert zoom.aim(Box(500, 300, 540, 310)) is not None
    assert zoom.aim(Box(502, 301, 541, 311)) is None, "a few pixels of detector noise ask for nothing"
    assert zoom.aim(Box(800, 300, 840, 310)) is not None, "a sign that really moved is followed"


def test_a_missed_frame_keeps_the_zoom_and_a_lost_sign_lets_it_go():
    clock = Clock()
    zoom = ZoomController(FULL, BINNED_MIN, SIZE, clock=clock)
    zoom.aim(Box(500, 300, 540, 310))
    clock.now = HOLD_S / 2
    assert zoom.aim(None) is None, "the sensor misses the sign in single frames: hold"
    clock.now = HOLD_S + 0.1
    assert zoom.aim(None) == FULL, "gone for good: back to the whole view, to find the next bus"
    clock.now += 1
    assert zoom.aim(None) is None, "and asked once"


def test_after_a_camera_restart_the_zoom_is_asked_for_again():
    zoom = ZoomController(FULL, BINNED_MIN, SIZE, clock=Clock())
    crop = zoom.aim(Box(500, 300, 540, 310))
    zoom.forget()  # the reopened camera starts unzoomed
    assert zoom.aim(Box(500, 300, 540, 310)) == crop


def test_only_the_widest_front_banner_is_zoomed_on():
    near = Detection("bus_sign", Box(100, 100, 300, 140))
    far = Detection("bus_sign", Box(600, 100, 640, 110))
    number_only = Detection("bus_sign", Box(0, 0, 400, 380))  # big, but square: a side or number sign
    bus = Detection("bus", Box(0, 0, 1000, 700))
    assert widest_sign([far, near, number_only, bus]) == near.box
    assert widest_sign([bus]) is None
