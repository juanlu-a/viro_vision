/**
 * Exists because a stored id can turn invalid (model retired from the registry, or its provider
 * without a key in this build) and without this revalidation supermarket mode would fail silently
 * with VisionNotConfiguredError on every reading. The table covers every fallback of the resolver.
 */
import { resolveProductModel } from './productModel';
import { DEFAULT_PRODUCT_MODEL_ID, MODEL_PROFILES, RETIRED_PROFILES } from '@/services/vision';

/** A build with every key: the case where the user can actually choose. */
const all = MODEL_PROFILES;
const byDefault = MODEL_PROFILES.find((m) => m.id === DEFAULT_PRODUCT_MODEL_ID)!;
/** A build with ONE provider's key: the case where they cannot. */
const onlyDefault = [byDefault];
/** The other one in the selector, for the case where the default is not available. */
const theOther = MODEL_PROFILES.find((m) => m.id !== DEFAULT_PRODUCT_MODEL_ID)!;
/** A model that existed and is no longer offered: the scenario this resolver exists to cover. */
const retired = RETIRED_PROFILES[0];

describe('resolveProductModel', () => {
  it('honours the stored one when it is available', () => {
    // What was chosen beats the default: otherwise picking another model in the selector would not
    // survive closing the app, and the user would be back on the default without understanding why.
    expect(resolveProductModel(theOther.id, all)?.id).toBe(theOther.id);
  });

  it('falls back to the default when the stored one is no longer in the registry (retired model)', () => {
    // The real case: `gemini-3.5-flash-lite` was the default until 2026-09-02 and left the selector
    // over the latency measurement. Whoever had it stored cannot be left reading with a model the
    // app no longer offers.
    expect(resolveProductModel(retired.id, all)?.id).toBe(DEFAULT_PRODUCT_MODEL_ID);
  });

  it('falls back to the default when the stored one belongs to a provider with no key in this build', () => {
    expect(resolveProductModel(theOther.id, onlyDefault)?.id).toBe(DEFAULT_PRODUCT_MODEL_ID);
  });

  it('with nothing stored, picks the default', () => {
    expect(resolveProductModel(null, all)).toBe(byDefault);
  });

  it('when the default is not available, picks the first one that is', () => {
    expect(resolveProductModel(null, [theOther])).toBe(theOther);
  });

  it('with no models available it returns null: the mode says so, it does not guess', () => {
    expect(resolveProductModel(byDefault.id, [])).toBeNull();
  });
});
