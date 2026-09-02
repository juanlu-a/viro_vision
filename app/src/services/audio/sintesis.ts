/**
 * Síntesis de voz **a archivo**, para el parlante del dispositivo.
 *
 * No reemplaza al anuncio. `expo-speech` (ver `tts.ts`) sigue diciendo la lectura por el parlante
 * del teléfono, instantáneo y sin red; esto además deja un `.mp3` en disco, que es lo que en el
 * diagrama acordado viaja del smartphone al parlante del dispositivo por BLE/WiFi
 * (`docs/architecture/README.md`). `expo-speech` usa el motor del sistema y **no exporta a
 * archivo**, así que el archivo tiene que venir de un TTS de nube.
 *
 * **Apagado por defecto.** Hoy nada consume el archivo: el hardware no existe, y cuando exista hay
 * una decisión abierta (ADR 0003) que puede volverlo innecesario — si el transporte termina siendo
 * BLE, quizá convenga que la Raspi haga su propio TTS y sólo reciba el JSON. Un MP3 de ~3 s a
 * 32 kbps son ~12 KB: por WiFi es nada, por GATT es del orden de segundos. Mientras tanto, dejarlo
 * prendido sería pagar una llamada a la API en cada lectura para producir un archivo que nadie abre.
 *
 * **Nunca bloquea el anuncio.** Se llama después de `announce()` y sin `await` en el camino crítico:
 * si falla, el usuario ya escuchó el producto. Eso es lo que significa que la accesibilidad sea el
 * criterio de diseño y no una capa — el archivo existe para un hardware que todavía no existe, y no
 * puede degradar lo que hoy funciona.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { fetch } from 'expo/fetch';

import { isProxyConfigured, proxyUrl, resolverTransporte } from '@/services/cloud';
import type { CloudRequest } from '@/services/cloud';

import { SintesisNoConfiguradaError, SintesisRemotaError } from './errors';

/** Prendido con `EXPO_PUBLIC_AUDIO_FILE_ENABLED=1`. Ver el comentario de arriba. */
export const isSintesisHabilitada = (process.env.EXPO_PUBLIC_AUDIO_FILE_ENABLED ?? '') === '1';

const openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';

const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech';

/**
 * Se usa el TTS de OpenAI y no el de Google por dos motivos concretos:
 *   - una clave de AI Studio (la de Gemini que ya tenemos) **no** tiene habilitada la API de Cloud
 *     Text-to-Speech: son proyectos distintos, así que no sirve la clave que ya está;
 *   - el TTS nativo de Gemini devuelve **PCM crudo**, no MP3, y habría que armar el header WAV a
 *     mano en React Native.
 * Éste devuelve el MP3 directo y usa la clave de OpenAI que el selector de modelos ya necesita.
 */
const MODELO_DE_VOZ = 'gpt-4o-mini-tts';
const VOZ = 'alloy';

/** Tope de la API. Truncar es preferible a un 400 que deja al usuario sin archivo y sin motivo. */
export const MAX_CARACTERES = 4096;

/** Carpeta de los audios. `cache` y no `document`: son regenerables y el sistema puede limpiarlos. */
const CARPETA = 'lecturas';

/**
 * Arma el pedido de voz. Módulo puro, sin red — ver `sintesis.test.ts`.
 *
 * Sale por el mismo proxy que la lectura de producto (ADR 0008): `/v1/audio/speech` está en
 * `api.openai.com`, que ya está en la allowlist de la función. Validar por host y no por URL exacta
 * es lo que hace que esto no necesite ningún cambio del lado del servidor.
 *
 * `apiKey` y `proxy` son inyectables **para que el test no dependa del entorno**, que es la lección
 * de un fallo real: la versión anterior los leía sólo de `process.env`, y el test que afirmaba
 * "sin proxy sale directo a OpenAI" pasaba en local —jest no carga `.env`— y fallaba en el job de
 * publicación, donde la variable del proxy sí está. El test estaba midiendo el ambiente, no el
 * código. Mismo criterio que el reloj inyectable del limitador de cuota.
 */
export function construirPedidoDeVoz(
  texto: string,
  apiKey: string = openaiApiKey,
  proxy: string = proxyUrl,
): CloudRequest {
  return resolverTransporte(
    {
      url: OPENAI_SPEECH_URL,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: {
        model: MODELO_DE_VOZ,
        voice: VOZ,
        input: texto.slice(0, MAX_CARACTERES),
        response_format: 'mp3',
      },
    },
    'openai',
    proxy,
  );
}

/** Nombre estable y ordenable, para poder mirar la carpeta y saber cuál es la última lectura. */
export function nombreDeArchivo(cuando: Date): string {
  return `lectura-${cuando.toISOString().replace(/[:.]/g, '-')}.mp3`;
}

/**
 * Sintetiza `texto` y lo deja en disco. Devuelve el `file://` del archivo.
 *
 * Lanza error tipado en vez de devolver null: quien lo llama decide si lo ignora (el camino de
 * lectura lo ignora a propósito) o lo muestra (una pantalla de diagnóstico querría verlo).
 */
export async function sintetizarAArchivo(
  texto: string,
  cuando: Date = new Date(),
): Promise<string> {
  if (!isSintesisHabilitada) throw new SintesisNoConfiguradaError('AUDIO_FILE_DESHABILITADO');
  // Con proxy la clave la pone el servidor, así que no tenerla acá no es un problema.
  if (!isProxyConfigured && openaiApiKey === '') {
    throw new SintesisNoConfiguradaError('SIN_CLAVE_NI_PROXY');
  }

  const pedido = construirPedidoDeVoz(texto);
  const respuesta = await fetch(pedido.url, {
    method: 'POST',
    headers: pedido.headers,
    body: JSON.stringify(pedido.body),
  });

  if (!respuesta.ok) {
    throw new SintesisRemotaError(respuesta.status, await respuesta.text());
  }

  // El endpoint devuelve el MP3 en binario, no en base64: hay que escribir bytes, no una cadena.
  const bytes = new Uint8Array(await respuesta.arrayBuffer());

  const carpeta = new Directory(Paths.cache, CARPETA);
  if (!carpeta.exists) carpeta.create({ idempotent: true });

  const archivo = new File(carpeta, nombreDeArchivo(cuando));
  archivo.create({ overwrite: true });
  archivo.write(bytes);

  return archivo.uri;
}
