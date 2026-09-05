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

log = logging.getLogger(__name__)

LADO_MAYOR_MAX = 1024
CALIDAD_JPEG = 70


class Camara:
    def __init__(self, lado_mayor: int = LADO_MAYOR_MAX, calidad: int = CALIDAD_JPEG) -> None:
        self._lado_mayor = lado_mayor
        self._calidad = calidad
        self._picam = None

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

    def capturar_jpeg(self) -> bytes:
        """Bloqueante (~300-500 ms en la Zero 2 W): llamar desde un executor."""
        if self._picam is None:
            raise RuntimeError("cámara no iniciada")
        buffer = io.BytesIO()
        self._picam.capture_file(buffer, format="jpeg")
        return buffer.getvalue()


def payload_sintetico(cantidad_bytes: int) -> bytes:
    return os.urandom(cantidad_bytes)
