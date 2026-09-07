/**
 * Telemetría de la app: qué pasó, cuándo y cuánto tardó, para verlo después en Supabase sin estar
 * al lado del teléfono (2026-09-07). Va a la función `telemetria` del mismo proyecto que el proxy
 * de visión, que inserta en `public.eventos` con la clave de servidor: la app no tiene clave alguna.
 *
 * REGLA DE FRONTERA (ADR 0001): `registrar()` nunca lanza, nunca espera a la red y no está en el
 * camino del reconocimiento ni del anuncio. Sin proxy configurado (desarrollo sin `.env`) es un
 * no-op. La identidad es un UUID aleatorio por instalación: no hay cuentas ni datos personales.
 *
 * Barrel puro: única superficie de import (`@/services/telemetria`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { proxyUrl } from '@/services/cloud/config';

import { ColaTelemetria, type LoteTelemetria, urlDeTelemetria } from './cola';

export { urlDeTelemetria } from './cola';
export type { EventoTelemetria, LoteTelemetria } from './cola';

const CLAVE_TELEFONO = 'virovision.telemetria.telefono';
const CADA_MS = 5_000;

function uuid(): string {
  // Suficiente como id anónimo de instalación; no es criptográfico ni hace falta.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function enviarAlProxy(url: string, lote: LoteTelemetria): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lote) });
    return r.ok;
  } catch {
    return false;
  }
}

class Telemetria {
  private cola: ColaTelemetria | null = null;
  private readonly sesion = uuid();
  private readonly url = urlDeTelemetria(proxyUrl);
  private timer: ReturnType<typeof setInterval> | null = null;
  private lista: Promise<void> | null = null;

  /** Se inicia una vez, al montar la app. Sin URL no hace nada. */
  iniciar(): void {
    if (!this.url || this.lista) return;
    const url = this.url;
    this.lista = (async () => {
      let telefono = await AsyncStorage.getItem(CLAVE_TELEFONO).catch(() => null);
      if (!telefono) {
        telefono = uuid();
        await AsyncStorage.setItem(CLAVE_TELEFONO, telefono).catch(() => {});
      }
      const version = Constants.expoConfig?.version ?? '?';
      const build = (Platform.OS === 'ios' ? Constants.expoConfig?.ios?.buildNumber : Constants.expoConfig?.android?.versionCode) ?? '?';
      const nueva = new ColaTelemetria({ telefono, sesion: this.sesion, app: `${Platform.OS} ${version} (${build})` }, { enviar: (lote) => enviarAlProxy(url, lote) });
      // Lo registrado antes de tener identidad se traspasa: `registrar` acumula en una cola provisoria.
      for (const e of this.previos) nueva.registrar(e.tipo, e.detalle, e.ms);
      this.previos = [];
      this.cola = nueva;
      this.timer = setInterval(() => void this.cola?.vaciar(), CADA_MS);
      this.registrar('app_abierta', { plataforma: Platform.OS, version, build });
    })();
  }

  private previos: { tipo: string; detalle?: Record<string, unknown>; ms?: number | null }[] = [];

  /** Anota un evento. Nunca lanza; sin telemetría configurada, no hace nada. */
  registrar(tipo: string, detalle?: Record<string, unknown>, ms?: number | null): void {
    if (!this.url) return;
    try {
      if (this.cola) this.cola.registrar(tipo, detalle, ms);
      else if (this.previos.length < 200) this.previos.push({ tipo, detalle, ms });
    } catch {
      /* jamás desde acá */
    }
  }

  /** Manda ya lo pendiente (p. ej. al terminar una lectura, para verlo enseguida). */
  vaciar(): void {
    void this.cola?.vaciar();
  }
}

export const telemetria = new Telemetria();

/** Cronómetro chico para medir tramos: `const t = cronometro(); … t()` devuelve los ms. */
export function cronometro(now: () => number = Date.now): () => number {
  const t0 = now();
  return () => Math.max(0, Math.round(now() - t0));
}
