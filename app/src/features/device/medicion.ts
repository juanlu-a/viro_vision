/**
 * Texto de una medición de transferencia BLE, único para pantalla y voz: lo que se lee es lo que se
 * oye. Puro y separado del hook para poder testearlo (no hay testing-library en el proyecto).
 */
import { strings } from '@/i18n';
import type { MedicionTransferencia } from '@/services/ble/transferencia';

/** La foto que la app manda hoy a la nube pesa esto (1024 px, JPEG 0,7). Ver ADR 0003. */
export const BYTES_FOTO_REFERENCIA = 53_000;

/** Umbral del ADR 0003: si la foto de referencia baja en menos de esto, BLE alcanza y no hay WiFi. */
export const UMBRAL_MS = 2_000;

function coma(n: number, decimales: number): string {
  return n.toFixed(decimales).replace('.', ',');
}

export function describirMedicion(m: MedicionTransferencia): string {
  const kb = coma(m.bytes / 1000, m.bytes % 1000 === 0 ? 0 : 1);
  return strings.connect.measureResult
    .replace('{kb}', kb)
    .replace('{segundos}', coma(m.ms / 1000, 2))
    .replace('{kbps}', coma(m.kbps, 1))
    .replace('{chunks}', String(m.chunks))
    .replace('{chunk}', String(m.chunkBytes));
}
