#!/usr/bin/env node
/**
 * Falla si el build va a salir SIN ningún modelo de nube disponible.
 *
 * Existe por un fallo real (2026-09-02): al sacar Gemini del selector, el único secret de proveedor
 * que tenía el repo dejó de corresponder a un modelo del registro. El build salió a TestFlight con
 * `availableModels()` en vacío y el modo supermercado muerto — la app degradó bien, dijo "no
 * configurado" y no rompió, pero **nadie se enteró hasta abrirla**. Un build que no puede cumplir
 * la mitad de su función no debería tardar 30 minutos en decirlo.
 *
 * Lo que compara es lo que se desincronizó: los proveedores que el **registro** ofrece contra las
 * claves que el **entorno** trae. Chequear sólo "hay alguna clave" no habría detectado nada, porque
 * la de Gemini estaba ahí; lo que faltaba era una clave de un proveedor *que siguiera en la lista*.
 *
 * Corre antes del build (ver .github/workflows/testflight.yml) y en local con `npm run claves`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = readFileSync(join(raiz, 'src/services/vision/config.ts'), 'utf8');

/**
 * En local, las claves viven en `app/.env` y este script corre con `node`, que no lo carga solo
 * (Expo sí lo hace para sus propios comandos). Sin esto `npm run claves` diría que faltan claves que
 * están ahí, y el aviso perdería credibilidad justo donde tiene que servir. En CI el archivo no
 * existe y las variables vienen del entorno, así que el bloque no hace nada.
 *
 * Lo de `process.env` gana: si CI define una variable, no la pisa un .env que se coló en el runner.
 */
try {
  for (const linea of readFileSync(join(raiz, '.env'), 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(linea);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {
  // Sin .env: es el caso de CI.
}

/** Nombre de la env var de cada proveedor. Espeja `apiKeyFor` en config.ts. */
const CLAVE_DE = {
  gemini: 'EXPO_PUBLIC_GEMINI_API_KEY',
  openai: 'EXPO_PUBLIC_OPENAI_API_KEY',
  anthropic: 'EXPO_PUBLIC_ANTHROPIC_API_KEY',
  groq: 'EXPO_PUBLIC_GROQ_API_KEY',
};

/**
 * Los proveedores que el selector ofrece hoy, leídos del registro.
 *
 * Se acota a `MODEL_PROFILES` a propósito: `PERFILES_RETIRADOS` está en el mismo archivo y tomar
 * sus proveedores haría pasar el chequeo con la clave de un modelo que la app ya no ofrece — que es
 * exactamente el fallo que esto previene.
 */
function proveedoresDelSelector() {
  const desde = config.indexOf('export const MODEL_PROFILES');
  if (desde === -1) throw new Error('No se encontró MODEL_PROFILES en config.ts.');
  const hasta = config.indexOf('\n];', desde);
  if (hasta === -1) throw new Error('No se pudo delimitar MODEL_PROFILES en config.ts.');

  const bloque = config.slice(desde, hasta);
  const encontrados = [...bloque.matchAll(/provider:\s*'([a-z]+)'/g)].map((m) => m[1]);
  if (encontrados.length === 0) throw new Error('MODEL_PROFILES quedó sin ningún modelo.');
  return [...new Set(encontrados)];
}

const proveedores = proveedoresDelSelector();
const proxy = (process.env.EXPO_PUBLIC_VISION_PROXY_URL ?? '').trim();
const conClave = proveedores.filter((p) => (process.env[CLAVE_DE[p]] ?? '').trim() !== '');

// Con el proxy las claves las tiene el servidor: alcanza con que esté la URL (ADR 0008).
if (proxy !== '') {
  console.log(`✅ Proxy configurado (${proxy.replace(/\/\/[^/]+/, '//…')}). Los modelos salen por ahí.`);
  process.exit(0);
}

if (conClave.length > 0) {
  console.log(`✅ Modo supermercado disponible con: ${conClave.join(', ')}.`);
  const sinClave = proveedores.filter((p) => !conClave.includes(p));
  if (sinClave.length > 0) {
    console.log(`ℹ️  Sin clave, quedan fuera del selector: ${sinClave.map((p) => `${p} (${CLAVE_DE[p]})`).join(', ')}.`);
  }
  process.exit(0);
}

console.error(`
❌ Este build saldría SIN modo supermercado.

   El selector ofrece: ${proveedores.join(', ')}
   Claves presentes:   ninguna de esas
   Proxy:              no configurado

   La app no rompe —dice "no configurado" y el modo ómnibus sigue leyendo— pero la mitad de su
   función no existe en este build, y eso no se ve hasta abrirla.

   Para arreglarlo, cargá UNA de estas como secret del repo (o en app/.env para un build local):
${proveedores.map((p) => `     · ${CLAVE_DE[p]}`).join('\n')}
     · EXPO_PUBLIC_VISION_PROXY_URL   ← lo preferible: las claves quedan en el servidor (ADR 0008)

   REGLA (ADR 0008): una clave GRATUITA sin tarjeta puede ir al bundle; una PAGA, no. El bundle es
   legible, y el peor caso de que roben una gratis es que te quemen una cuota — el de una paga es la
   tarjeta del proyecto. Las pagas esperan al proxy.
`);
process.exit(1);
