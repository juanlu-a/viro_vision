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
    /** read · notify — JSON: `version`, `temp`, `uptime`, `bateria` (null hoy), `camara`, `wifi`, `ip`, `puerto`, `ap`. */
    estado: '4380c505-7ca3-4e37-b27d-f60e8d8d73d1',
    /** read — JSON `{ ssid, clave, ip, puerto }` del punto de acceso de la placa; `{}` si no tiene. */
    wifi: '4380c506-7ca3-4e37-b27d-f60e8d8d73d1',
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
  /** IP de la placa en la red WiFi, o null sin red. De acá baja la foto la app (ADR 0003, plan B). */
  ip: string | null;
  /** Puerto del servidor HTTP de la placa, o null si no está corriendo. */
  puerto: number | null;
  /** True mientras la placa es punto de acceso: entonces `ip` es la del AP (10.42.0.1). */
  ap: boolean;
}

/**
 * Credenciales del punto de acceso de la placa (ADR 0003, plan B). La app las lee por BLE y se une
 * sola: el usuario no configura ningún WiFi. Sin secreto a propósito: WPA2 cifra el aire y los
 * datos no son sensibles.
 */
export interface CredencialesWifi {
  ssid: string;
  clave: string;
  ip: string;
  puerto: number | null;
}

/** Modo de operación como lo codifica la placa en la característica `modo` (ADR 0007). */
export const MODO_GATT = { esperando: 0, omnibus: 1, supermercado: 2 } as const;
export const MODO_DESDE_GATT = ['esperando', 'omnibus', 'supermercado'] as const;
