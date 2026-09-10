"""The device's HTTP server: the photo path over WiFi (ADR 0003's plan B).

Measured on 2026-09-05: over BLE the photo's 53 KB take 4.5 s (one notification per 15 ms interval,
controller without DLE); over HTTP on the same WiFi radio, 46 ms. BLE stays as the control plane and
this carries the payload. **The app always pulls, the device never pushes**: that way the phone needs
no server. No TLS on purpose (ADR 0003): WPA2 already encrypts the air and the data is not sensitive;
the IP and the port travel through the GATT `status` characteristic.

Stdlib and one thread, no dependencies: `ThreadingHTTPServer` serves on its own thread and the BLE
asyncio loop never notices. Capture and status reading are passed in as callables.

    GET  /health           status JSON (the same one as the `status` characteristic)
    GET  /measure/<bytes>  <bytes> random bytes, to measure the download without a camera
    GET  /photos/latest    captures now and returns the JPEG (1024 px, q70); 503 without a camera
    POST /audio            stores the body (MP3/WAV) to play it; 202 with the size
"""

from __future__ import annotations

import base64
import binascii
import json
import logging
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable, Optional

log = logging.getLogger(__name__)

DEFAULT_PORT = 8080
MEASURE_MAX_BYTES = 5_000_000
AUDIO_MAX_BYTES = 5_000_000
AUDIO_DIRECTORY = "/tmp/virovision-audio"

SyncCapture = Callable[[], bytes]


class HttpServer:
    def __init__(
        self,
        read_status: Callable[[], dict],
        synthetic_payload: Callable[[int], bytes],
        capture: Optional[SyncCapture],
        port: int = DEFAULT_PORT,
        play: Optional[Callable[[str], None]] = None,
    ) -> None:
        server = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"
            server_version = "ViroVision/0.1"

            def log_message(self, fmt, *args):  # noqa: N802 — logging goes through logging, not stderr
                log.info("%s %s", self.address_string(), fmt % args)

            def _respond(self, code: int, body: bytes, content_type: str) -> None:
                self.send_response(code)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)

            def _json(self, code: int, obj: dict) -> None:
                self._respond(code, json.dumps(obj, ensure_ascii=False).encode(), "application/json; charset=utf-8")

            def do_GET(self):  # noqa: N802
                path = self.path.split("?", 1)[0]
                if path == "/health":
                    self._json(200, server._read_status())
                elif path.startswith("/measure/"):
                    try:
                        amount = int(path[len("/measure/") :])
                    except ValueError:
                        self._json(400, {"error": "invalid bytes"})
                        return
                    if not 0 <= amount <= MEASURE_MAX_BYTES:
                        self._json(400, {"error": f"bytes out of range (0-{MEASURE_MAX_BYTES})"})
                        return
                    self._respond(200, server._synthetic_payload(amount), "application/octet-stream")
                elif path == "/photos/latest":
                    if server._capture is None:
                        self._json(503, {"error": "no camera"})
                        return
                    t0 = time.monotonic()
                    try:
                        jpeg = server._capture()
                    except TimeoutError as exc:
                        # The camera jammed: we say so right away (the app would wait 20 s) and the
                        # camera is already restarting on the device's side.
                        self._json(504, {"error": str(exc)[:200]})
                        return
                    except Exception as exc:  # the camera fails in varied ways; the client deserves a 500 and not a cut socket
                        log.exception("capture failed")
                        self._json(500, {"error": str(exc)[:200]})
                        return
                    log.info("photo of %d bytes captured in %d ms", len(jpeg), (time.monotonic() - t0) * 1000)
                    self._respond(200, jpeg, "image/jpeg")
                else:
                    self._json(404, {"error": "not found"})

            def do_POST(self):  # noqa: N802
                path = self.path.split("?", 1)[0]
                if path != "/audio":
                    self._json(404, {"error": "not found"})
                    return
                length = int(self.headers.get("Content-Length") or 0)
                if not 0 < length <= AUDIO_MAX_BYTES:
                    self._json(400, {"error": f"Content-Length out of range (1-{AUDIO_MAX_BYTES})"})
                    return
                body = self.rfile.read(length)
                # React Native's `fetch` does not send raw bytes: the app sends the MP3 as base64 and
                # says so with this header. A client like curl sends the bytes as they are.
                if (self.headers.get("X-Encoding") or "").lower() == "base64":
                    try:
                        body = base64.b64decode(body, validate=True)
                    except (binascii.Error, ValueError):
                        self._json(400, {"error": "invalid base64"})
                        return
                content_type = self.headers.get("Content-Type", "application/octet-stream")
                extension = "mp3" if "mpeg" in content_type or "mp3" in content_type else "wav" if "wav" in content_type else "bin"
                os.makedirs(AUDIO_DIRECTORY, exist_ok=True)
                file_path = os.path.join(AUDIO_DIRECTORY, f"audio-{int(time.time() * 1000)}.{extension}")
                with open(file_path, "wb") as f:
                    f.write(body)
                log.info("audio received: %d bytes (%s) → %s", length, content_type, file_path)
                if server._play is not None:
                    try:
                        server._play(file_path)
                    except Exception as exc:
                        log.warning("could not play %s: %s", file_path, exc)
                self._json(202, {"bytes": len(body), "file": file_path, "played": server._play is not None})

        self._read_status = read_status
        self._synthetic_payload = synthetic_payload
        self._capture = capture
        self._play = play
        self._server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
        self._server.daemon_threads = True
        self._thread: Optional[threading.Thread] = None

    @property
    def port(self) -> int:
        return self._server.server_address[1]

    def start(self) -> None:
        self._thread = threading.Thread(target=self._server.serve_forever, name="http", daemon=True)
        self._thread.start()
        log.info("HTTP listening on port %d", self.port)

    def stop(self) -> None:
        self._server.shutdown()
        self._server.server_close()
