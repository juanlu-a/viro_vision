"""Perfil GATT del dispositivo ViroVision: UUIDs y nombre anunciado. Sin dependencias, para que lo
importen por igual el adaptador BlueZ de la placa (`gatt.py`) y el emulador CoreBluetooth de la Mac
(`emulador.py`).

FUENTE DE VERDAD COMPARTIDA con la app: `app/src/features/device/gatt.ts` tiene estos mismos UUIDs
copiados a mano. Si cambia algo acá, cambia allá en el mismo PR. Son UUIDs de 128 bits generados al
azar (`uuidgen`), con el 3.er y 4.º byte como índice de característica; el rango 0000xxxx-0000-1000-
8000-00805f9b34fb de los placeholders viejos es el de los UUIDs de 16 bits asignados por el Bluetooth
SIG y no se puede inventar ahí.
"""

from .nucleo import ESTADO, EVENTO, MODO, TRANSFERENCIA

SERVICE_UUID = "4380c500-7ca3-4e37-b27d-f60e8d8d73d1"
CH_MODO = "4380c501-7ca3-4e37-b27d-f60e8d8d73d1"
CH_CONTROL = "4380c502-7ca3-4e37-b27d-f60e8d8d73d1"
CH_EVENTO = "4380c503-7ca3-4e37-b27d-f60e8d8d73d1"
CH_TRANSFERENCIA = "4380c504-7ca3-4e37-b27d-f60e8d8d73d1"
CH_ESTADO = "4380c505-7ca3-4e37-b27d-f60e8d8d73d1"
# Credenciales del punto de acceso de la placa (plan B, ADR 0003): la app las lee por BLE y se une
# sola al WiFi; el usuario no configura nada.
CH_WIFI = "4380c506-7ca3-4e37-b27d-f60e8d8d73d1"

UUID_POR_NOMBRE = {MODO: CH_MODO, EVENTO: CH_EVENTO, TRANSFERENCIA: CH_TRANSFERENCIA, ESTADO: CH_ESTADO}

NOMBRE_ANUNCIADO = "ViroVision"
