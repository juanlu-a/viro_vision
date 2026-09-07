"""Captura de la Camera Module 3 con picamera2, o una fuente sintética si no hay cámara.

La foto sale ya reducida a 1024 px de lado mayor y JPEG a calidad 70, espejo exacto de lo que la
app hace hoy antes de subir a la nube (`app/src/services/camera/redimension.ts`, `captura.ts`):
así lo que se mide por BLE es lo que viajaría de verdad (~53 KB), y el escalado lo hace el ISP,
no Python. Sin cámara, `medir` manda bytes aleatorios del tamaño pedido: el throughput no mira el
contenido y así el spike corre en una placa pelada.
"""

from __future__ import annotations

import io
import logging
import os
import threading

log = logging.getLogger(__name__)

LADO_MAYOR_MAX = 1024
CALIDAD_JPEG = 70
# Una captura normal tarda 200-500 ms; 8 s es "algo se trabó", no "está lenta". La app espera 20.
CAPTURA_TIMEOUT_S = 8.0


class Camara:
    def __init__(self, lado_mayor: int = LADO_MAYOR_MAX, calidad: int = CALIDAD_JPEG) -> None:
        self._lado_mayor = lado_mayor
        self._calidad = calidad
        self._picam = None
        # Una captura a la vez: BLE (`foto`) y HTTP (`/fotos/ultima`) pueden pedir a la vez.
        self._lock = threading.Lock()

    @property
    def disponible(self) -> bool:
        return self._picam is not None

    def iniciar(self) -> bool:
        """Arranca la cámara una sola vez (tarda ~1 s); capturar después es barato. Devuelve False si
        no hay cámara o falta picamera2, y el daemon sigue sin ella."""
        try:
            from picamera2 import Picamera2  # import tardío: en la Mac no existe
        except ImportError:
            log.warning("picamera2 no está instalado; sigo sin cámara")
            return False
        try:
            picam = Picamera2()
            ancho, alto = picam.sensor_resolution
            escala = self._lado_mayor / max(ancho, alto)
            tamano = (int(ancho * escala) // 2 * 2, int(alto * escala) // 2 * 2)
            picam.configure(picam.create_still_configuration(main={"size": tamano}))
            picam.options["quality"] = self._calidad
            picam.start()
            self._picam = picam
            log.info("cámara lista: sensor %dx%d → %dx%d, JPEG q%d", ancho, alto, *tamano, self._calidad)
            return True
        except Exception as exc:  # picamera2 lanza de todo cuando no hay cámara conectada
            log.warning("no pude iniciar la cámara (%s); sigo sin ella", exc)
            return False

    def capturar_jpeg(self, timeout_s: float = CAPTURA_TIMEOUT_S) -> bytes:
        """Bloqueante (~200-500 ms en la Zero 2 W): llamar desde un executor.

        Con tope de tiempo: el 2026-09-05 una captura no terminó nunca (la app esperó 20 s y falló) con
        la placa en modo AP. Si vence, se reinicia la cámara para la próxima: un `capture_file` que no
        vuelve deja el pipeline de libcamera trabado hasta cerrar y abrir el sensor, y una captura
        colgada nunca puede dejar sin cámara el resto de la sesión.
        """
        if self._picam is None:
            raise RuntimeError("cámara no iniciada")
        with self._lock:
            picam = self._picam
            resultado: dict = {}

            def capturar():
                try:
                    buffer = io.BytesIO()
                    picam.capture_file(buffer, format="jpeg")
                    resultado["jpeg"] = buffer.getvalue()
                except Exception as exc:  # noqa: BLE001 — se reporta entero al que pidió la foto
                    resultado["error"] = exc

            hilo = threading.Thread(target=capturar, name="captura", daemon=True)
            hilo.start()
            hilo.join(timeout_s)
            if hilo.is_alive():
                log.error("la captura no terminó en %.0f s; reinicio la cámara", timeout_s)
                self._reiniciar()
                raise TimeoutError(f"la cámara no entregó la foto en {timeout_s:.0f} s")
            if "error" in resultado:
                log.error("captura fallida: %s; reinicio la cámara", resultado["error"])
                self._reiniciar()
                raise resultado["error"]
            return resultado["jpeg"]

    def _reiniciar(self) -> None:
        """Cierra y vuelve a abrir el sensor. Si no se puede, la cámara queda como no disponible y el
        daemon sigue (la app cae a la cámara del teléfono)."""
        try:
            if self._picam is not None:
                self._picam.stop()
                self._picam.close()
        except Exception as exc:  # noqa: BLE001
            log.warning("al cerrar la cámara: %s", exc)
        self._picam = None
        self.iniciar()


def payload_sintetico(cantidad_bytes: int) -> bytes:
    return os.urandom(cantidad_bytes)
