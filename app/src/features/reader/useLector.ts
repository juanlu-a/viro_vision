/**
 * El lector de Inicio, por modos de operación (ADR 0007): esperando, ómnibus, supermercado.
 *
 * Reemplaza al selector de "caminos" del spike: los caminos eran la pregunta ("¿cuál sirve?") y
 * los modos son la respuesta de ADR 0006 — cada caso de uso tiene su pipeline. Ómnibus corre
 * SIEMPRE local (OCR): en la calle la latencia manda y la señal no está garantizada. Supermercado
 * usa un LLM con visión, con la elección nube/local todavía abierta: acá conviven los dos
 * candidatos —nube si hay clave, Gemma local si no o como fallback— porque probarlos desde la
 * pantalla real es lo que junta la evidencia que cierra esa decisión.
 *
 * Cuando exista hardware, el modo lo fija el botón físico del dispositivo y esta pantalla sólo
 * lo refleja (ADR 0007); mientras tanto los botones de la app aplican los MISMOS gestos a la
 * misma máquina de estados (`modes.ts`).
 *
 * Cada transición de modo y cada resultado se **anuncian por voz**: es una app para personas que
 * no ven la pantalla, y el texto en pantalla es el registro, no la interfaz.
 */
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';

import { announce } from '@/features/audio/announcer';
import { adivinarLectura, frasearLectura, frasearProducto } from '@/features/reader/lectura';
import { transicionar } from '@/features/reader/modes';
import type { Gesto, Modo } from '@/features/reader/modes';
import { strings } from '@/i18n';
import {
  cargarOcr,
  etCargado,
  etCargar,
  etGenerarConImagen,
  etLiberar,
  etReiniciarConversacion,
  leerImagen,
  liberarOcr,
  ocrCargado,
} from '@/services/ondevice';
import {
  PRODUCTO_JSON_SHAPE_PROMPT,
  PRODUCTO_SYSTEM_PROMPT,
  PRODUCTO_USER_PROMPT,
  VisionQuotaError,
  isGeminiConfigured,
  parseProductoLeido,
  reconocerProducto,
} from '@/services/vision';
import type { BusReading, ProductoLeido } from '@/services/vision';

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
  /** Fracción 0–1 si el modo está descargando su modelo. */
  progreso: number | null;
  lectura: BusReading | null;
  producto: ProductoLeido | null;
  /** Texto de respaldo cuando no hubo lectura estructurada (p. ej. las detecciones del OCR). */
  textoCrudo: string | null;
  ms: number | null;
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
};

const PROMPT_PRODUCTO_LOCAL = `${PRODUCTO_SYSTEM_PROMPT}\n\n${PRODUCTO_USER_PROMPT}\n\n${PRODUCTO_JSON_SHAPE_PROMPT}`;

export function useLector() {
  const [state, setState] = useState<LectorState>(inicial);
  const ref = useRef(inicial);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      // Inicio es la pantalla que siempre está montada, pero por higiene: si el árbol se va,
      // no dejamos gigabytes mapeados.
      liberarOcr();
      etLiberar();
    };
  }, []);

  const update = useCallback((patch: Partial<LectorState>) => {
    ref.current = { ...ref.current, ...patch };
    if (vivo.current) setState(ref.current);
  }, []);

  /**
   * Aplica un gesto del botón (el de la app hoy; el del dispositivo cuando exista) a la máquina
   * de ADR 0007. ADR 0007: cada transición se anuncia por audio — el usuario no tiene otro
   * indicador de estado.
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

  /** El candidato local de supermercado: Gemma multimodal vía ExecuTorch, mismo prompt que la nube. */
  const leerProductoLocal = useCallback(
    async (uri: string): Promise<{ producto: ProductoLeido | null; crudo: string | null; ms: number }> => {
      if (!etCargado()) {
        update({ estado: 'preparing', mensaje: t.preparingBig, progreso: 0 });
        await etCargar((p) => update({ progreso: p }));
        update({ estado: 'reading', mensaje: t.reading, progreso: null });
      }
      etReiniciarConversacion();
      const r = await etGenerarConImagen(PROMPT_PRODUCTO_LOCAL, uri);
      return { producto: parseProductoLeido(r.texto), crudo: r.texto || null, ms: r.totalMs };
    },
    [update],
  );

  /**
   * Modo supermercado: LLM con visión, decisión nube/local abierta (ADR 0006). Con clave, va a
   * la nube; sin clave, al candidato local. Si la nube falla con el modelo local ya cargado, se
   * degrada a él avisando (ADR 0001: perder conectividad puede costar precisión, nunca la
   * función). La cuota agotada NO degrada: se resuelve esperando, y el tiempo que pide el
   * proveedor se le dice al usuario — ese campo existe para ser leído.
   */
  const leerSupermercado = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      update({ estado: 'reading', mensaje: t.reading, progreso: null });

      let resultado: { producto: ProductoLeido | null; crudo: string | null; ms: number };
      let aviso = '';

      if (isGeminiConfigured && asset.base64) {
        try {
          const r = await reconocerProducto({
            imageBase64: asset.base64,
            mediaType: asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
          });
          resultado = { producto: r.producto, crudo: r.texto || null, ms: r.ms };
        } catch (err) {
          if (err instanceof VisionQuotaError) {
            const mensaje = `${t.quotaExhausted} ${err.retryAfterSeconds} s.`;
            announce(mensaje);
            update({ estado: 'idle', progreso: null, mensaje });
            return;
          }
          if (!etCargado()) throw err;
          resultado = await leerProductoLocal(asset.uri);
          aviso = ` ${t.fellBackToLocal}`;
        }
      } else {
        resultado = await leerProductoLocal(asset.uri);
      }

      const dicho = frasearProducto(resultado.producto, resultado.crudo);
      announce(dicho);
      update({
        estado: 'idle',
        producto: resultado.producto,
        textoCrudo: resultado.crudo,
        ms: resultado.ms,
        mensaje: `${dicho}${aviso}`,
      });
    },
    [leerProductoLocal, update],
  );

  const leer = useCallback(async () => {
    const { modo } = ref.current;
    if (modo === 'esperando') return; // en reposo no se captura ni se anuncia (ADR 0007)

    const foto = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      // El base64 sólo hace falta si la foto puede viajar a la nube; pedirlo siempre copia
      // megabytes al puente JS sin necesidad.
      base64: modo === 'supermercado' && isGeminiConfigured,
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

  return { state, aplicarGesto, leer };
}
