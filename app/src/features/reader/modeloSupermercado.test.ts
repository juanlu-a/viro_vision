/**
 * Existe porque un id guardado puede quedar inválido (modelo retirado del registro, o su proveedor
 * sin clave en este build) y sin esta revalidación el modo supermercado fallaría en silencio con
 * VisionNotConfiguredError en cada lectura. La tabla cubre cada caída del resolver.
 */
import { resolveProductoModel } from './modeloSupermercado';
import { DEFAULT_PRODUCTO_MODEL_ID, MODEL_PROFILES, PERFILES_RETIRADOS } from '@/services/vision';

/** Un build con todas las claves: el caso en que el usuario sí puede elegir. */
const todos = MODEL_PROFILES;
const porDefecto = MODEL_PROFILES.find((m) => m.id === DEFAULT_PRODUCTO_MODEL_ID)!;
/** Un build con la clave de UN solo proveedor: el caso en que no puede. */
const soloDefault = [porDefecto];
/** El otro del selector, para el caso en que el default no está disponible. */
const elOtro = MODEL_PROFILES.find((m) => m.id !== DEFAULT_PRODUCTO_MODEL_ID)!;
/** Un modelo que existió y ya no se ofrece: el escenario que este resolver existe para cubrir. */
const retirado = PERFILES_RETIRADOS[0];

describe('resolveProductoModel', () => {
  it('respeta el guardado si está disponible', () => {
    // Lo elegido gana sobre el default: si no, cambiar de modelo en el selector no sobreviviría a
    // cerrar la app y el usuario volvería al default sin entender por qué.
    expect(resolveProductoModel(elOtro.id, todos)?.id).toBe(elOtro.id);
  });

  it('cae al default si el guardado ya no está en el registro (modelo retirado)', () => {
    // El caso real: `gemini-3.5-flash-lite` fue el default hasta el 2026-09-02 y salió del selector
    // por la medición de latencia. Quien lo tuviera guardado no puede quedar leyendo con un modelo
    // que la app ya no ofrece.
    expect(resolveProductoModel(retirado.id, todos)?.id).toBe(DEFAULT_PRODUCTO_MODEL_ID);
  });

  it('cae al default si el guardado es de un proveedor sin clave en este build', () => {
    expect(resolveProductoModel(elOtro.id, soloDefault)?.id).toBe(DEFAULT_PRODUCTO_MODEL_ID);
  });

  it('sin nada guardado, elige el default', () => {
    expect(resolveProductoModel(null, todos)).toBe(porDefecto);
  });

  it('si el default no está disponible, elige el primero que sí', () => {
    expect(resolveProductoModel(null, [elOtro])).toBe(elOtro);
  });

  it('sin modelos disponibles devuelve null: el modo avisa, no adivina', () => {
    expect(resolveProductoModel(porDefecto.id, [])).toBeNull();
  });
});
