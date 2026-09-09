/**
 * El lector de Inicio, por modos de operación (ADR 0007): esperando, ómnibus, supermercado.
 *
 * Cada modo tiene su pipeline (ADR 0006). **Ómnibus corre siempre local**: OCR sobre el banner —
 * en el producto lo recorta la TPU del dispositivo; hoy, sin hardware, sobre la foto entera — porque
 * en la calle la latencia manda y la señal no está garantizada. **Supermercado va a la nube**, al
 * modelo de visión que el usuario eligió en Ajustes: está quieto y tolera latencia a cambio de
 * precisión. Sin internet o sin clave, supermercado **avisa** y no lee: el fallback local para ese
 * modo sigue pendiente (ADR 0006, actualización 2026-08-30).
 *
 * La imagen entra SIEMPRE por la **cámara de la placa** (ADR 0003: la foto baja por WiFi, BLE es el
 * plano de control). Hasta el 2026-09-08 había además la cámara del teléfono y la fototeca, que
 * ocupaban ese lugar mientras no había hardware; con el dispositivo andando se fueron, porque una
 * segunda fuente de imagen es un segundo camino que hay que probar y mantener para un producto que
 * no lo tiene.
 *
 * El modo se sincroniza con la placa: los gestos de la app se le escriben por BLE (ella enciende su
 * AP con un modo activo) y el modo que la placa informe (botón físico, ADR 0007) se refleja acá.
 *
 * Cada transición de modo y cada resultado se **anuncian por voz**: es una app para personas que
 * no ven la pantalla. Lo que queda en pantalla es el resultado, nada más: los tiempos, el modelo
 * que respondió y el texto crudo van a la telemetría (`services/telemetria`), no a la interfaz.
 *
 * Los eventos se registran **acá y no dentro de `announce()`**: la telemetría es red y ADR 0001 la
 * tiene prohibida en el camino del anuncio (lo fuerza el linter). `registrar()` es sincrónico y no
 * espera nada, así que ninguna lectura se atrasa por él.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { announce } from '@/features/audio/announcer';
import { useDispositivo } from '@/features/device/DispositivoProvider';
import { adivinarLectura, frasearLectura, frasearProducto } from '@/features/reader/lectura';
import type { BusReading } from '@/features/reader/lectura';
import { transicionar } from '@/features/reader/modes';
import type { Gesto, Modo } from '@/features/reader/modes';
import { useModeloSupermercado } from '@/features/reader/ModeloSupermercadoProvider';
import { strings } from '@/i18n';
import { isSintesisHabilitada, sintetizarAArchivo } from '@/services/audio/sintesis';
import { registrar } from '@/services/telemetria';
import { HttpDescargaError } from '@/services/wifi/descargaHttp';
import type { ImagenParaLaNube } from '@/services/camera';
import { cargarOcr, leerImagen, liberarOcr, ocrCargado } from '@/services/ondevice';
import {
  VisionNetworkError,
  VisionNotConfiguredError,
  VisionQuotaError,
  reconocerProducto,
} from '@/services/vision';
import type { ProductoLeido } from '@/services/vision';

const t = strings.reader;

const ANUNCIO_MODO: Record<Modo, string> = {
  esperando: t.announceEsperando,
  omnibus: t.announceOmnibus,
  supermercado: t.announceSupermercado,
};

export interface LectorState {
  modo: Modo;
  estado: 'idle' | 'preparing' | 'reading';
  mensaje: string;
  /** Fracción 0–1 mientras el OCR descarga su modelo la primera vez. */
  progreso: number | null;
  lectura: BusReading | null;
  producto: ProductoLeido | null;
}

const inicial: LectorState = {
  modo: 'esperando',
  estado: 'idle',
  mensaje: '',
  progreso: null,
  lectura: null,
  producto: null,
};

/**
 * Qué le decimos al usuario cuando algo falla. **Por tipo de error, nunca parseando strings** —
 * y cuando el error trae un dato accionable (cuánto esperar, si el permiso se puede volver a
 * pedir), se usa: para eso viaja como campo de la clase.
 */
function mensajeDeError(err: unknown): string {
  if (err instanceof VisionNotConfiguredError) return t.cloudNotConfigured;
  if (err instanceof VisionNetworkError) return t.cloudUnavailable;
  if (err instanceof VisionQuotaError) return `${t.quotaExhausted} ${err.retryAfterSeconds} s.`;
  return `${t.cloudFailed} (${err instanceof Error ? err.message : String(err)})`;
}

/**
 * Deja la lectura en un `.mp3`, para el parlante del dispositivo. **Best-effort a propósito**: se
 * llama DESPUÉS de `announce()` y sin `await` en el camino crítico, y traga cualquier error.
 *
 * Si falla, el usuario ya escuchó el producto por el parlante del teléfono. El archivo existe para
 * un hardware que todavía no existe (ver `services/audio/sintesis.ts`) y no puede degradar lo que
 * hoy funciona — la accesibilidad es el criterio de diseño, no una capa.
 *
 * Vive acá y no dentro de `announce()` a propósito: `features/audio/` tiene prohibido depender de
 * la red (ADR 0001, forzado por el linter). El anuncio tiene que sonar sin internet; el archivo,
 * no. Meterlo detrás del anuncio pondría una llamada de red en el camino que ADR 0001 protege.
 */
async function guardarAudioDeLaLectura(
  texto: string,
  enviarAlDispositivo?: (uri: string) => Promise<boolean>,
): Promise<void> {
  if (!isSintesisHabilitada) return;
  const t0 = Date.now();
  try {
    const uri = await sintetizarAArchivo(texto);
    // La llamada al TTS de nube, medida aparte del envío: son dos cosas que fallan por motivos
    // distintos y tardan por motivos distintos, y juntas se ven como un solo "tardó". Mismo criterio
    // que separar los ms de la foto de los del pipeline.
    const msSintesis = Date.now() - t0;
    registrar('audio.sintesis', { ms: msSintesis, detalle: { caracteres: texto.length } });
    // Y al parlante de la placa, por WiFi (ADR 0003). El usuario ya escuchó la lectura por el
    // teléfono: esto es el camino del dispositivo final, no lo que hoy garantiza el anuncio.
    const t1 = Date.now();
    const enviado = enviarAlDispositivo ? await enviarAlDispositivo(uri) : false;
    registrar('audio.envio', { ms: Date.now() - t1, detalle: { enviado } });
  } catch (err) {
    // Silencio deliberado para el usuario: nada de lo que hace depende de esto. Pero queda
    // registrado, porque es el camino del parlante del dispositivo y falla sin que nadie lo note.
    registrar('audio.envio', {
      ms: Date.now() - t0,
      detalle: { enviado: false, mensaje: err instanceof Error ? err.message : String(err) },
    });
  }
}

export function useLector() {
  const [state, setState] = useState<LectorState>(inicial);
  const ref = useRef(inicial);
  const vivo = useRef(true);
  const { modelo } = useModeloSupermercado();
  const dispositivo = useDispositivo();

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      // Inicio es la pantalla que siempre está montada, pero por higiene: si el árbol se va, no
      // dejamos el modelo del OCR mapeado.
      liberarOcr();
    };
  }, []);

  const update = useCallback((patch: Partial<LectorState>) => {
    ref.current = { ...ref.current, ...patch };
    if (vivo.current) setState(ref.current);
  }, []);

  /**
   * Aplica un gesto del botón (el de la app hoy; el del dispositivo cuando exista) a la máquina
   * de ADR 0007. Cada transición se anuncia por audio: el usuario no tiene otro indicador de estado.
   */
  const cambiarModo = useCallback(
    (siguiente: Modo, origen: 'app' | 'placa') => {
      if (siguiente === ref.current.modo) return;
      registrar('modo.cambio', { detalle: { de: ref.current.modo, a: siguiente, origen } });
      update({ modo: siguiente, lectura: null, producto: null, mensaje: '' });
      announce(ANUNCIO_MODO[siguiente]);
    },
    [update],
  );

  const aplicarGesto = useCallback(
    (gesto: Gesto) => {
      const siguiente = transicionar(ref.current.modo, gesto);
      if (siguiente === ref.current.modo) return;
      cambiarModo(siguiente, 'app');
      // La placa se entera del modo por BLE y enciende o apaga su AP. Si no está, no pasa nada.
      void dispositivo.escribirModo(siguiente);
    },
    [cambiarModo, dispositivo],
  );

  // El modo que informa la placa (botón físico) manda: la app lo refleja y lo anuncia.
  const modoDelDispositivo = dispositivo.modoDispositivo;
  useEffect(() => {
    if (modoDelDispositivo && modoDelDispositivo !== ref.current.modo) cambiarModo(modoDelDispositivo, 'placa');
  }, [modoDelDispositivo, cambiarModo]);

  /** Modo ómnibus: SIEMPRE local (ADR 0006) — OCR sobre la foto, sin tocar la red. */
  const leerOmnibus = useCallback(
    async (uri: string) => {
      if (!ocrCargado()) {
        update({ estado: 'preparing', mensaje: t.preparing, progreso: 0 });
        // La primera carga baja ~250 MB: si alguien reporta que "la primera vez no anda", este
        // número dice si estaba descargando o si se colgó.
        const carga = await cargarOcr((p) => update({ progreso: p }));
        registrar('ocr.carga', { ms: carga.ms });
      }
      update({ estado: 'reading', mensaje: t.reading, progreso: null });

      const r = await leerImagen(uri);
      const visibles = r.detecciones.filter((d) => d.score > 0.2).slice(0, 6);
      const lectura = adivinarLectura(visibles);
      const crudo = visibles.map((d) => d.text).join(' · ') || null;

      const dicho = frasearLectura(lectura, crudo);
      announce(dicho);
      // Qué detectó el OCR y qué se sacó de ahí: sin el crudo no hay forma de distinguir "el cartel
      // no se leyó" de "se leyó y `adivinarLectura` eligió mal", que se arreglan en lugares distintos.
      registrar('lectura.ok', {
        ms: r.ms,
        detalle: {
          modo: 'omnibus',
          detecciones: r.detecciones.length,
          usadas: visibles.length,
          crudo: crudo?.slice(0, 300) ?? null,
          numero: lectura.numero,
          nombre: lectura.nombre,
          dicho,
        },
      });
      update({ estado: 'idle', lectura, mensaje: dicho });
      void guardarAudioDeLaLectura(dicho, dispositivo.enviarAudio);
    },
    [update, dispositivo.enviarAudio],
  );

  /**
   * Modo supermercado: el modelo de visión en la nube que eligió el usuario. Sin clave o sin red,
   * avisa (por tipo de error) y no lee; la cuota agotada dice cuánto esperar — ese campo existe
   * para ser leído.
   */
  const leerSupermercado = useCallback(
    async (imagen: ImagenParaLaNube) => {
      const model = modelo;
      if (!model) {
        registrar('lectura.fallo', { detalle: { modo: 'supermercado', etapa: 'modelo', motivo: 'sin modelo configurado' } });
        announce(t.cloudNotConfigured);
        update({ estado: 'idle', progreso: null, mensaje: t.cloudNotConfigured });
        return;
      }
      update({ estado: 'reading', mensaje: t.reading, progreso: null });

      try {
        // La foto de la placa ya viene a 1024 px y en base64: no se reescala ni se recodifica.
        const r = await reconocerProducto({
          model,
          ...imagen,
          // La espera por cuota se anuncia. El limitador ya la manejaba, pero en silencio: para
          // quien no ve la pantalla, una app que duerme hasta un minuto es indistinguible de una
          // app colgada. El callback existía desde el principio y no lo llamaba nadie.
          onWait: (waitMs) => {
            const aviso = `${t.waitingSlot} ${Math.ceil(waitMs / 1000)} s.`;
            registrar('nube.espera', { ms: waitMs, detalle: { model } });
            announce(aviso);
            update({ mensaje: aviso });
          },
        });
        const dicho = frasearProducto(r.producto, r.texto || null);
        announce(dicho);
        registrar('lectura.ok', {
          ms: r.ms,
          detalle: {
            modo: 'supermercado',
            // El modelo PEDIDO y el que RESPONDIÓ: si no coinciden, el selector no está mandando.
            modeloPedido: model,
            modelo: r.model,
            tipo: r.producto?.tipo ?? null,
            marca: r.producto?.marca ?? null,
            detalleProducto: r.producto?.detalle ?? null,
            crudo: r.texto?.slice(0, 300) ?? null,
            dicho,
          },
        });
        update({ estado: 'idle', producto: r.producto, mensaje: dicho });
        void guardarAudioDeLaLectura(dicho, dispositivo.enviarAudio);
      } catch (err) {
        const mensaje = mensajeDeError(err);
        // El tipo del error es lo que separa "sin clave" de "sin internet" de "cuota agotada", y
        // los tres se ven igual desde afuera: la app avisa y no lee.
        registrar('lectura.fallo', {
          detalle: {
            modo: 'supermercado',
            etapa: 'nube',
            modeloPedido: model,
            tipo: err instanceof Error ? err.name : typeof err,
            mensaje: err instanceof Error ? err.message : String(err),
            ...(err instanceof VisionQuotaError ? { esperaS: err.retryAfterSeconds } : null),
          },
        });
        announce(mensaje);
        update({ estado: 'idle', progreso: null, mensaje });
      }
    },
    // El modelo entra por dependencia: cambiar de modelo recrea el callback, que es exactamente
    // lo que queremos — la próxima lectura usa el elegido.
    [modelo, update, dispositivo.enviarAudio],
  );

  /**
   * Una lectura entera: la placa saca la foto, baja por WiFi y va al pipeline del modo activo.
   *
   * Es el único camino desde que se fueron la cámara del teléfono y la fototeca (2026-09-08). Sin
   * placa con red el botón está deshabilitado y la pantalla lo dice, así que acá no hay fallback:
   * inventar uno volvería a poner dos caminos donde el producto tiene uno.
   */
  const leer = useCallback(async () => {
    const { modo } = ref.current;
    if (modo === 'esperando') return; // en reposo no se captura ni se anuncia (ADR 0007)
    const t0 = Date.now();
    registrar('lectura.inicio', { detalle: { modo, modelo: modelo ?? null } });
    update({ estado: 'reading', mensaje: t.readingFromDevice, progreso: null });

    let foto;
    try {
      foto = await dispositivo.descargarFoto();
      // Peso y tiempo de la foto por separado del total: es lo que separa "la red está lenta" de
      // "el modelo está lento", y los dos se ven igual como "tardó".
      registrar('foto.ok', { ms: foto.ms, detalle: { bytes: foto.bytes } });
    } catch (err) {
      const status = err instanceof HttpDescargaError ? err.status : null;
      registrar('foto.fallo', {
        ms: Date.now() - t0,
        // El 503 es "la placa no tiene cámara" y lo dice ella; el resto es la red.
        detalle: { modo, status, mensaje: err instanceof Error ? err.message : String(err) },
      });
      // El motivo se dice: quien no ve la pantalla no tiene otra forma de saber por qué el botón
      // no hizo nada. La placa distingue "sin cámara" (503) de una red que no responde.
      const mensaje = `${t.deviceCaptureFailed} ${err instanceof Error ? err.message : String(err)}`;
      announce(mensaje);
      update({ estado: 'idle', progreso: null, mensaje });
      return;
    }

    try {
      if (modo === 'omnibus') await leerOmnibus(foto.uri);
      else await leerSupermercado(foto.imagen);
    } catch (err) {
      registrar('lectura.fallo', {
        ms: Date.now() - t0,
        detalle: {
          modo,
          etapa: modo === 'omnibus' ? 'ocr' : 'nube',
          tipo: err instanceof Error ? err.name : typeof err,
          mensaje: err instanceof Error ? err.message : String(err),
        },
      });
      const mensaje = `${t.error}: ${err instanceof Error ? err.message : String(err)}`;
      announce(t.error);
      update({ estado: 'idle', progreso: null, mensaje });
    }
  }, [dispositivo, leerOmnibus, leerSupermercado, modelo, update]);

  return {
    state,
    aplicarGesto,
    leer,
    modelo,
    /** La placa puede sacar la foto ahora: conectada, con red y respondiendo. Sin esto no se lee. */
    placaLista: dispositivo.fotoDisponible,
    // La placa está conectada y su red se está levantando: leer está por habilitarse.
    placaConectando: dispositivo.conexion.status === 'connected' && dispositivo.wifi === 'uniendose',
    /** Para la línea de estado de Inicio: qué hay del lado del dispositivo, en una palabra. */
    estadoPlaca:
      dispositivo.conexion.status === 'connected'
        ? dispositivo.wifi === 'listo'
          ? ('lista' as const)
          : dispositivo.wifi === 'uniendose'
            ? ('conectando' as const)
            : dispositivo.wifi === 'error'
              ? ('error' as const)
              : ('sin-red' as const)
        : dispositivo.conexion.status === 'scanning' || dispositivo.conexion.status === 'connecting'
          ? ('buscando' as const)
          : ('sin-placa' as const),
  };
}
