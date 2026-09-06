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
 * La imagen entra por la **cámara de la placa** cuando el dispositivo está conectado y con red
 * (ADR 0003: la foto baja por WiFi, BLE es el control), y si no por la **cámara del teléfono**. La
 * fototeca queda como segunda fuente para poder pasarle la misma foto a varios modelos y que la
 * comparación mida modelos y no fotos.
 *
 * El modo se sincroniza con la placa: los gestos de la app se le escriben por BLE (ella enciende su
 * AP con un modo activo) y el modo que la placa informe (botón físico, ADR 0007) se refleja acá.
 *
 * Cada transición de modo y cada resultado se **anuncian por voz**: es una app para personas que
 * no ven la pantalla, y el texto en pantalla es el registro, no la interfaz.
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
import {
  CameraPermissionError,
  ImagenIlegibleError,
  capturarFoto,
  prepararParaLaNube,
} from '@/services/camera';
import type { FotoCapturada, FuenteDeImagen, ImagenParaLaNube } from '@/services/camera';
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
  /** Texto de respaldo cuando no hubo lectura estructurada (p. ej. las detecciones del OCR). */
  textoCrudo: string | null;
  ms: number | null;
  /** Qué modelo de nube respondió, para mostrarlo junto al resultado. */
  modelo: string | null;
  /** Ruta del .mp3 de la lectura, cuando la síntesis a archivo está habilitada. */
  audio: string | null;
}

const inicial: LectorState = {
  modo: 'esperando',
  estado: 'idle',
  mensaje: '',
  progreso: null,
  lectura: null,
  producto: null,
  textoCrudo: null,
  ms: null,
  modelo: null,
  audio: null,
};

/**
 * Qué le decimos al usuario cuando algo falla. **Por tipo de error, nunca parseando strings** —
 * y cuando el error trae un dato accionable (cuánto esperar, si el permiso se puede volver a
 * pedir), se usa: para eso viaja como campo de la clase.
 */
function mensajeDeError(err: unknown): string {
  if (err instanceof CameraPermissionError) {
    // El consejo cambia según si iOS va a volver a preguntar: decirle "aceptá el permiso" a quien
    // ya no va a ver el diálogo lo deja esperando un cartel que no aparece.
    return err.canAskAgain ? t.cameraDenied : t.cameraDeniedForever;
  }
  if (err instanceof ImagenIlegibleError) return t.imageUnreadable;
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
  update: (patch: Partial<LectorState>) => void,
  enviarAlDispositivo?: (uri: string) => Promise<boolean>,
): Promise<void> {
  if (!isSintesisHabilitada) return;
  try {
    const uri = await sintetizarAArchivo(texto);
    update({ audio: uri });
    // Y al parlante de la placa, por WiFi (ADR 0003). El usuario ya escuchó la lectura por el
    // teléfono: esto es el camino del dispositivo final, no lo que hoy garantiza el anuncio.
    if (enviarAlDispositivo) await enviarAlDispositivo(uri);
  } catch {
    // Silencio deliberado: nada de lo que el usuario hace depende de esto.
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
    (siguiente: Modo) => {
      if (siguiente === ref.current.modo) return;
      update({
        modo: siguiente,
        lectura: null,
        producto: null,
        textoCrudo: null,
        ms: null,
        modelo: null,
        audio: null,
        mensaje: '',
      });
      announce(ANUNCIO_MODO[siguiente]);
    },
    [update],
  );

  const aplicarGesto = useCallback(
    (gesto: Gesto) => {
      const siguiente = transicionar(ref.current.modo, gesto);
      if (siguiente === ref.current.modo) return;
      cambiarModo(siguiente);
      // La placa se entera del modo por BLE y enciende o apaga su AP. Si no está, no pasa nada.
      void dispositivo.escribirModo(siguiente);
    },
    [cambiarModo, dispositivo],
  );

  // El modo que informa la placa (botón físico) manda: la app lo refleja y lo anuncia.
  const modoDelDispositivo = dispositivo.modoDispositivo;
  useEffect(() => {
    if (modoDelDispositivo && modoDelDispositivo !== ref.current.modo) cambiarModo(modoDelDispositivo);
  }, [modoDelDispositivo, cambiarModo]);

  /** Modo ómnibus: SIEMPRE local (ADR 0006) — OCR sobre la foto, sin tocar la red. */
  const leerOmnibus = useCallback(
    async (uri: string) => {
      if (!ocrCargado()) {
        update({ estado: 'preparing', mensaje: t.preparing, progreso: 0 });
        await cargarOcr((p) => update({ progreso: p }));
      }
      update({ estado: 'reading', mensaje: t.reading, progreso: null });

      const r = await leerImagen(uri);
      const visibles = r.detecciones.filter((d) => d.score > 0.2).slice(0, 6);
      const lectura = adivinarLectura(visibles);
      const crudo = visibles.map((d) => d.text).join(' · ') || null;

      const dicho = frasearLectura(lectura, crudo);
      announce(dicho);
      update({ estado: 'idle', lectura, textoCrudo: crudo, ms: r.ms, mensaje: dicho });
      void guardarAudioDeLaLectura(dicho, update, dispositivo.enviarAudio);
    },
    [update, dispositivo.enviarAudio],
  );

  /**
   * Modo supermercado: el modelo de visión en la nube que eligió el usuario. Sin clave o sin red,
   * avisa (por tipo de error) y no lee; la cuota agotada dice cuánto esperar — ese campo existe
   * para ser leído.
   */
  const leerSupermercado = useCallback(
    async (entrada: FotoCapturada | ImagenParaLaNube) => {
      const model = modelo;
      if (!model) {
        announce(t.cloudNotConfigured);
        update({ estado: 'idle', progreso: null, mensaje: t.cloudNotConfigured });
        return;
      }
      update({ estado: 'reading', mensaje: t.reading, progreso: null });

      try {
        // El achique va acá y no en la captura: es el único modo que sube la imagen, y en ómnibus
        // reescalar sólo le sacaría píxeles al OCR sin ganar nada. La foto de la placa ya viene a
        // 1024 px y en base64: no se toca.
        const imagen = 'imageBase64' in entrada ? entrada : await prepararParaLaNube(entrada);
        const r = await reconocerProducto({
          model,
          ...imagen,
          // La espera por cuota se anuncia. El limitador ya la manejaba, pero en silencio: para
          // quien no ve la pantalla, una app que duerme hasta un minuto es indistinguible de una
          // app colgada. El callback existía desde el principio y no lo llamaba nadie.
          onWait: (waitMs) => {
            const aviso = `${t.waitingSlot} ${Math.ceil(waitMs / 1000)} s.`;
            announce(aviso);
            update({ mensaje: aviso });
          },
        });
        const crudo = r.texto || null;
        const dicho = frasearProducto(r.producto, crudo);
        announce(dicho);
        update({ estado: 'idle', producto: r.producto, textoCrudo: crudo, ms: r.ms, modelo: r.model, mensaje: dicho });
        void guardarAudioDeLaLectura(dicho, update, dispositivo.enviarAudio);
      } catch (err) {
        const mensaje = mensajeDeError(err);
        announce(mensaje);
        update({ estado: 'idle', progreso: null, mensaje });
      }
    },
    // El modelo entra por dependencia: cambiar de modelo recrea el callback, que es exactamente
    // lo que queremos — la próxima lectura usa el elegido.
    [modelo, update, dispositivo.enviarAudio],
  );

  /**
   * La foto la saca la placa (por WiFi) cuando está conectada y con red; si no, el teléfono. Es la
   * misma lectura después: sólo cambia de dónde viene la imagen (ADR 0003).
   */
  const leerConLaPlaca = useCallback(async () => {
    const { modo } = ref.current;
    if (modo === 'esperando') return;
    update({ estado: 'reading', mensaje: t.readingFromDevice, progreso: null });
    let foto;
    try {
      foto = await dispositivo.descargarFoto();
    } catch (err) {
      const mensaje = `${t.deviceCaptureFailed} ${err instanceof Error ? err.message : String(err)}`;
      announce(mensaje);
      update({ estado: 'idle', progreso: null, mensaje });
      return;
    }
    try {
      if (modo === 'omnibus') await leerOmnibus(foto.uri);
      else await leerSupermercado(foto.imagen);
    } catch (err) {
      const mensaje = `${t.error}: ${err instanceof Error ? err.message : String(err)}`;
      announce(t.error);
      update({ estado: 'idle', progreso: null, mensaje });
    }
  }, [dispositivo, leerOmnibus, leerSupermercado, update]);

  const leer = useCallback(
    async (fuente: FuenteDeImagen | 'placa') => {
      const { modo } = ref.current;
      if (modo === 'esperando') return; // en reposo no se captura ni se anuncia (ADR 0007)
      if (fuente === 'placa') return leerConLaPlaca();

      let foto: FotoCapturada | null;
      try {
        foto = await capturarFoto(fuente);
      } catch (err) {
        // El permiso denegado se anuncia con su propio consejo. Sin esto el botón no hace nada
        // visible y quien no ve la pantalla no tiene forma de saber por qué.
        const mensaje = mensajeDeError(err);
        announce(mensaje);
        update({ estado: 'idle', progreso: null, mensaje });
        return;
      }
      // Cancelar no es un error: no se anuncia ni deja mensaje. El usuario ya sabe que canceló.
      if (!foto) return;

      try {
        if (modo === 'omnibus') {
          await leerOmnibus(foto.uri);
        } else {
          await leerSupermercado(foto);
        }
      } catch (err) {
        const mensaje = `${t.error}: ${err instanceof Error ? err.message : String(err)}`;
        announce(t.error);
        update({ estado: 'idle', progreso: null, mensaje });
      }
    },
    [leerConLaPlaca, leerOmnibus, leerSupermercado, update],
  );

  return {
    state,
    aplicarGesto,
    leer,
    modelo,
    fotoDesdeLaPlaca: dispositivo.fotoDisponible,
    // La placa está conectada y su red se está levantando: el botón del dispositivo está por llegar.
    placaConectando: dispositivo.conexion.status === 'connected' && dispositivo.wifi === 'uniendose',
  };
}
