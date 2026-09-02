/**
 * Existe porque un id guardado puede quedar inválido (modelo retirado del registro, o su proveedor
 * sin clave en este build) y sin esta revalidación el modo supermercado fallaría en silencio con
 * VisionNotConfiguredError en cada lectura. La tabla cubre cada caída del resolver.
 */
import { resolveProductoModel } from './modeloSupermercado';
import { DEFAULT_PRODUCTO_MODEL_ID, MODEL_PROFILES } from '@/services/vision';

const gemini = MODEL_PROFILES.filter((m) => m.provider === 'gemini');
const haiku = MODEL_PROFILES.find((m) => m.id === 'claude-haiku-4-5')!;
const porDefecto = MODEL_PROFILES.find((m) => m.id === DEFAULT_PRODUCTO_MODEL_ID)!;

/** Un build con las cuatro claves cargadas: el caso en que el usuario sí puede elegir. */
const todos = MODEL_PROFILES;

describe('resolveProductoModel', () => {
  it('respeta el guardado si está disponible', () => {
    // Lo elegido gana sobre el default: si no, cambiar de modelo en el selector no sobreviviría a
    // cerrar la app y el usuario volvería a Gemini sin entender por qué.
    expect(resolveProductoModel('claude-haiku-4-5', todos)?.id).toBe('claude-haiku-4-5');
    expect(resolveProductoModel('gpt-5.6-luna', todos)?.id).toBe('gpt-5.6-luna');
  });

  it('cae al default si el guardado ya no está en el registro (modelo retirado)', () => {
    // gemini-3.6-flash era el default hasta la medición de latencia del 30/08/2026.
    expect(resolveProductoModel('gemini-3.6-flash', gemini)?.id).toBe(DEFAULT_PRODUCTO_MODEL_ID);
  });

  it('cae al default si el guardado es de un proveedor sin clave en este build', () => {
    expect(resolveProductoModel('claude-haiku-4-5', gemini)?.id).toBe(DEFAULT_PRODUCTO_MODEL_ID);
  });

  it('sin nada guardado, elige el default (el Flash Lite fijado)', () => {
    expect(resolveProductoModel(null, gemini)).toBe(porDefecto);
  });

  it('si el default no está disponible, elige el primero que sí', () => {
    expect(resolveProductoModel(null, [haiku])).toBe(haiku);
  });

  it('sin modelos disponibles devuelve null: el modo avisa, no adivina', () => {
    expect(resolveProductoModel('gemini-3.5-flash-lite', [])).toBeNull();
  });
});
