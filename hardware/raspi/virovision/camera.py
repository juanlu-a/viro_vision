"""Capture from the AI Camera (IMX500) with picamera2, or a synthetic source when there is no camera.

The photo comes out already reduced to 1024 px on its longest side and JPEG at quality 70, an exact
mirror of what the app used to do before uploading to the cloud: that way what is measured over BLE
is what would really travel (~53 KB), and the scaling is done by the ISP, not by Python. Without a
camera, `measure` sends random bytes of the requested size: throughput does not look at the content,
so the spike runs on a bare board.
"""

from __future__ import annotations

import io
import logging
import os
import threading
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

MAX_LONG_SIDE = 1024
JPEG_QUALITY = 70
WATCH_FPS = 15.0
"""Frames per second asked of the sensor in bus mode. The IMX500 runs yolo11n at about that rate, and
asking for more only adds frames the Pi drops."""
# A normal capture takes 200-500 ms; 8 s is "something jammed", not "it is slow". The app waits 20.
CAPTURE_TIMEOUT_S = 8.0


class Camera:
    def __init__(self, long_side: int = MAX_LONG_SIDE, quality: int = JPEG_QUALITY, model: Optional[Path] = None) -> None:
        self._long_side = long_side
        self._quality = quality
        self._model = model
        self._picam = None
        self._imx500 = None
        # One capture at a time: BLE (`photo`) and HTTP (`/photos/latest`) can ask at the same time.
        self._lock = threading.Lock()

    @property
    def available(self) -> bool:
        return self._picam is not None

    def start(self) -> bool:
        """Starts the camera once (it takes ~1 s); capturing afterwards is cheap. Returns False when
        there is no camera or picamera2 is missing, and the daemon carries on without it.

        With a `model` (a `.rpk` for the IMX500) the detector is loaded into the sensor here, at
        startup, and not when the user presses the button: the first firmware upload after a boot
        takes about a minute, and a button that answers a minute later is a broken button. Once
        loaded it stays in the sensor and costs nothing per frame on the Pi.
        """
        try:
            from picamera2 import Picamera2  # late import: it does not exist on the Mac
        except ImportError:
            log.warning("picamera2 is not installed; carrying on without a camera")
            return False
        try:
            self._imx500 = self._load_model()
            picam = Picamera2() if self._imx500 is None else Picamera2(self._imx500.camera_num)
            width, height = picam.sensor_resolution
            scale = self._long_side / max(width, height)
            size = (int(width * scale) // 2 * 2, int(height * scale) // 2 * 2)
            if self._imx500 is None:
                picam.configure(picam.create_still_configuration(main={"size": size}))
            else:
                # One preview configuration serves both uses: bus mode reads its frames and their
                # metadata, and `capture_jpeg` still encodes the same main stream for the phone.
                # RGB888 leaves the channels in BGR memory order, which is what OpenCV expects.
                picam.configure(
                    picam.create_preview_configuration(
                        main={"size": size, "format": "RGB888"},
                        controls={"FrameRate": WATCH_FPS},
                        buffer_count=8,
                    )
                )
            picam.options["quality"] = self._quality
            picam.start()
            self._picam = picam
            log.info(
                "camera ready: sensor %dx%d → %dx%d, JPEG q%d%s",
                width,
                height,
                *size,
                self._quality,
                ", detector in the sensor" if self._imx500 is not None else "",
            )
            return True
        except Exception as exc:  # picamera2 throws all sorts of things when no camera is attached
            log.warning("could not start the camera (%s); carrying on without it", exc)
            return False

    def _load_model(self):
        """Uploads the `.rpk` to the sensor. A missing file or a broken load is a warning, not a
        crash: the device still takes photos, and bus mode reports itself as unavailable."""
        if self._model is None:
            return None
        if not Path(self._model).exists():
            log.warning("bus model not found at %s; bus mode will be unavailable", self._model)
            return None
        try:
            from picamera2.devices.imx500 import IMX500

            imx500 = IMX500(str(self._model))
            log.info("detector loaded into the sensor: %s", self._model)
            return imx500
        except Exception as exc:  # noqa: BLE001 — every failure here ends the same way
            log.warning("could not load %s into the sensor (%s); bus mode will be unavailable", self._model, exc)
            return None

    @property
    def sensor(self):
        """The IMX500 handle, or None when no model was loaded. Bus mode asks this before starting."""
        return self._imx500

    def capture_request(self):
        """One frame plus its metadata (which carries the detector's output tensors). The caller MUST
        release it: picamera2 hands out a fixed pool of buffers and a leak stalls the camera."""
        if self._picam is None:
            raise RuntimeError("camera not started")
        return self._picam.capture_request()

    def to_stream(self, coords, metadata) -> tuple:
        """Normalized (y1, x1, y2, x2) from the detector -> (x, y, w, h) in pixels of the main stream,
        which is the frame the banner gets cropped from. The ISP crop and scale live in the metadata,
        so this cannot be done with a plain multiplication."""
        return self._imx500.convert_inference_coords(coords, metadata, self._picam)

    def capture_jpeg(self, timeout_s: float = CAPTURE_TIMEOUT_S) -> bytes:
        """Blocking (~200-500 ms on the Zero 2 W): call it from an executor.

        With a time cap: on 2026-09-05 a capture never finished (the app waited 20 s and failed) with
        the device in AP mode. If it expires, the camera is restarted for the next one: a
        `capture_file` that does not return leaves libcamera's pipeline jammed until the sensor is
        closed and reopened, and one hung capture can never leave the rest of the session without a
        camera.
        """
        if self._picam is None:
            raise RuntimeError("camera not started")
        with self._lock:
            picam = self._picam
            result: dict = {}

            def capture():
                try:
                    buffer = io.BytesIO()
                    picam.capture_file(buffer, format="jpeg")
                    result["jpeg"] = buffer.getvalue()
                except Exception as exc:  # noqa: BLE001 — reported whole to whoever asked for the photo
                    result["error"] = exc

            thread = threading.Thread(target=capture, name="capture", daemon=True)
            thread.start()
            thread.join(timeout_s)
            if thread.is_alive():
                log.error("the capture did not finish in %.0f s; restarting the camera", timeout_s)
                self._restart()
                raise TimeoutError(f"the camera did not deliver the photo in {timeout_s:.0f} s")
            if "error" in result:
                log.error("capture failed: %s; restarting the camera", result["error"])
                self._restart()
                raise result["error"]
            return result["jpeg"]

    def _restart(self) -> None:
        """Closes and reopens the sensor. If it cannot, the camera is left as unavailable and the
        daemon carries on (the app says the device has no camera)."""
        try:
            if self._picam is not None:
                self._picam.stop()
                self._picam.close()
        except Exception as exc:  # noqa: BLE001
            log.warning("while closing the camera: %s", exc)
        self._picam = None
        self.start()


def synthetic_payload(byte_count: int) -> bytes:
    return os.urandom(byte_count)
