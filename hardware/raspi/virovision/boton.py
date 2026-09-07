"""Botón físico en un GPIO (ADR 0007).

El único control que el usuario tiene en la placa. Desde *esperando*: **1 click** = modo ómnibus,
**2 clicks** = modo supermercado; **mantenerlo apretado** = volver a esperando desde donde sea. No
hay pantalla ni indicador: cada transición se anuncia por audio, así que un click mal interpretado
deja al usuario sin saber en qué modo está. Por eso los tiempos son explícitos y medibles, y la
lógica que los usa se testea entera en la Mac.

El reparto de responsabilidades es el que pide `modos.py`: ahí vive *qué* hace cada gesto, acá vive
*cómo* se reconoce el gesto. `DetectorDeClicks` es puro (no sabe de GPIO ni de reloj) y `Boton` lo
conecta a gpiozero.
"""

from __future__ import annotations

import logging
from typing import Callable, Optional, Protocol

log = logging.getLogger(__name__)

# GPIO 5 = pin físico 29, con su GND en el pin 30 justo al lado: dos pines contiguos, que es lo que
# hace el cableado a prueba de errores. Pull-up interno y el botón a masa, sin resistencia externa.
GPIO_POR_DEFECTO = 5

# Los tres tiempos, a calibrar con el hardware real y con los ojos cerrados (que es como se usa).
# El rebote mecánico de un tact switch 6x6 está en el orden de los 10 ms; 50 da margen sin que se
# sienta lento.
REBOTE_S = 0.05
# Cuánto hay que mantenerlo para que cuente como "salir del modo". Bastante más largo que un click
# normal: salir por accidente es peor que tener que insistir, porque deja al usuario sin el modo que
# creía tener.
UMBRAL_LARGO_S = 0.8
# Cuánto se espera después de soltar antes de decidir cuántos clicks fueron. Es el precio del doble
# click: un click simple tarda esto en aplicarse.
VENTANA_DOBLE_CLICK_S = 0.4


class _Cancelable(Protocol):
    def cancel(self) -> None: ...


# Agenda una función para dentro de N segundos y devuelve algo que se puede cancelar. En la placa es
# `loop.call_later`; en los tests, un reloj falso.
Programar = Callable[[float, Callable[[], None]], _Cancelable]


class DetectorDeClicks:
    """Traduce pulsaciones en intención: "fueron N clicks" o "lo mantuvo apretado".

    No toca hardware ni mira el reloj: el driver le avisa qué pasó y le presta un `programar`. Así
    los tiempos se prueban sin esperarlos y sin placa (el README de la placa: en la Mac se testea
    sólo lo puro).

    Un click largo NO cuenta además como click: al soltar después de mantener, la pulsación ya se
    consumió. Si no, salir de un modo dispararía inmediatamente el modo ómnibus.
    """

    def __init__(
        self,
        al_hacer_clicks: Callable[[int], None],
        al_mantener: Callable[[], None],
        programar: Programar,
        ventana_s: float = VENTANA_DOBLE_CLICK_S,
    ) -> None:
        self._al_hacer_clicks = al_hacer_clicks
        self._al_mantener = al_mantener
        self._programar = programar
        self._ventana_s = ventana_s
        self._clicks = 0
        self._fue_largo = False
        self._pendiente: Optional[_Cancelable] = None

    def presionado(self) -> None:
        self._fue_largo = False

    def mantenido(self) -> None:
        """Se cumplió el umbral de mantenido, con el botón todavía apretado. Se actúa acá y no al
        soltar: el usuario necesita el anuncio de audio en el momento en que el gesto se cumple, no
        cuando decide levantar el dedo."""
        self._fue_largo = True
        self._olvidar_pendiente()
        self._clicks = 0
        self._al_mantener()

    def soltado(self) -> None:
        if self._fue_largo:
            self._fue_largo = False
            return
        self._clicks += 1
        self._olvidar_pendiente()
        self._pendiente = self._programar(self._ventana_s, self._resolver)

    def _resolver(self) -> None:
        clicks, self._clicks = self._clicks, 0
        self._pendiente = None
        if clicks:
            self._al_hacer_clicks(clicks)

    def _olvidar_pendiente(self) -> None:
        if self._pendiente is not None:
            self._pendiente.cancel()
            self._pendiente = None


class Boton:
    """Conecta un pulsador de un GPIO al núcleo.

    gpiozero llama a sus callbacks desde su propio hilo, así que todo entra al loop de asyncio con
    `call_soon_threadsafe` y el detector corre siempre en el hilo del loop. Sin eso, dos gestos
    seguidos podrían pisarse el contador de clicks.
    """

    def __init__(
        self,
        loop,
        al_hacer_clicks: Callable[[int], None],
        al_mantener: Callable[[], None],
        gpio: int = GPIO_POR_DEFECTO,
        umbral_largo_s: float = UMBRAL_LARGO_S,
        ventana_s: float = VENTANA_DOBLE_CLICK_S,
        rebote_s: float = REBOTE_S,
    ) -> None:
        # gpiozero se importa acá y no arriba: en la Mac (tests y emulador) no está instalado, y este
        # módulo tiene que poder importarse igual.
        from gpiozero import Button  # type: ignore[import-not-found]

        self._detector = DetectorDeClicks(al_hacer_clicks, al_mantener, loop.call_later, ventana_s)
        # pull_up: el pulsador va del GPIO a masa, sin resistencia externa.
        self._boton = Button(gpio, pull_up=True, bounce_time=rebote_s, hold_time=umbral_largo_s)
        self._boton.when_pressed = lambda: loop.call_soon_threadsafe(self._detector.presionado)
        self._boton.when_held = lambda: loop.call_soon_threadsafe(self._detector.mantenido)
        self._boton.when_released = lambda: loop.call_soon_threadsafe(self._detector.soltado)
        log.info(
            "botón en GPIO %d (largo %.1fs, doble click %.1fs, rebote %dms)",
            gpio, umbral_largo_s, ventana_s, int(rebote_s * 1000),
        )

    def cerrar(self) -> None:
        self._boton.close()


def intentar_conectar(loop, al_hacer_clicks, al_mantener, gpio: int = GPIO_POR_DEFECTO) -> Optional[Boton]:
    """El botón es opcional: sin él la app sigue mandando modos por BLE. Una placa sin gpiozero, sin
    permisos sobre el GPIO o sin botón soldado tiene que arrancar igual, no quedarse sin daemon."""
    try:
        return Boton(loop, al_hacer_clicks, al_mantener, gpio=gpio)
    except Exception as exc:  # noqa: BLE001 — gpiozero levanta de todo según por qué falle el pin
        log.warning("sin botón físico (GPIO %d): %s", gpio, exc)
        return None
