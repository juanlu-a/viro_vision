/**
 * El modelo de nube del modo supermercado: estado + persistencia, compartidos por toda la app.
 *
 * Era un hook local mientras el selector vivía en Inicio, junto a su único consumidor. Ahora el
 * selector está en Ajustes y quien lee es Inicio: con dos instancias del hook cada pantalla
 * tendría su propio `useState` y elegir en Ajustes no cambiaría el modelo con el que Inicio lee —
 * la elección se vería aplicada y no lo estaría hasta remontar. Por eso es un Provider: un solo
 * estado, el storage y el resolver intactos.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { resolveProductoModel } from '@/features/reader/modeloSupermercado';
import {
  loadVisionModelPreference,
  saveVisionModelPreference,
} from '@/services/storage/visionModelPreference';
import { availableModels } from '@/services/vision';
import type { ModelProfile } from '@/services/vision';

interface ModeloSupermercadoValue {
  /** El modelo vigente, o null si este build no trae ninguna clave. */
  modelo: ModelProfile | null;
  /** Los elegibles en ESTE build (sólo proveedores con clave). */
  modelos: readonly ModelProfile[];
  elegir: (id: string) => void;
}

const ModeloSupermercadoContext = createContext<ModeloSupermercadoValue | null>(null);

export function ModeloSupermercadoProvider({ children }: { children: React.ReactNode }) {
  // Los disponibles no cambian en runtime (las claves se inlinean al compilar): se calculan una vez.
  const [modelos] = useState<readonly ModelProfile[]>(() => availableModels());
  const [modelo, setModelo] = useState<ModelProfile | null>(() =>
    resolveProductoModel(null, modelos),
  );

  useEffect(() => {
    let activo = true;
    loadVisionModelPreference().then((storedId) => {
      if (activo) setModelo(resolveProductoModel(storedId, modelos));
    });
    return () => {
      activo = false;
    };
  }, [modelos]);

  const elegir = useCallback(
    (id: string) => {
      const siguiente = resolveProductoModel(id, modelos);
      if (!siguiente) return;
      setModelo(siguiente);
      // Se aplica en memoria y se persiste en segundo plano: la elección no espera al disco.
      void saveVisionModelPreference(siguiente.id);
    },
    [modelos],
  );

  const value = useMemo<ModeloSupermercadoValue>(
    () => ({ modelo, modelos, elegir }),
    [modelo, modelos, elegir],
  );

  return (
    <ModeloSupermercadoContext.Provider value={value}>{children}</ModeloSupermercadoContext.Provider>
  );
}

export function useModeloSupermercado(): ModeloSupermercadoValue {
  const value = useContext(ModeloSupermercadoContext);
  if (!value) {
    throw new Error('useModeloSupermercado debe usarse dentro de ModeloSupermercadoProvider');
  }
  return value;
}
