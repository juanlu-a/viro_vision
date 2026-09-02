/**
 * El proxy propio de claves (ADR 0008).
 *
 * ⚠️ `EXPO_PUBLIC_*` se inlinea en el bundle en tiempo de build: no es una variable que el binario
 * lea al arrancar, es una constante compilada dentro del `.ipa`. Ésta en particular es una URL y no
 * un secreto, así que puede viajar; el punto del proxy es justamente que las CLAVES no lo hagan.
 */
export const proxyUrl = process.env.EXPO_PUBLIC_VISION_PROXY_URL ?? '';

/**
 * Con el proxy activo la app no necesita ninguna clave: las guarda el servidor. Es lo que hace
 * distribuible un build.
 */
export const isProxyConfigured = proxyUrl.length > 0;
