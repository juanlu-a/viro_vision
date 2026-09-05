/**
 * Perfil GATT del dispositivo ViroVision (canal BLE de datos y control).
 *
 * FUENTE DE VERDAD COMPARTIDA con la placa: `hardware/raspi/virovision/gatt.py` tiene estos mismos
 * UUIDs copiados a mano. Si cambia algo acá, cambia allá en el mismo PR.
 *
 * Son UUIDs de 128 bits generados al azar (`uuidgen`), con el 3.er y 4.º byte como índice de la
 * característica. Los placeholders anteriores (0000fffX-0000-1000-8000-00805f9b34fb) estaban en el
 * rango de los UUIDs de 16 bits que asigna el Bluetooth SIG: ahí no se puede inventar.
 *
 * Qué viaja por dónde (ADR 0003): BLE es el plano de control, siempre vivo, porque es lo único que
 * puede despertar a la app con el teléfono bloqueado en el bolsillo. Si la foto viaja también por
 * acá o por WiFi lo decide la medición que dispara el comando `medir` (ver `services/ble`).
 */
export const GATT = {
  serviceUuid: '4380c500-7ca3-4e37-b27d-f60e8d8d73d1',
  characteristics: {
    /** read · notify · write — uint8: 0 esperando, 1 ómnibus, 2 supermercado (ADR 0007). */
    modo: '4380c501-7ca3-4e37-b27d-f60e8d8d73d1',
    /** write — JSON `{ cmd: 'medir' | 'foto' | 'modo' | 'estado', ... }`. */
    control: '4380c502-7ca3-4e37-b27d-f60e8d8d73d1',
    /** notify — JSON ≤ 180 bytes: `{ t: 'inicio' | 'fin' | 'modo' | 'error' | 'resultado', ... }`. */
    evento: '4380c503-7ca3-4e37-b27d-f60e8d8d73d1',
    /** notify — binario: header de 4 bytes (`seq` u16 LE, `total` u16 LE) + datos. */
    transferencia: '4380c504-7ca3-4e37-b27d-f60e8d8d73d1',
    /** read · notify — JSON: `version`, `temp`, `uptime`, `bateria` (null hoy), `camara`, `wifi`. */
    estado: '4380c505-7ca3-4e37-b27d-f60e8d8d73d1',
  },
} as const;

/** Nombre local que anuncia el dispositivo; el escaneo filtra por el UUID del servicio, esto es para mostrar. */
export const DEVICE_ADVERTISED_NAME = 'ViroVision';

/** Lo que la placa publica en `estado`. Espejo de `hardware/raspi/virovision/estado.py`. */
export interface EstadoDispositivo {
  version: string;
  temp: number | null;
  uptime: number;
  bateria: number | null;
  camara: boolean;
  wifi: boolean;
}
