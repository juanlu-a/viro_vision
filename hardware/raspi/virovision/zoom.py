"""Bus mode's digital zoom: the ISP crops the sensor around the sign so the OCR gets real pixels of it.

Field test of 2026-10-19: the sensor found the bus from far away, but its sign only became readable
with the bus almost in front of the user — too late for a bus that does not stop. The frame was the
reason: the main stream is 1024 px wide for a 4056 px sensor, so a sign 20 m away was ~9 px tall and
the crop's upscale (`bus_banner.crop`) only made the blur bigger. Cropping in the ISP (`ScalerCrop`)
instead gives the OCR up to 2x more detail in the binned sensor mode and up to 4x in the full one.

Two coordinate spaces, and the reason this module exists:

- **The full view**: the whole field of view at the main stream's size, which is what the frame showed
  before there was a zoom. The detector inside the IMX500 always sees the whole sensor (its input
  region is its own control, not the ISP's crop), so its boxes and the tracker live here, and the
  tracker's rules (`bus_banner.tracking`) keep the meaning they were tuned with.
- **The frame**: what one frame really shows, which depends on that frame's `ScalerCrop`. Only the
  crop handed to the OCR is translated into it, using the crop the frame's metadata reports — not the
  one asked for, which arrives a couple of frames late.

Rectangles of the sensor are (x, y, width, height) in full-resolution sensor pixels, as libcamera's
`ScalerCrop` takes them. Boxes are anything with x1, y1, x2, y2 (`bus_banner.types.Box`); nothing here
imports the pipeline, so it is tested on a laptop.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable, Optional

Rect = tuple[int, int, int, int]

TARGET_SIGN_HEIGHT_PX = 64
"""How tall the sign should come out in the frame. PP-OCR's recognizer resizes every line to 48 px, so
more than this buys nothing and only narrows the view."""
MAX_SIGN_WIDTH = 0.5
"""The sign never takes more than this fraction of the frame's width: the rest is room for the head to
move while the next crop is on its way, and for the extra margin the crop takes on the left."""
MAX_ZOOM = 4.0
SIGN_MIN_ASPECT = 2.0
"""Only a wide sign is zoomed on: the front banner. Same rule as `bus_banner.crop.MIN_BANNER_ASPECT`,
which is the sign the watcher will read."""
HOLD_S = 1.5
"""How long the zoom stays after the sign stops being detected. The sensor misses the sign in single
frames all the time; zooming out on each of those would throw away the crop the next read needs."""
DEADBAND = 0.1
"""A new crop is only asked for when it differs from the last one by more than this fraction of its
size, in size or in position. Detector boxes jitter by a few pixels every frame."""


@dataclass(frozen=True)
class View:
    """Which part of the sensor one frame shows, and how to translate boxes from the full view into it."""

    crop: Rect
    """This frame's `ScalerCrop`."""
    full: Rect
    """The crop with no zoom (`ScalerCropMaximum`): what the full view covers."""
    size: tuple[int, int]
    """(width, height) of the main stream: of the frame, and of the full view."""

    @property
    def zoom(self) -> float:
        return self.full[2] / self.crop[2] if self.crop[2] else 1.0

    def _to_sensor(self, box) -> tuple[float, float, float, float]:
        fx, fy, fw, fh = self.full
        width, height = self.size
        return (fx + box.x1 * fw / width, fy + box.y1 * fh / height, fx + box.x2 * fw / width, fy + box.y2 * fh / height)

    def to_frame(self, box):
        """A box of the full view, in pixels of this frame. Same type as it came in."""
        cx, cy, cw, ch = self.crop
        width, height = self.size
        x1, y1, x2, y2 = self._to_sensor(box)
        return type(box)((x1 - cx) * width / cw, (y1 - cy) * height / ch, (x2 - cx) * width / cw, (y2 - cy) * height / ch)

    def shows(self, box) -> bool:
        """Whether this frame shows the whole box. Half a sign is not worth an OCR read."""
        cx, cy, cw, ch = self.crop
        x1, y1, x2, y2 = self._to_sensor(box)
        return x1 >= cx and y1 >= cy and x2 <= cx + cw and y2 <= cy + ch


def widest_sign(detections: list):
    """The sign to zoom on: the biggest wide one, which is the closest bus's front banner."""
    signs = [d.box for d in detections if d.label == "bus_sign" and d.box.aspect >= SIGN_MIN_ASPECT]
    return max(signs, key=lambda box: box.area, default=None)


class ZoomController:
    """Decides the `ScalerCrop` frame by frame. `aim` returns a crop to apply, or None to leave it."""

    def __init__(
        self, full: Rect, min_size: tuple[int, int], size: tuple[int, int], clock: Callable[[], float] = time.monotonic
    ) -> None:
        self.full = full
        self.size = size
        """(width, height) of the frame, and of the full view the boxes come in."""
        # Narrower than this the ISP would be upscaling: no sensor pixels left to gain.
        self._min_width = max(min_size[0], full[2] / MAX_ZOOM)
        self._clock = clock
        self._requested: Rect = full
        self._seen_at: Optional[float] = None

    @property
    def max_zoom(self) -> float:
        return self.full[2] / self._min_width

    def aim(self, sign) -> Optional[Rect]:
        """`sign` is a box of the full view, or None when this frame has none."""
        now = self._clock()
        if sign is not None:
            self._seen_at = now
            target = self._crop_around(sign)
        elif self._seen_at is not None and now - self._seen_at >= HOLD_S:
            self._seen_at = None
            target = self.full
        else:
            return None
        if _close(target, self._requested):
            return None
        self._requested = target
        return target

    def forget(self) -> None:
        """The camera restarted, and a fresh camera starts with no zoom whatever was asked before."""
        self._requested = self.full
        self._seen_at = None

    def _crop_around(self, sign) -> Rect:
        fx, fy, fw, fh = self.full
        width, height = self.size
        sign_w, sign_h = sign.width * fw / width, sign.height * fh / height
        # Tall enough for the target height, wide enough for the sign to fit in its share of the frame.
        crop_w = max(sign_h * height / TARGET_SIGN_HEIGHT_PX * width / height, sign_w / MAX_SIGN_WIDTH, self._min_width)
        crop_w = min(crop_w, fw)
        crop_h = crop_w * height / width
        center_x = fx + (sign.x1 + sign.x2) / 2 * fw / width
        center_y = fy + (sign.y1 + sign.y2) / 2 * fh / height
        x = min(max(center_x - crop_w / 2, fx), fx + fw - crop_w)
        y = min(max(center_y - crop_h / 2, fy), fy + fh - crop_h)
        # Even values: the ISP works on 2x2 Bayer cells.
        return (int(x) // 2 * 2, int(y) // 2 * 2, int(crop_w) // 2 * 2, int(crop_h) // 2 * 2)


def _close(a: Rect, b: Rect) -> bool:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return (
        abs(aw - bw) <= DEADBAND * bw
        and abs((ax + aw / 2) - (bx + bw / 2)) <= DEADBAND * bw
        and abs((ay + ah / 2) - (by + bh / 2)) <= DEADBAND * bh
    )
