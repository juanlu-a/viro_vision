/**
 * El registro de telemetría: `registrar(...)` desde cualquier parte, subida por lotes a la función
 * `telemetria` (ADR 0008).
 *
 * Existe porque el 2026-09-08 la información técnica salió de las pantallas, y hasta que esto entre
 * el diagnóstico no está en ningún lado. Es además lo único que permite saber qué pasó cuando la
 * app se usa como se va a usar: alguien caminando con el teléfono en el bolsillo, sin nadie mirando
 * la pantalla, que después dice "no me leyó el cartel".
 *
 * **REGLA DE FRONTERA (ADR 0001).** Esto es red, y por lo tanto está PROHIBIDO en el camino de
 * reconocimiento y de anuncio: el linter lo fuerza para `features/recognition/` y `features/audio/`
 * (`eslint.config.js`). Registrar un evento nunca puede hacer esperar a una lectura ni a una voz.
 * De ahí las tres reglas de este módulo, que no son estilo sino requisito:
 *
 *   1. **`registrar()` es sincrónico y no devuelve promesa.** Encola y vuelve. Quien lo llama no
 *      tiene nada que esperar y no puede olvidarse un `await`.
 *   2. **Nada de acá lanza jamás.** Un fallo de telemetría que tumbe una lectura sería exactamente
 *      al revés de para qué existe. Todo va envuelto y el error se traga.
 *   3. **El envío es best-effort y falla seguido, por diseño.** Mientras el teléfono está unido al
 *      AP de la placa hay WiFi pero no internet (ADR 0003): los lotes se van a acumular y a subir
 *      recién cuando vuelva la red. La cola tiene tope y descarta lo viejo (`cola.ts`).
 */
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';

import { ColaDeEventos, MAX_POR_LOTE } from './cola';
import { obtenerTelefono, generarId } from './identidad';
import type { EventoTelemetria, LoteTelemetria, TipoEvento } from './tipos';

/**
 * ⚠️ `EXPO_PUBLIC_*` se inlinea en el bundle en tiempo de build. Es una URL, no un secreto, así que
 * puede viajar. La función **no pide autenticación** (`verify_jwt = false`, igual que el proxy de
 * visión): la app no tiene login y una anon key en el bundle no sería una defensa. Lo peor que
 * puede pasar es ruido en una tabla de desarrollo.
 */
const urlPorDefecto = process.env.EXPO_PUBLIC_TELEMETRY_URL ?? '';

/** Sin URL configurada la telemetría queda apagada entera: no encola, no reintenta, no pesa. */
export const isTelemetriaConfigurada = urlPorDefecto.length > 0;

/** Cada cuánto se intenta subir lo que haya. */
const INTERVALO_MS = 15_000;

/** Con esta cantidad pendiente no se espera al temporizador: algo está pasando y conviene subirlo. */
const UMBRAL_DE_SUBIDA = 25;

/** Un envío colgado no puede quedar reteniendo el lote para siempre. */
const TIMEOUT_MS = 10_000;

export interface OpcionesTelemetria {
  url?: string;
  fetchImpl?: typeof fetch;
  ahora?: () => Date;
  /** Para tests: sin esto habría que esperar 15 s reales por cada aserción. */
  programar?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  cancelar?: (id: ReturnType<typeof setTimeout>) => void;
}

interface Estado {
  url: string;
  fetchImpl: typeof fetch;
  ahora: () => Date;
  programar: NonNullable<OpcionesTelemetria['programar']>;
  cancelar: NonNullable<OpcionesTelemetria['cancelar']>;
  cola: ColaDeEventos;
  telefono: string;
  sesion: string;
  app: string;
  timer: ReturnType<typeof setTimeout> | null;
  subiendo: boolean;
  encendida: boolean;
}

/** Versión de la app + plataforma: sin esto, comparar dos fallas es comparar dos builds distintos. */
function describirApp(): string {
  const version = Constants.expoConfig?.version ?? '?';
  const build = Platform.OS === 'ios' ? Constants.platform?.ios?.buildNumber : null;
  return `${version}${build ? `+${build}` : ''} ${Platform.OS}`.slice(0, 64);
}

const estado: Estado = {
  url: urlPorDefecto,
  fetchImpl: fetch,
  ahora: () => new Date(),
  programar: setTimeout,
  cancelar: clearTimeout,
  cola: new ColaDeEventos(),
  telefono: 'sin-id',
  sesion: generarId('ses'),
  app: '?',
  timer: null,
  subiendo: false,
  encendida: false,
};

/**
 * Encola un evento. **Sincrónico, no lanza, no espera nada.** Es la única función que el resto de
 * la app usa.
 */
export function registrar(tipo: TipoEvento, extra?: { ms?: number; detalle?: Record<string, unknown> }): void {
  if (!estado.encendida) return;
  try {
    const evento: EventoTelemetria = {
      tipo,
      momento: estado.ahora().toISOString(),
      ...(typeof extra?.ms === 'number' && Number.isFinite(extra.ms) ? { ms: extra.ms } : null),
      ...(extra?.detalle ? { detalle: extra.detalle } : null),
    };
    estado.cola.encolar(evento);
    if (estado.cola.largo >= UMBRAL_DE_SUBIDA) void subir();
  } catch {
    // Regla 2: la telemetría no tumba nada.
  }
}

/**
 * Sube un lote. Devuelve promesa para poder esperarla en los tests y al pasar a segundo plano;
 * **nadie en el camino de una lectura la espera**.
 */
export async function subir(): Promise<void> {
  if (!estado.encendida || estado.subiendo || estado.cola.largo === 0) return;
  estado.subiendo = true;
  const lote = estado.cola.tomarLote(MAX_POR_LOTE);
  const perdidos = estado.cola.perdidos;
  try {
    // Los descartes viajan con el lote: un hueco silencioso lleva a concluir que algo no pasó
    // cuando en realidad no se pudo contar.
    if (perdidos > 0) {
      lote.push({ tipo: 'app.error', momento: estado.ahora().toISOString(), detalle: { eventosPerdidos: perdidos } });
    }
    const cuerpo: LoteTelemetria = {
      telefono: estado.telefono,
      sesion: estado.sesion,
      app: estado.app,
      eventos: lote,
    };
    const controlador = new AbortController();
    const timer = estado.programar(() => controlador.abort(), TIMEOUT_MS);
    try {
      const r = await estado.fetchImpl(estado.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
        signal: controlador.signal,
      });
      if (!r.ok) throw new Error(String(r.status));
      estado.cola.olvidarPerdidos();
    } finally {
      estado.cancelar(timer);
    }
  } catch {
    // Sin internet (el caso normal con el AP de la placa) el lote vuelve a la cola y espera.
    estado.cola.devolver(lote);
  } finally {
    estado.subiendo = false;
  }
}

function programarProximaSubida(): void {
  if (!estado.encendida || estado.timer) return;
  estado.timer = estado.programar(() => {
    estado.timer = null;
    void subir().finally(programarProximaSubida);
  }, INTERVALO_MS);
}

/**
 * Arranca la telemetría. Se llama una sola vez, desde el layout raíz.
 *
 * Engancha además el manejador global de errores de React Native: **un crash es el evento más útil
 * que esta tabla puede tener**, y es justo el que ningún `try` de la app va a registrar. Se encadena
 * al manejador anterior para no robarle la pantalla roja de desarrollo a nadie.
 */
export function iniciarTelemetria(opciones: OpcionesTelemetria = {}): () => void {
  const url = opciones.url ?? urlPorDefecto;
  if (url.length === 0) return () => {};

  estado.url = url;
  estado.fetchImpl = opciones.fetchImpl ?? fetch;
  estado.ahora = opciones.ahora ?? (() => new Date());
  estado.programar = opciones.programar ?? setTimeout;
  estado.cancelar = opciones.cancelar ?? clearTimeout;
  estado.app = describirApp();
  estado.encendida = true;

  // El id del teléfono llega del disco: los eventos de los primeros milisegundos se encolan con el
  // placeholder y se corrigen acá. No se espera a que resuelva para no atrasar el arranque.
  void obtenerTelefono().then((tel) => {
    estado.telefono = tel;
  });

  const anterior = ErrorUtils.getGlobalHandler?.();
  ErrorUtils.setGlobalHandler?.((error, fatal) => {
    registrar('app.error', {
      detalle: {
        fatal: Boolean(fatal),
        nombre: error?.name ?? null,
        mensaje: String(error?.message ?? error).slice(0, 500),
        // El stack recortado: con 8 KB de tope para TODO el detalle, uno entero se lleva el evento.
        stack: String(error?.stack ?? '').slice(0, 2_000),
      },
    });
    // Fatal = la app se está yendo. Es la última oportunidad de que el crash llegue a la tabla.
    void subir();
    anterior?.(error, fatal);
  });

  // Pasar a segundo plano es el único momento predecible en que conviene vaciar: el usuario guardó
  // el teléfono y la app puede quedar suspendida un buen rato.
  const suscripcion = AppState.addEventListener('change', (siguiente) => {
    if (siguiente !== 'active') {
      registrar('app.fondo', { detalle: { estado: siguiente } });
      void subir();
    }
  });

  programarProximaSubida();

  return () => {
    estado.encendida = false;
    if (estado.timer) estado.cancelar(estado.timer);
    estado.timer = null;
    suscripcion.remove();
    if (anterior) ErrorUtils.setGlobalHandler?.(anterior);
  };
}

/** Sólo para tests: deja el módulo como recién cargado. */
export function reiniciarTelemetriaParaTests(): void {
  estado.cola = new ColaDeEventos();
  estado.timer = null;
  estado.subiendo = false;
  estado.encendida = false;
  estado.telefono = 'sin-id';
}
