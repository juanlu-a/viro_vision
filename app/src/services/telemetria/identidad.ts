/**
 * Quién manda los eventos: un teléfono y una sesión.
 *
 * **`telefono` es un identificador anónimo generado por la app**, no el IMEI, ni el id de
 * publicidad, ni nada del sistema: un número al azar que se guarda en AsyncStorage la primera vez.
 * No identifica a una persona, identifica a una instalación, que es lo único que hace falta para
 * saber si dos fallas vienen del mismo aparato. Se pierde al desinstalar, y está bien que se pierda.
 *
 * **`sesion` cambia en cada arranque de la app.** Es lo que permite reconstruir "qué pasó esa vez":
 * los eventos de un intento fallido son los que comparten sesión, y sin eso una tabla con varios
 * días de uso no se puede leer.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TELEFONO_KEY = 'virovision.telemetria.telefono';

/**
 * Un identificador corto y aleatorio. `Math.random` alcanza: no protege nada, sólo tiene que no
 * repetirse entre los pocos teléfonos del proyecto, y no vale traer una dependencia de UUID para eso.
 */
export function generarId(prefijo: string, azar: () => number = Math.random): string {
  const parte = () => Math.floor(azar() * 0xffffffff).toString(16).padStart(8, '0');
  return `${prefijo}-${parte()}${parte()}`;
}

/**
 * Lee el id guardado o crea uno. Ante cualquier fallo de AsyncStorage devuelve uno efímero en vez
 * de romper: perder la continuidad entre sesiones es mucho más barato que perder la telemetría.
 */
export async function obtenerTelefono(
  storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem'> = AsyncStorage,
  azar: () => number = Math.random
): Promise<string> {
  try {
    const guardado = await storage.getItem(TELEFONO_KEY);
    if (guardado) return guardado;
    const nuevo = generarId('tel', azar);
    await storage.setItem(TELEFONO_KEY, nuevo);
    return nuevo;
  } catch {
    return generarId('tel-efimero', azar);
  }
}
