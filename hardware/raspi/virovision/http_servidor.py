"""Servidor HTTP de la placa: el camino de la foto por WiFi (plan B del ADR 0003).

Medido el 2026-09-05: por BLE los 53 KB de la foto tardan 4,5 s (una notificación por intervalo de
15 ms, controlador sin DLE); por HTTP sobre la misma radio WiFi, 46 ms. BLE queda como plano de
control y esto lleva el payload. **La app siempre tira, la placa nunca empuja**: así el teléfono no
necesita servidor. Sin TLS a propósito (ADR 0003): WPA2 ya cifra el aire y los datos no son
sensibles; la IP y el puerto viajan por la característica `estado` del GATT.

Stdlib y un hilo, sin dependencias: `ThreadingHTTPServer` atiende en su propio hilo y el loop
asyncio del BLE no se entera. Captura y lectura de estado se le pasan como callables.

    GET  /salud            JSON de estado (el mismo que la característica `estado`)
    GET  /medir/<bytes>    <bytes> aleatorios, para medir la descarga sin cámara
    GET  /fotos/ultima     captura ahora y devuelve el JPEG (1024 px, q70); 503 sin cámara
    POST /audio            guarda el cuerpo (MP3/WAV) para reproducirlo; 202 con el tamaño
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

PUERTO_POR_DEFECTO = 8080
MEDIR_MAX_BYTES = 5_000_000
AUDIO_MAX_BYTES = 5_000_000
DIRECTORIO_AUDIO = "/tmp/virovision-audio"

CapturarSync = Callable[[], bytes]


class ServidorHttp:
    def __init__(
        self,
        leer_estado: Callable[[], dict],
        payload_sintetico: Callable[[int], bytes],
        capturar: Optional[CapturarSync],
        puerto: int = PUERTO_POR_DEFECTO,
        reproducir: Optional[Callable[[str], None]] = None,
    ) -> None:
        servidor = self

        class Manejador(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"
            server_version = "ViroVision/0.1"

            def log_message(self, formato, *args):  # noqa: N802 — el log va por logging, no por stderr
                log.info("%s %s", self.address_string(), formato % args)

            def _responder(self, codigo: int, cuerpo: bytes, tipo: str) -> None:
                self.send_response(codigo)
                self.send_header("Content-Type", tipo)
                self.send_header("Content-Length", str(len(cuerpo)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(cuerpo)

            def _json(self, codigo: int, obj: dict) -> None:
                self._responder(codigo, json.dumps(obj, ensure_ascii=False).encode(), "application/json; charset=utf-8")

            def do_GET(self):  # noqa: N802
                ruta = self.path.split("?", 1)[0]
                if ruta == "/salud":
                    self._json(200, servidor._leer_estado())
                elif ruta.startswith("/medir/"):
                    try:
                        cantidad = int(ruta[len("/medir/") :])
                    except ValueError:
                        self._json(400, {"error": "bytes inválidos"})
                        return
                    if not 0 <= cantidad <= MEDIR_MAX_BYTES:
                        self._json(400, {"error": f"bytes fuera de rango (0-{MEDIR_MAX_BYTES})"})
                        return
                    self._responder(200, servidor._payload_sintetico(cantidad), "application/octet-stream")
                elif ruta == "/fotos/ultima":
                    if servidor._capturar is None:
                        self._json(503, {"error": "sin cámara"})
                        return
                    t0 = time.monotonic()
                    try:
                        jpeg = servidor._capturar()
                    except TimeoutError as exc:
                        # La cámara se trabó: se lo decimos enseguida (la app esperaría 20 s) y la
                        # cámara ya se está reiniciando del lado de la placa.
                        self._json(504, {"error": str(exc)[:200]})
                        return
                    except Exception as exc:  # la cámara falla de formas variadas; el cliente merece un 500 y no un socket cortado
                        log.exception("captura fallida")
                        self._json(500, {"error": str(exc)[:200]})
                        return
                    log.info("foto de %d bytes capturada en %d ms", len(jpeg), (time.monotonic() - t0) * 1000)
                    self._responder(200, jpeg, "image/jpeg")
                else:
                    self._json(404, {"error": "no existe"})

            def do_POST(self):  # noqa: N802
                ruta = self.path.split("?", 1)[0]
                if ruta != "/audio":
                    self._json(404, {"error": "no existe"})
                    return
                largo = int(self.headers.get("Content-Length") or 0)
                if not 0 < largo <= AUDIO_MAX_BYTES:
                    self._json(400, {"error": f"Content-Length fuera de rango (1-{AUDIO_MAX_BYTES})"})
                    return
                cuerpo = self.rfile.read(largo)
                # `fetch` de React Native no manda bytes crudos: la app envía el MP3 en base64 y lo
                # dice con este header. Un cliente como curl manda los bytes tal cual.
                if (self.headers.get("X-Encoding") or "").lower() == "base64":
                    try:
                        cuerpo = base64.b64decode(cuerpo, validate=True)
                    except (binascii.Error, ValueError):
                        self._json(400, {"error": "base64 inválido"})
                        return
                tipo = self.headers.get("Content-Type", "application/octet-stream")
                extension = "mp3" if "mpeg" in tipo or "mp3" in tipo else "wav" if "wav" in tipo else "bin"
                os.makedirs(DIRECTORIO_AUDIO, exist_ok=True)
                archivo = os.path.join(DIRECTORIO_AUDIO, f"audio-{int(time.time() * 1000)}.{extension}")
                with open(archivo, "wb") as f:
                    f.write(cuerpo)
                log.info("audio recibido: %d bytes (%s) → %s", largo, tipo, archivo)
                if servidor._reproducir is not None:
                    try:
                        servidor._reproducir(archivo)
                    except Exception as exc:
                        log.warning("no pude reproducir %s: %s", archivo, exc)
                self._json(202, {"bytes": len(cuerpo), "archivo": archivo, "reproducido": servidor._reproducir is not None})

        self._leer_estado = leer_estado
        self._payload_sintetico = payload_sintetico
        self._capturar = capturar
        self._reproducir = reproducir
        self._servidor = ThreadingHTTPServer(("0.0.0.0", puerto), Manejador)
        self._servidor.daemon_threads = True
        self._hilo: Optional[threading.Thread] = None

    @property
    def puerto(self) -> int:
        return self._servidor.server_address[1]

    def iniciar(self) -> None:
        self._hilo = threading.Thread(target=self._servidor.serve_forever, name="http", daemon=True)
        self._hilo.start()
        log.info("HTTP escuchando en el puerto %d", self.puerto)

    def parar(self) -> None:
        self._servidor.shutdown()
        self._servidor.server_close()
