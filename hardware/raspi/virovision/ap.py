"""Punto de acceso WiFi de la placa (plan B del ADR 0003) con NetworkManager.

El caso real es la calle o el supermercado, sin WiFi de infraestructura: la placa levanta su AP, el
teléfono se une y baja la foto por HTTP; el teléfono conserva internet por datos móviles (spike de
iOS pendiente). La Zero 2 W tiene UNA radio WiFi: mientras el AP está arriba, la placa no está en
ninguna otra red (se pierde el SSH de desarrollo). Por eso el AP se enciende **por un tiempo
acotado** y vuelve solo a la red conocida: si algo sale mal, la placa se recupera sin tocarla.

Todo por `nmcli`, que ya viene en Raspberry Pi OS. La conexión `virovision-ap` se crea la primera
vez; `ipv4.method shared` da 10.42.0.1 y DHCP sin nada más.
"""

from __future__ import annotations

import logging
import subprocess
from typing import Callable, Optional, Sequence

log = logging.getLogger(__name__)

NOMBRE_CONEXION = "virovision-ap"
SSID = "ViroVision"
# Fija por ahora, y sin pretensión de secreto (ADR 0003: WPA2 cifra el aire, los datos no son
# sensibles). Cuando haya varias unidades, por unidad y publicada por la característica `wifi`.
CLAVE = "virovision2026"
IP_AP = "10.42.0.1"

Ejecutar = Callable[[Sequence[str]], subprocess.CompletedProcess]


def _nmcli(argumentos: Sequence[str]) -> subprocess.CompletedProcess:
    return subprocess.run(["nmcli", *argumentos], capture_output=True, text=True, timeout=30)


class PuntoDeAcceso:
    def __init__(self, ejecutar: Ejecutar = _nmcli, ssid: str = SSID, clave: str = CLAVE) -> None:
        self._ejecutar = ejecutar
        self._ssid = ssid
        self._clave = clave
        self.encendido = False

    def _asegurar_conexion(self) -> None:
        existe = self._ejecutar(["-t", "-f", "NAME", "con", "show"])
        if NOMBRE_CONEXION in (existe.stdout or "").splitlines():
            return
        self._ok(self._ejecutar(["con", "add", "type", "wifi", "ifname", "wlan0", "con-name", NOMBRE_CONEXION,
                                 "autoconnect", "no", "ssid", self._ssid]))
        # 2,4 GHz (band bg): la placa no tiene 5 GHz; y `shared` = NAT + DHCP en 10.42.0.1.
        self._ok(self._ejecutar(["con", "modify", NOMBRE_CONEXION,
                                 "802-11-wireless.mode", "ap", "802-11-wireless.band", "bg",
                                 "ipv4.method", "shared",
                                 "wifi-sec.key-mgmt", "wpa-psk", "wifi-sec.psk", self._clave]))
        log.info("conexión %s creada (ssid %s)", NOMBRE_CONEXION, self._ssid)

    def encender(self) -> None:
        self._asegurar_conexion()
        self._ok(self._ejecutar(["con", "up", NOMBRE_CONEXION]))
        self.encendido = True
        log.info("AP «%s» arriba en %s; la placa dejó su red WiFi anterior", self._ssid, IP_AP)

    def apagar(self) -> None:
        resultado = self._ejecutar(["con", "down", NOMBRE_CONEXION])
        self.encendido = False
        log.info("AP abajo (%s)", "ok" if resultado.returncode == 0 else (resultado.stderr or "").strip()[:120])
        # No confiar en el autoconnect: el 2026-09-06 la placa quedó sin ninguna red después de bajar
        # el AP (el teléfono seguía unido a un AP fantasma y `estado` decía "sin IP"). Se le pide a NM
        # que conecte wlan0 a la mejor red conocida, explícitamente.
        self.reconectar()

    def reconectar(self) -> None:
        """Conecta wlan0 a la red conocida con autoconnect (la de casa, la del laboratorio…)."""
        resultado = self._ejecutar(["-w", "25", "device", "connect", "wlan0"])
        log.info("reconexión a la red conocida: %s", "ok" if resultado.returncode == 0 else (resultado.stderr or resultado.stdout or "").strip()[:160])

    def conexion_activa(self) -> Optional[str]:
        """Nombre de la conexión activa en wlan0, o None. Va al `estado` para que la app (y quien
        depure) sepa en qué red está la placa sin entrar por SSH."""
        try:
            salida = self._ejecutar(["-t", "-f", "NAME,DEVICE", "con", "show", "--active"]).stdout or ""
        except Exception:  # noqa: BLE001
            return None
        for linea in salida.splitlines():
            nombre, _, dispositivo = linea.rpartition(":")
            if dispositivo == "wlan0":
                return nombre
        return None

    @staticmethod
    def _ok(resultado: subprocess.CompletedProcess) -> None:
        if resultado.returncode != 0:
            raise RuntimeError((resultado.stderr or resultado.stdout or "nmcli falló").strip()[:200])

    def credenciales(self) -> dict:
        return {"ssid": self._ssid, "clave": self._clave, "ip": IP_AP}
