/**
 * El modelo de nube del modo supermercado: estado + persistencia.
 *
 * No es un Provider a propósito: tiene UN consumidor (Inicio) y ninguna consecuencia global — el
 * tema sí necesita contexto porque gatea el splash y alimenta la navegación; esto no. Si algún día
 * Ajustes también lo muestra, se promueve a Provider sin tocar el storage ni el resolver.
 */
import { useCallback, useEffect, useState } from 'react';

import { resolveProductoModel } from '@/features/reader/modeloSupermercado';
import {
  loadVisionModelPreference,
  saveVisionModelPreference,
} from '@/services/storage/visionModelPreference';
import { availableModels } from '@/services/vision';
import type { ModelProfile } from '@/services/vision';

export function useModeloSupermercado() {
  // Los disponibles no cambian en runtime (las claves se inlinean al compilar): se calculan una vez.
  const [modelos] = useState<readonly ModelProfile[]>(() => availableModels());
  const [modelo, setModelo] = useState<ModelProfile | null>(() => resolveProductoModel(null, modelos));

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

  return { modelo, modelos, elegir };
}
