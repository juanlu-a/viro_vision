"""Hace que la placa diga un aviso de sistema, por BLE, desde la Mac.

Existe por lo que pasó el 2026-09-16. Los avisos de sistema (ADR 0003, act. 2026-09-16) recorren un
camino largo —ajuste en la app → `notify` → escritura en `control` → `notices.py` → `aplay`— y
**cada eslabón falla en silencio**: un clip que no está, un nombre mal escrito, un daemon viejo que
no conoce el comando. Sin esto, la única forma de probarlo era instalar un build en el teléfono y
ponerse los anteojos, y ahí ya no se distingue cuál de los eslabones se cortó.

Es la contraparte de `ap.py` y comparte su forma: lee `status`, escribe en `control`, sin emparejarse.

```sh
cd hardware/raspi
./.venv-mac/bin/python tools/say.py                    # connected.wav
./.venv-mac/bin/python tools/say.py mode_bus.wav       # uno en particular
./.venv-mac/bin/python tools/say.py --all              # los diez, en fila
./.venv-mac/bin/python tools/say.py --list             # qué nombres acepta la placa
```

**La app del teléfono tiene que estar cerrada**, por el mismo motivo que en `ap.py`: mientras una
central está conectada la placa deja de anunciar y el escaneo no la encuentra.

Un nombre que la placa no conoce vuelve como evento `error` en vez de romper nada, y eso también es
parte de lo que conviene ver funcionando.
"""

import asyncio
import json
import sys
from pathlib import Path

from bleak import BleakClient, BleakScanner

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from virovision.notices import CLIPS, EARCON_FILE, NOTICES  # noqa: E402

SERVICE = "4380c500-7ca3-4e37-b27d-f60e8d8d73d1"
CH_CONTROL = "4380c502-7ca3-4e37-b27d-f60e8d8d73d1"
CH_EVENT = "4380c503-7ca3-4e37-b27d-f60e8d8d73d1"

# Lo que tarda un aviso en decirse. Los clips van de 0,1 s (el chirp) a 4 s (la frase de prueba de
# audio); con menos que esto, `--all` los pisa entre sí y no se escucha ninguno entero.
BETWEEN_CLIPS_S = 4.5


def listing() -> str:
    lines = [f"  {clip:<24} {text}" for clip, text in sorted(NOTICES.items())]
    lines.append(f"  {EARCON_FILE:<24} (el chirp del botón, no es una frase)")
    return "\n".join(lines)


async def main() -> int:
    if "--list" in sys.argv:
        print(listing())
        return 0

    every = "--all" in sys.argv
    asked = [a for a in sys.argv[1:] if not a.startswith("--")]
    clips = sorted(CLIPS) if every else (asked or ["connected.wav"])

    unknown = [c for c in clips if c not in CLIPS]
    if unknown:
        # Atajado acá y no en la placa: mandar un nombre inventado prueba el rechazo, pero un error
        # de tipeo mientras se depura otra cosa sólo confunde.
        print(f"la placa no conoce: {', '.join(unknown)}\n\nacepta:\n{listing()}")
        return 2

    print("buscando la placa (la app del teléfono tiene que estar cerrada)…")
    device = await BleakScanner.find_device_by_filter(
        lambda d, ad: SERVICE in (ad.service_uuids or []), timeout=15.0
    )
    if device is None:
        print("no apareció: ¿está prendida, y la app cerrada?")
        return 1

    async with BleakClient(device) as client:
        errors: list = []

        def on_event(_, data: bytearray) -> None:
            try:
                event = json.loads(data.decode())
            except (UnicodeDecodeError, json.JSONDecodeError):
                return
            if event.get("t") == "error":
                errors.append(event.get("msg", ""))
                print(f"  ← la placa avisa: {event.get('msg')}")

        await client.start_notify(CH_EVENT, on_event)
        for clip in clips:
            print(f"→ {clip}")
            # `response=False`: es la misma escritura sin respuesta que usa la app, así que lo que se
            # prueba acá es el camino de verdad y no uno parecido.
            await client.write_gatt_char(
                CH_CONTROL, json.dumps({"cmd": "say", "clip": clip}).encode(), response=False
            )
            await asyncio.sleep(BETWEEN_CLIPS_S if len(clips) > 1 else 1.5)
        await client.stop_notify(CH_EVENT)

        if errors:
            print(f"\n{len(errors)} aviso(s) de error de la placa: algo del camino no está en su lugar")
            return 1
    print("\nsin errores de la placa: escuchá si salió por el parlante")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
