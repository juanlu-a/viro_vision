"""Máquina de modos de operación (ADR 0007).

Desde *esperando*: 1 click = modo ómnibus, 2 clicks = modo supermercado; click largo desde
cualquier modo = volver a esperando. Nunca "siempre prendido": anunciar todo lo que la cámara ve,
todo el tiempo, aturde. El debounce del botón físico (umbral de click largo, ventana de doble
click) no vive acá: se define con hardware real y llama a `desde_clicks` / `click_largo`.
"""

from __future__ import annotations

from enum import IntEnum


class Modo(IntEnum):
    ESPERANDO = 0
    OMNIBUS = 1
    SUPERMERCADO = 2


class MaquinaDeModos:
    def __init__(self) -> None:
        self.actual = Modo.ESPERANDO

    def cambiar(self, nuevo: Modo) -> bool:
        """Cambia de modo. Devuelve True si hubo transición (para anunciarla: el usuario no tiene
        otro indicador de estado que el audio)."""
        if nuevo == self.actual:
            return False
        self.actual = nuevo
        return True

    def desde_clicks(self, clicks: int) -> bool:
        # Los clicks sólo eligen modo desde esperando; dentro de un modo, el click corto queda libre
        # para disparar una lectura, y salir es siempre el click largo.
        if self.actual is not Modo.ESPERANDO:
            return False
        if clicks == 1:
            return self.cambiar(Modo.OMNIBUS)
        if clicks == 2:
            return self.cambiar(Modo.SUPERMERCADO)
        return False

    def click_largo(self) -> bool:
        return self.cambiar(Modo.ESPERANDO)
