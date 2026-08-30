/**
 * El lector de Inicio, por modos de operación (ADR 0007): esperando, ómnibus, supermercado.
 *
 * Cada modo tiene su pipeline (ADR 0006). **Ómnibus corre siempre local**: OCR sobre el banner —
 * en el producto lo recorta la TPU del dispositivo; hoy, sin hardware, sobre la foto entera — porque
 * en la calle la latencia manda y la señal no está garantizada. **Supermercado va a la nube**, al
 * modelo de visión que el usuario eligió en Inicio: está quieto y tolera latencia a cambio de
 * precisión. Sin internet o sin clave, supermercado **avisa** y no lee: el fallback local para ese
 * modo sigue pendiente (ADR 0006, actualización 2026-08-30).
 *
 * Cuando exista hardware, el modo lo fija el botón físico del dispositivo y esta pantalla sólo lo
 * refleja (ADR 0007); mientras tanto los botones de la app aplican los MISMOS gestos a la misma
 * máquina de estados (`modes.ts`).
 *
 * Cada transición de modo y cada resultado se **anuncian por voz**: es una app para personas que
 * no ven la pantalla, y el texto en pantalla es el registro, no la interfaz.
 */
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';

import { announce } from '@/features/audio/announcer';
import { adivinarLectura, frasearLectura, frasearProducto } from '@/features/reader/lectura';
import type { BusReading } from '@/features/reader/lectura';
import { transicionar } from '@/features/reader/modes';
import type { Gesto, Modo } from '@/features/reader/modes';
import { useModeloSupermercado } from '@/features/reader/useModeloSupermercado';
import { strings } from '@/i18n';
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
};

/** Qué le decimos al usuario cuando la nube falla. Por tipo de error, nunca parseando strings. */
function mensajeDeErrorNube(err: unknown): string {
  if (err instanceof VisionNotConfiguredError) return t.cloudNotConfigured;
  if (err instanceof VisionNetworkError) return t.cloudUnavailable;
  if (err instanceof VisionQuotaError) return `${t.quotaExhausted} ${err.retryAfterSeconds} s.`;
  return `${t.cloudFailed} (${err instanceof Error ? err.message : String(err)})`;
}

export function useLector() {
  const [state, setState] = useState<LectorState>(inicial);
  const ref = useRef(inicial);
  const vivo = useRef(true);
  const { modelo, modelos, elegir: elegirModelo } = useModeloSupermercado();

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
  const aplicarGesto = useCallback(
    (gesto: Gesto) => {
      const siguiente = transicionar(ref.current.modo, gesto);
      if (siguiente === ref.current.modo) return;
      update({
        modo: siguiente,
        lectura: null,
        producto: null,
        textoCrudo: null,
        ms: null,
        modelo: null,
        mensaje: '',
      });
      announce(ANUNCIO_MODO[siguiente]);
    },
    [update],
  );

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
    },
    [update],
  );

  /**
   * Modo supermercado: el modelo de visión en la nube que eligió el usuario. Sin clave o sin red,
   * avisa (por tipo de error) y no lee; la cuota agotada dice cuánto esperar — ese campo existe
   * para ser leído.
   */
  const leerSupermercado = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      const model = modelo;
      if (!model || !asset.base64) {
        announce(t.cloudNotConfigured);
        update({ estado: 'idle', progreso: null, mensaje: t.cloudNotConfigured });
        return;
      }
      update({ estado: 'reading', mensaje: t.reading, progreso: null });

      try {
        const r = await reconocerProducto({
          model,
          imageBase64: asset.base64,
          mediaType: asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
        });
        const crudo = r.texto || null;
        const dicho = frasearProducto(r.producto, crudo);
        announce(dicho);
        update({ estado: 'idle', producto: r.producto, textoCrudo: crudo, ms: r.ms, modelo: r.model, mensaje: dicho });
      } catch (err) {
        const mensaje = mensajeDeErrorNube(err);
        announce(mensaje);
        update({ estado: 'idle', progreso: null, mensaje });
      }
    },
    // El modelo entra por dependencia: cambiar de modelo recrea el callback, que es exactamente
    // lo que queremos — la próxima lectura usa el elegido.
    [modelo, update],
  );

  const leer = useCallback(async () => {
    const { modo } = ref.current;
    if (modo === 'esperando') return; // en reposo no se captura ni se anuncia (ADR 0007)

    const foto = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      // El base64 sólo hace falta si la foto viaja a la nube; pedirlo siempre copia megabytes al
      // puente JS sin necesidad.
      base64: modo === 'supermercado',
    });
    if (foto.canceled || !foto.assets?.[0]) return;
    const asset = foto.assets[0];

    try {
      if (modo === 'omnibus') {
        await leerOmnibus(asset.uri);
      } else {
        await leerSupermercado(asset);
      }
    } catch (err) {
      const mensaje = `${t.error}: ${err instanceof Error ? err.message : String(err)}`;
      announce(t.error);
      update({ estado: 'idle', progreso: null, mensaje });
    }
  }, [leerOmnibus, leerSupermercado, update]);

  return { state, aplicarGesto, leer, modelo, modelos, elegirModelo };
}
