/**
 * Por dónde sale el request de visión: directo al proveedor, o por el proxy propio (ADR 0008).
 *
 * REGLA DE FRONTERA (ADR 0001 + ADR 0006): esto es parte del camino de supermercado y **no puede
 * llamarse desde el camino de ómnibus**, que corre local sobre la TPU y el OCR. Un proxy en el
 * medio agrega un salto de red a un camino que ADR 0001 exige que funcione sin internet.
 *
 * TENSIÓN A NOMBRAR, para que nadie la lea como una violación: el boundary rule de
 * `services/supabase/client.ts` prohíbe **la cuenta online** en el camino de reconocimiento. Esto
 * usa la *infraestructura* de Supabase, no la cuenta: no hay sesión, ni usuario, ni tabla. Es una
 * función HTTP que da la casualidad de estar hospedada en el mismo proveedor. La regla sigue
 * vigente tal como está escrita.
 *
 * Módulo puro: decide una URL y un sobre, no toca la red. Ver transport.test.ts.
 */
import { visionProxyUrl } from './config';
import type { ProviderRequest, VisionProviderId } from './types';

/**
 * Reescribe el request hacia el proxy, o lo deja pasar si no hay proxy configurado.
 *
 * Las cabeceras del proveedor **se descartan**: son las que llevan la clave, y el punto entero del
 * proxy es que la clave no salga del servidor. El proxy las reconstruye desde sus secrets — por eso
 * también reconstruye `anthropic-version`, que es parte de con qué API hablamos y no de qué le
 * preguntamos al modelo.
 *
 * La URL sí viaja, y el proxy la valida contra la allowlist de hosts del proveedor declarado. Va
 * desde acá y no desde una tabla del servidor para que el path lo siga eligiendo el módulo del
 * proveedor —que es el que sabe si su API es `/v1/messages` o `/v1/chat/completions`— y agregar un
 * modelo no obligue a redesplegar la función.
 */
export function resolverTransporte(
  request: ProviderRequest,
  provider: VisionProviderId,
  proxyUrl: string = visionProxyUrl,
): ProviderRequest {
  if (proxyUrl === '') return request;

  return {
    url: proxyUrl,
    headers: { 'content-type': 'application/json' },
    body: { provider, url: request.url, body: request.body },
  };
}
