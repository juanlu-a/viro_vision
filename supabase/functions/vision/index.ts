/**
 * Proxy de visión: la app pide una lectura, esta función le pone la clave (ADR 0008).
 *
 * Es un **proxy tonto a propósito**. No interpreta la respuesta, no arma el request y no conoce
 * los prompts: recibe el cuerpo que el proveedor del cliente ya armó, le agrega la cabecera de
 * autenticación desde los secrets y devuelve el body upstream tal cual. Así la lógica de proveedor
 * NO se duplica del lado del servidor —no hay dos copias que se desincronicen— y agregar un modelo
 * sigue siendo un cambio en la app, no un despliegue acá.
 *
 * Lo que sí vive acá, porque no puede vivir en el cliente:
 *   - las claves;
 *   - la allowlist de hosts, que es lo que impide que esto sea un SSRF que le regale la clave al
 *     primero que pida;
 *   - un freno por IP.
 *
 * Despliegue y secrets: `docs/supabase.md`.
 *
 * ⚠️ NO está autenticado (`verify_jwt = false`): la app no tiene login (ADR 0002) y la anon key
 * viajaría igual en el bundle, así que exigirla sería una indirección, no una defensa. El endpoint
 * es abusable y eso está aceptado a conciencia en ADR 0008: lo que compra el proxy no es volverlo
 * inabusable, es poder rotar o cortar la clave en segundos sin publicar una versión de la app. Las
 * defensas reales son el freno de acá abajo y el TOPE DE GASTO en la consola de cada proveedor.
 */

/**
 * Qué proveedores se pueden alcanzar, y con qué clave.
 *
 * El cliente manda a **qué proveedor** va y la URL que armó su módulo, pero sólo se acepta si el
 * host de esa URL es el que este cuadro dice. Es la guarda central: un proxy que reenvía a la URL
 * que le pasen le entrega la clave a cualquiera que le pida un redirect a su propio servidor.
 *
 * Se valida por **host** y no por URL exacta a propósito: el path lo elige el módulo del cliente
 * (que sabe si el proveedor usa `/v1/messages` o `/v1/chat/completions`), y así este archivo no
 * tiene que enterarse cada vez que la app agrega un modelo.
 */
const PROVEEDORES: Record<
  string,
  { host: string; secret: string; headers: (clave: string) => Record<string, string> }
> = {
  gemini: {
    host: 'generativelanguage.googleapis.com',
    secret: 'GEMINI_API_KEY',
    headers: (clave) => ({ 'x-goog-api-key': clave }),
  },
  openai: {
    host: 'api.openai.com',
    secret: 'OPENAI_API_KEY',
    headers: (clave) => ({ authorization: `Bearer ${clave}` }),
  },
  anthropic: {
    host: 'api.anthropic.com',
    secret: 'ANTHROPIC_API_KEY',
    // La versión la pone el servidor y no el cliente: es parte de con qué API hablamos, no de qué
    // le preguntamos al modelo.
    headers: (clave) => ({ 'x-api-key': clave, 'anthropic-version': '2023-06-01' }),
  },
  groq: {
    host: 'api.groq.com',
    secret: 'GROQ_API_KEY',
    headers: (clave) => ({ authorization: `Bearer ${clave}` }),
  },
};

/** Ventana y tope del freno por IP. */
const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 30;

/**
 * Freno por IP, en memoria del isolate.
 *
 * Es **un badén, no una pared**: Supabase puede levantar varios isolates y cada uno cuenta lo suyo,
 * así que un atacante decidido pasa. Sirve para lo que sí pasa en la práctica —un bucle de la app
 * o un curl repetido— y cuesta cero. La defensa real contra el abuso sostenido es el tope de gasto
 * en cada proveedor, más poder apagar esta función.
 */
const golpes = new Map<string, number[]>();

function superaElFreno(ip: string, ahora: number): boolean {
  const recientes = (golpes.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (recientes.length >= MAX_POR_VENTANA) {
    golpes.set(ip, recientes);
    return true;
  }
  recientes.push(ahora);
  golpes.set(ip, recientes);
  return false;
}

function json(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve(async (peticion: Request): Promise<Response> => {
  if (peticion.method !== 'POST') return json(405, { error: { message: 'Sólo POST.' } });

  const ip =
    peticion.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconocida';
  if (superaElFreno(ip, Date.now())) {
    // Mismo código que usan los proveedores para la cuota: el cliente ya sabe distinguirlo y
    // esperar en vez de abortar la serie.
    return json(429, {
      error: { code: 'rate_limit_exceeded', message: 'Demasiadas lecturas. Try again in 60s.' },
    });
  }

  let sobre: { provider?: unknown; url?: unknown; body?: unknown };
  try {
    sobre = await peticion.json();
  } catch {
    return json(400, { error: { message: 'Cuerpo no es JSON.' } });
  }

  const proveedor = typeof sobre.provider === 'string' ? PROVEEDORES[sobre.provider] : undefined;
  if (!proveedor) {
    return json(400, { error: { message: `Proveedor desconocido: ${String(sobre.provider)}` } });
  }

  if (typeof sobre.url !== 'string' || typeof sobre.body !== 'object' || sobre.body === null) {
    return json(400, { error: { message: 'Faltan `url` o `body`.' } });
  }

  // LA guarda. Sin esto, `url` es un agujero por el que la clave sale hacia donde el atacante
  // quiera: basta con pedir el reenvío a su propio host.
  let destino: URL;
  try {
    destino = new URL(sobre.url);
  } catch {
    return json(400, { error: { message: 'URL inválida.' } });
  }
  if (destino.protocol !== 'https:' || destino.host !== proveedor.host) {
    return json(400, {
      error: { message: `El destino no corresponde al proveedor: ${destino.host}` },
    });
  }

  const clave = Deno.env.get(proveedor.secret) ?? '';
  if (clave === '') {
    // 503 y no 500: no está roto, está sin configurar. El mensaje nombra el secret que falta para
    // que el arreglo sea obvio sin abrir los logs.
    return json(503, {
      error: { message: `El proxy no tiene ${proveedor.secret} configurado (supabase secrets set).` },
    });
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(destino, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...proveedor.headers(clave) },
      body: JSON.stringify(sobre.body),
    });
  } catch (err) {
    return json(502, {
      error: { message: `No se pudo alcanzar al proveedor: ${(err as Error).message}` },
    });
  }

  // El pasamanos: el cuerpo del proveedor se devuelve SIN tocar, incluido el stream SSE. Leerlo
  // acá para reenviarlo obligaría a duplicar el parseo de eventos de cada proveedor y mataría el
  // streaming — el cliente vería la respuesta entera de golpe en vez de a medida que llega.
  return new Response(respuesta.body, {
    status: respuesta.status,
    headers: {
      'content-type': respuesta.headers.get('content-type') ?? 'text/event-stream',
      'cache-control': 'no-cache',
    },
  });
});
