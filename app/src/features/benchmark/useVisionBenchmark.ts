/**
 * Hook que maneja la máquina de estados del benchmark de latencia en la nube.
 *
 * Higiene de medición que este hook garantiza:
 *   - Una corrida de calentamiento DESCARTADA antes de las que cuentan (cubre el handshake TLS
 *     y la compilación del JSON Schema, que se cachea 24 h del lado de la API).
 *   - Las corridas son secuenciales, nunca en paralelo: dos requests simultáneas compiten por
 *     el uplink y los tiempos dejan de significar nada.
 *   - Nada de setState por delta de texto — un re-render entre lecturas del stream desplaza
 *     los timestamps. Sólo se hace setState entre corridas.
 */
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';

import { strings } from '@/i18n';
import {
  VisionNotConfiguredError,
  availableModels,
  benchmarkBusVision,
  defaultModel,
  formatMs,
  summarize,
} from '@/services/vision';
import type { BenchmarkResult, ThinkingMode } from '@/services/vision';
import type { BenchmarkState, SelectedPhoto } from './types';

const initialState: BenchmarkState = {
  status: 'idle',
  currentRun: 0,
  totalRuns: 0,
  runs: [],
  message: strings.benchmark.noResults,
  photo: null,
  model: defaultModel(),
  thinking: 'off',
};

export function useVisionBenchmark() {
  const [state, setState] = useState<BenchmarkState>(initialState);
  const abortRef = useRef<AbortController | null>(null);
  /** Espejo del estado, para leer foto y modo dentro de `run` sin re-crear el callback. */
  const stateRef = useRef(initialState);

  // Navegar hacia atrás a mitad de una medición dejaba la serie corriendo: hasta 7 requests
  // siguiendo en vuelo, sin forma de cancelarlas, quemando cuota y contaminando cualquier
  // medición posterior si se vuelve a entrar a la pantalla.
  useEffect(() => () => abortRef.current?.abort(), []);

  const update = useCallback((patch: Partial<BenchmarkState>) => {
    stateRef.current = { ...stateRef.current, ...patch };
    setState(stateRef.current);
  }, []);

  const pickPhoto = useCallback(async () => {
    try {
      // Sin gate de permisos a propósito: en SDK 57 la fototeca no lo requiere (iOS usa el
      // picker fuera de proceso, Android 13+ devuelve la lista vacía). Pedirlo sólo agregaba un
      // diálogo cuya negativa bloqueaba un selector que igual habría funcionado.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 1,
      });
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        update({ status: 'error', message: strings.benchmark.photoUnreadable });
        return;
      }

    const photo: SelectedPhoto = {
      uri: asset.uri,
      base64: asset.base64,
      mediaType: asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
      width: asset.width,
      height: asset.height,
    };

      // Cambiar de foto invalida las corridas previas: el tamaño del payload es un eje del
      // experimento.
      update({
        photo,
        runs: [],
        status: 'idle',
        currentRun: 0,
        totalRuns: 0,
        message: strings.benchmark.photoSelected,
      });
    } catch (err) {
      // Sin esto, un throw del picker era una promesa rechazada sin manejar: para un usuario
      // ciego, "no pasó nada" es indistinguible de "el botón no anda".
      update({ status: 'error', message: describeError(err) });
    }
  }, [update]);

  const setThinking = useCallback(
    (thinking: ThinkingMode) => {
      update({ thinking, runs: [], status: 'idle', currentRun: 0, totalRuns: 0 });
    },
    [update],
  );

  /** Rota al siguiente modelo del registro. Cambiar de modelo invalida las corridas anteriores. */
  const setModel = useCallback(() => {
    const models = availableModels();
    if (models.length < 2) return;
    const current = models.findIndex((p) => p.id === stateRef.current.model.id);
    const next = models[(current + 1) % models.length];
    update({ model: next, runs: [], status: 'idle', currentRun: 0, totalRuns: 0 });
  }, [update]);

  const run = useCallback(
    async (totalRuns: number) => {
      const { photo, thinking, model, status } = stateRef.current;
      if (!photo) return;
      // Guarda contra doble toque: el botón se deshabilita vía estado, que es asíncrono, así que
      // dos taps rápidos podían lanzar dos series simultáneas. Requests en paralelo compiten por
      // el uplink y los tiempos dejan de significar nada.
      if (status === 'warmup' || status === 'running') return;

      const controller = new AbortController();
      abortRef.current = controller;

      update({
        status: 'warmup',
        runs: [],
        currentRun: 0,
        totalRuns,
        message: strings.benchmark.warmingUp,
      });

      const options = {
        imageBase64: photo.base64,
        mediaType: photo.mediaType,
        model: model.id,
        thinking,
        signal: controller.signal,
      };

      try {
        // Calentamiento: se corre y se descarta. No entra en las estadísticas.
        await benchmarkBusVision(options);

        const collected: BenchmarkResult[] = [];
        for (let index = 0; index < totalRuns; index += 1) {
          if (controller.signal.aborted) break;
          update({
            status: 'running',
            currentRun: index + 1,
            message: `${strings.benchmark.running} ${index + 1} ${strings.benchmark.ofLabel} ${totalRuns}`,
          });
          collected.push(await benchmarkBusVision(options));
        }

        if (controller.signal.aborted) {
          // Cancelación deliberada. Las corridas ya completadas son válidas por separado, así
          // que se conservan en vez de tirarlas.
          update({
            status: 'idle',
            currentRun: 0,
            runs: collected,
            message: `${strings.benchmark.cancelled} ${collected.length} ${strings.benchmark.samplesLabel}`,
          });
        } else {
          // El mensaje lleva el TTFT: un desarrollador ciego no puede mirar la tabla.
          const ttft = summarize(collected, 'toFirstTextDelta');
          update({
            status: 'done',
            currentRun: 0,
            runs: collected,
            message: `${collected.length} ${strings.benchmark.samplesLabel}. ${strings.benchmark.metricToFirstTextDelta}: ${formatMs(ttft.medianMs)}.`,
          });
        }
      } catch (err) {
        // Un abort llega como excepción: es cancelación, no falla. No pintarlo como error.
        if (controller.signal.aborted || isAbortError(err)) {
          update({ status: 'idle', currentRun: 0, message: strings.benchmark.cancelled });
        } else {
          update({ status: 'error', currentRun: 0, message: describeError(err) });
        }
      } finally {
        // Sólo limpiar si sigue siendo NUESTRO controller: si no, se anularía el de otra corrida
        // y el botón Cancelar quedaría sin efecto.
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [update],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { state, pickPhoto, setModel, setThinking, run, cancel };
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message));
}

function describeError(err: unknown): string {
  if (err instanceof VisionNotConfiguredError) return strings.benchmark.notConfigured;
  if (err instanceof Error) return `${strings.benchmark.errorTitle}: ${err.message}`;
  return strings.benchmark.errorTitle;
}
