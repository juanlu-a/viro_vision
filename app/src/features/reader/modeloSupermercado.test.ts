/**
 * Existe porque un id guardado puede quedar inválido (modelo retirado del registro, o su proveedor
 * sin clave en este build) y sin esta revalidación el modo supermercado fallaría en silencio con
 * VisionNotConfiguredError en cada lectura. La tabla cubre cada caída del resolver.
 */
import { resolveProductoModel } from './modeloSupermercado';
import { DEFAULT_PRODUCTO_MODEL_ID, MODEL_PROFILES } from '@/services/vision';

const gemini = MODEL_PROFILES.filter((m) => m.provider === 'gemini');
const haiku = MODEL_PROFILES.find((m) => m.id === 'claude-haiku-4-5')!;
const flash = MODEL_PROFILES.find((m) => m.id === DEFAULT_PRODUCTO_MODEL_ID)!;

describe('resolveProductoModel', () => {
  it('respeta el guardado si está disponible', () => {
    expect(resolveProductoModel('gemini-flash-lite-latest', gemini)?.id).toBe('gemini-flash-lite-latest');
  });

  it('cae al default si el guardado es de un proveedor sin clave en este build', () => {
    expect(resolveProductoModel('claude-haiku-4-5', gemini)?.id).toBe(DEFAULT_PRODUCTO_MODEL_ID);
  });

  it('sin nada guardado, elige el default (Flash, no Lite)', () => {
    expect(resolveProductoModel(null, gemini)).toBe(flash);
  });

  it('si el default no está disponible, elige el primero que sí', () => {
    expect(resolveProductoModel(null, [haiku])).toBe(haiku);
  });

  it('sin modelos disponibles devuelve null: el modo avisa, no adivina', () => {
    expect(resolveProductoModel('gemini-3.6-flash', [])).toBeNull();
  });
});
