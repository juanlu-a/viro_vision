/**
 * Unirse al punto de acceso de la placa sin que el usuario toque Ajustes (ADR 0003, plan B).
 *
 * Envuelve `react-native-wifi-reborn`: en iOS usa `NEHotspotConfigurationManager` (la primera vez
 * el sistema muestra un aviso «¿Quieres conectarte a ViroVision?» que VoiceOver lee; después no
 * pregunta más), en Android `WifiNetworkSpecifier`. El módulo nativo no existe en Expo Go ni en web:
 * ahí se falla con un error tipado y la app sigue funcionando con la cámara del teléfono.
 *
 * REGLA (ADR 0003): el AP de la placa es una red **sólo local**, sin puerta de enlace; el teléfono
 * conserva su internet por datos mientras está unido. Medido el 2026-09-05: con gateway, iOS
 * quedaba sin internet.
 */
import { NativeModules } from 'react-native';

import type { CredencialesWifi } from '@/features/device/gatt';

import { urlDeLaPlaca } from './descargaHttp';

export class WifiNoDisponibleError extends Error {
  constructor() {
    super('WIFI_NOT_AVAILABLE');
    this.name = 'WifiNoDisponibleError';
  }
}

export class WifiUnionError extends Error {
  constructor(
    message: string,
    readonly codigo: string | null = null
  ) {
    super(message);
    this.name = 'WifiUnionError';
  }
}

interface WifiManagerNativo {
  connectToProtectedWifiSSID(opciones: { ssid: string; password: string | null; isWEP?: boolean; isHidden?: boolean; timeout?: number }): Promise<void>;
  disconnectFromSSID?(ssid: string): Promise<void>;
  getCurrentWifiSSID(): Promise<string>;
}

/**
 * Toda llamada al módulo nativo lleva tope de tiempo. El 2026-09-07 `getCurrentWifiSSID` no
 * respondió nunca en iOS (sin permiso de ubicación, el sistema puede no contestar) y la app quedó
 * en «conectando…» para siempre: una promesa que no vuelve es peor que un error.
 */
function conTope<T>(promesa: Promise<T>, ms: number, alVencer: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resolve(alVencer()), ms);
    promesa.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

function modulo(): WifiManagerNativo {
  // Se resuelve en cada llamada y no al importar: así este archivo se puede importar (y testear) donde
  // el módulo nativo no existe, y falla sólo cuando de verdad se lo usa.
  const nativo = (NativeModules as { WifiManager?: WifiManagerNativo }).WifiManager;
  if (!nativo) throw new WifiNoDisponibleError();
  return nativo;
}

export async function unirseAlWifi({ ssid, clave }: Pick<CredencialesWifi, 'ssid' | 'clave'>): Promise<void> {
  const wifi = modulo();
  try {
    await conTope(
      wifi.connectToProtectedWifiSSID({ ssid, password: clave, isWEP: false, timeout: 20 }),
      25_000,
      () => {
        throw new WifiUnionError('iOS no respondió al pedido de unirse en 25 s', 'timeout');
      }
    );
  } catch (err) {
    if (err instanceof WifiUnionError) throw err;
    const e = err as { code?: string; message?: string };
    // iOS devuelve "already associated" cuando el teléfono ya está en esa red: no es un error.
    if ((e.message ?? '').toLowerCase().includes('already')) return;
    throw new WifiUnionError(e.message ?? String(err), e.code ?? null);
  }
}

/** Sale del AP de la placa; iOS vuelve solo al WiFi conocido. Best-effort: si no puede, no pasa nada. */
export async function salirDelWifi(ssid: string): Promise<void> {
  try {
    await modulo().disconnectFromSSID?.(ssid);
  } catch {
    /* nada que hacer: sin la red de la placa el sistema ya va a volver a la suya */
  }
}

export async function ssidActual(): Promise<string | null> {
  try {
    return await conTope(modulo().getCurrentWifiSSID(), 3_000, () => null);
  } catch {
    return null;
  }
}

interface EsperaDeps {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  intentos?: number;
  esperaMs?: number;
}

/**
 * Espera a que la placa responda `/salud` en `direccion`. Después de unirse a un WiFi, iOS tarda un
 * par de segundos en tener ruta y DHCP: se reintenta en vez de fallar al primer tiro. Puro
 * (fetch y sleep inyectables) para testear la política de reintentos sin red.
 */
export async function esperarPlaca(
  direccion: { ip: string; puerto: number },
  // 300 ms × 30 = 9 s de espera máxima, pero la placa suele responder al primer o segundo sondeo:
  // sondear cada segundo sumaba hasta un segundo de espera inútil en un flujo que se quiere instantáneo.
  { fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), intentos = 30, esperaMs = 300 }: EsperaDeps = {}
): Promise<boolean> {
  const url = urlDeLaPlaca(direccion, '/salud');
  for (let i = 0; i < intentos; i++) {
    try {
      const controlador = new AbortController();
      const timer = setTimeout(() => controlador.abort(), 3000);
      const r = await fetchImpl(url, { signal: controlador.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (r.ok) return true;
    } catch {
      /* todavía no: reintentar */
    }
    if (i < intentos - 1) await sleep(esperaMs);
  }
  return false;
}
