/**
 * Supermarket mode's cloud model: state + persistence, shared by the whole app.
 *
 * It was a local hook while the selector lived on Home, next to its only consumer. Now the selector
 * is in Settings and the one that reads is Home: with two instances of the hook each screen would
 * have its own `useState` and choosing in Settings would not change the model Home reads with — the
 * choice would look applied and would not be until a remount. That is why it is a Provider: one
 * state, with the storage and the resolver untouched.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { resolveProductModel } from '@/features/reader/productModel';
import {
  loadVisionModelPreference,
  saveVisionModelPreference,
} from '@/services/storage/visionModelPreference';
import { availableModels } from '@/services/vision';
import type { ModelProfile } from '@/services/vision';

interface ProductModelValue {
  /** The model in force, or null when this build ships no key at all. */
  model: ModelProfile | null;
  /** The eligible ones in THIS build (only providers with a key). */
  models: readonly ModelProfile[];
  choose: (id: string) => void;
}

const ProductModelContext = createContext<ProductModelValue | null>(null);

export function ProductModelProvider({ children }: { children: React.ReactNode }) {
  // The available ones do not change at runtime (keys are inlined at build time): computed once.
  const [models] = useState<readonly ModelProfile[]>(() => availableModels());
  const [model, setModel] = useState<ModelProfile | null>(() =>
    resolveProductModel(null, models),
  );

  useEffect(() => {
    let active = true;
    loadVisionModelPreference().then((storedId) => {
      if (active) setModel(resolveProductModel(storedId, models));
    });
    return () => {
      active = false;
    };
  }, [models]);

  const choose = useCallback(
    (id: string) => {
      const next = resolveProductModel(id, models);
      if (!next) return;
      setModel(next);
      // Applied in memory and persisted in the background: the choice does not wait for the disk.
      void saveVisionModelPreference(next.id);
    },
    [models],
  );

  const value = useMemo<ProductModelValue>(
    () => ({ model, models, choose }),
    [model, models, choose],
  );

  return (
    <ProductModelContext.Provider value={value}>{children}</ProductModelContext.Provider>
  );
}

export function useProductModel(): ProductModelValue {
  const value = useContext(ProductModelContext);
  if (!value) {
    throw new Error('useProductModel must be used within a ProductModelProvider');
  }
  return value;
}
