/**
 * El lector de carteles de Inicio: elegí un camino, sacá o elegí una foto, escuchá la respuesta.
 *
 * Es la promoción a pantalla principal de lo que el spike validó (`docs/spike-vision-local.md`),
 * **manteniendo los cuatro caminos a propósito**: la decisión de cuál queda es del equipo y del
 * tutor, y mientras tanto poder compararlos desde la pantalla real —no desde una de desarrollo—
 * es parte del experimento. Las pantallas de `dev/` siguen existiendo para medir fino.
 *
 * El default es el **OCR local**: el más rápido, el más liviano y el único de los locales que
 * funciona sin descargar gigabytes. Coincide con ADR 0001: lo local primero, la nube opcional.
 *
 * El resultado se **anuncia por voz** además de mostrarse: es una app para personas que no ven la
 * pantalla, y el texto en pantalla es el registro, no la interfaz.
 */
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';

import { announce } from '@/features/audio/announcer';
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
  benchmarkBusVision,
  isVisionConfigured,
  parseBusReading,
} from '@/services/vision';
import type { BusReading } from '@/services/vision';
import { JSON_SHAPE_PROMPT, SYSTEM_PROMPT, USER_PROMPT } from '@/services/vision/providers';

const t = strings.reader;

/**
 * Los caminos de lectura, en el orden del selector. `litert` no está: su camino de visión no
 * funciona en iOS (bug aislado en el spike) y ofrecer un camino que siempre falla no es mantener
 * opciones, es sembrar desconfianza. Vuelve si la librería lo arregla.
 */
export const CAMINOS = ['ocr', 'vlm', 'nube'] as const;
export type Camino = (typeof CAMINOS)[number];

export interface LectorState {
  camino: Camino;
  estado: 'idle' | 'preparing' | 'reading';
  mensaje: string;
  /** Fracción 0–1 si el camino está descargando su modelo. */
  progreso: number | null;
  lectura: BusReading | null;
  /** Texto de respaldo cuando no hubo lectura estructurada (p. ej. las detecciones del OCR). */
  textoCrudo: string | null;
  ms: number | null;
}

const inicial: LectorState = {
  camino: 'ocr',
  estado: 'idle',
  mensaje: '',
  progreso: null,
  lectura: null,
  textoCrudo: null,
  ms: null,
};

/** Con 2-4 dígitos y confianza razonable, es candidata a número de línea. */
function adivinarLectura(textos: { text: string; score: number }[]): BusReading {
  const numero = textos.find((d) => /^\d{2,4}$/.test(d.text.trim()) && d.score > 0.3);
  const nombre = textos.find(
    (d) => d !== numero && /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(d.text) && d.score > 0.3,
  );
  return { numero: numero?.text.trim() ?? null, nombre: nombre?.text.trim() ?? null };
}

function anunciar(lectura: BusReading | null, crudo: string | null): string {
  if (lectura?.numero && lectura?.nombre) return `${t.line} ${lectura.numero}, ${lectura.nombre}`;
  if (lectura?.numero) return `${t.line} ${lectura.numero}`;
  if (lectura?.nombre) return lectura.nombre;
  if (crudo) return crudo;
  return t.nothingRead;
}

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

  const rotarCamino = useCallback(() => {
    const caminos = CAMINOS.filter((c) => c !== 'nube' || isVisionConfigured);
    const i = caminos.indexOf(ref.current.camino);
    update({
      camino: caminos[(i + 1) % caminos.length],
      lectura: null,
      textoCrudo: null,
      ms: null,
      mensaje: '',
    });
  }, [update]);

  const leer = useCallback(async () => {
    const foto = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      base64: ref.current.camino === 'nube',
    });
    if (foto.canceled || !foto.assets?.[0]) return;
    const asset = foto.assets[0];

    try {
      // Cada camino prepara su modelo la primera vez, avisando. Prepararlos a todos al arrancar
      // la app sería pagar descargas y memoria por caminos que quizá no se usen.
      const { camino } = ref.current;
      if (camino === 'ocr' && !ocrCargado()) {
        update({ estado: 'preparing', mensaje: t.preparing, progreso: 0 });
        await cargarOcr((p) => update({ progreso: p }));
      }
      if (camino === 'vlm' && !etCargado()) {
        update({ estado: 'preparing', mensaje: t.preparingBig, progreso: 0 });
        await etCargar((p) => update({ progreso: p }));
      }

      update({ estado: 'reading', mensaje: t.reading, progreso: null, lectura: null, textoCrudo: null });

      let lectura: BusReading | null = null;
      let crudo: string | null = null;
      let ms: number | null = null;

      if (camino === 'ocr') {
        const r = await leerImagen(asset.uri);
        const visibles = r.detecciones.filter((d) => d.score > 0.2).slice(0, 6);
        lectura = adivinarLectura(visibles);
        crudo = visibles.map((d) => d.text).join(' · ') || null;
        ms = r.ms;
      } else if (camino === 'vlm') {
        etReiniciarConversacion();
        const r = await etGenerarConImagen(
          `${SYSTEM_PROMPT}\n\n${USER_PROMPT}\n\n${JSON_SHAPE_PROMPT}`,
          asset.uri,
        );
        lectura = parseBusReading(r.texto);
        crudo = r.texto || null;
        ms = r.totalMs;
      } else {
        const r = await benchmarkBusVision({
          imageBase64: asset.base64 ?? '',
          mediaType: asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
        });
        lectura = r.parsed;
        crudo = r.text || null;
        ms = r.ms.total;
      }

      const dicho = anunciar(lectura, crudo);
      // La voz es la interfaz; la pantalla, el registro.
      announce(dicho);
      update({ estado: 'idle', lectura, textoCrudo: crudo, ms, mensaje: dicho });
    } catch (err) {
      const mensaje = `${t.error}: ${err instanceof Error ? err.message : String(err)}`;
      announce(t.error);
      update({ estado: 'idle', progreso: null, mensaje });
    }
  }, [update]);

  return { state, rotarCamino, leer };
}
