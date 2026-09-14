"""Prende y apaga el punto de acceso de la placa por BLE, desde la Mac.

Existe para **entrar a la placa sin la microSD**. En modo producto la placa levanta su AP y deja la
WiFi de casa, así que no hay SSH; sacar la tarjeta para crear `SIN-AP` obliga a apagarla y abrir la
caja. Los pendientes del repo ya nombraban este camino —«apagar el AP por BLE desde la Mac con la
app cerrada»— pero no había con qué. Esto es con qué.

No es un truco: `AccessPoint.turn_off()` llama a `nmcli device connect wlan0` a propósito, para que
la placa vuelva sola a la red conocida.

```sh
cd hardware/raspi
./.venv-mac/bin/python tools/ap.py --status   # sólo mira
./.venv-mac/bin/python tools/ap.py            # apaga el AP -> vuelve a la WiFi de casa -> hay SSH
./.venv-mac/bin/python tools/ap.py --on       # lo vuelve a encender (20 min)
```

**La app del teléfono tiene que estar cerrada.** Mientras una central está conectada la placa deja
de anunciar y el escaneo no la encuentra — que es, además, el mismo motivo por el que la app aprendió
a mirar primero lo que ya está conectado al sistema (ADR 0003, act. 2026-09-13).

De paso deja una contraprueba del ADR: esto lee `status` y escribe en `control` **sin emparejarse**.
Si alguna vez hiciera falta un vínculo para que funcione, es que alguien le puso autenticación a una
característica y hay que discutirlo.

La primera corrida pide permiso de Bluetooth para la terminal (macOS). Sin él, el escaneo devuelve
vacío sin ningún error: si «no aparece» y la placa está prendida al lado, es eso.
"""

import asyncio
import json
import sys

from bleak import BleakClient, BleakScanner

SERVICE = "4380c500-7ca3-4e37-b27d-f60e8d8d73d1"
CH_CONTROL = "4380c502-7ca3-4e37-b27d-f60e8d8d73d1"
CH_STATUS = "4380c505-7ca3-4e37-b27d-f60e8d8d73d1"
CH_WIFI = "4380c506-7ca3-4e37-b27d-f60e8d8d73d1"


async def main() -> int:
    turn_on = "--on" in sys.argv
    only_status = "--status" in sys.argv

    print("Buscando la placa por su service UUID (hasta 20 s)...")
    device = await BleakScanner.find_device_by_filter(
        lambda d, ad: SERVICE.lower() in [u.lower() for u in (ad.service_uuids or [])],
        timeout=20.0,
    )
    if device is None:
        print("\nNo apareció.  Puede ser:")
        print("  - la placa está apagada o fuera de alcance;")
        print("  - la app del teléfono la tiene conectada (una central conectada deja de anunciar);")
        print("  - la Mac no tiene permiso de Bluetooth para la terminal (Ajustes > Privacidad).")
        return 1

    print(f"Encontrada: {device.name or 'ViroVision'}  [{device.address}]")
    async with BleakClient(device) as client:
        status = json.loads((await client.read_gatt_char(CH_STATUS)).decode())
        print("\nEstado actual:")
        print(f"  version  {status.get('version')}")
        print(f"  ap       {status.get('ap')}")
        print(f"  ip       {status.get('ip')}:{status.get('port')}")
        print(f"  camara   {status.get('camera')}")
        try:
            print(f"  wifi     {json.loads((await client.read_gatt_char(CH_WIFI)).decode())}")
        except Exception:
            pass

        if only_status:
            return 0

        command = {"cmd": "ap", "value": True, "minutes": 20} if turn_on else {"cmd": "ap", "value": False}
        print(f"\nMandando {command} ...")
        await client.write_gatt_char(CH_CONTROL, json.dumps(command).encode(), response=True)

        # `nmcli con up/down` + `device connect wlan0` tarda varios segundos; la placa avisa por
        # `status`, pero acá alcanza con volver a leerlo.
        for attempt in range(12):
            await asyncio.sleep(5)
            try:
                status = json.loads((await client.read_gatt_char(CH_STATUS)).decode())
            except Exception as exc:
                print(f"  (se cortó el enlace: {exc}) — normal si la radio se reconfiguró")
                break
            print(f"  [{(attempt + 1) * 5:>3}s] ap={status.get('ap')}  ip={status.get('ip')}")
            if status.get("ap") is turn_on and status.get("ip"):
                break

    print("\nListo.  Si el AP quedó apagado, la placa tiene que estar volviendo a la WiFi de casa.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
