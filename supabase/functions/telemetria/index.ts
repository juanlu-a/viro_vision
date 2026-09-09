/**
 * Telemetría de la app: recibe lotes de eventos y los guarda en `public.eventos`.
 *
 * Existe para ver a distancia qué pasó cuando alguien usa el dispositivo (2026-09-07): la app no
 * tiene clave de la base, así que manda acá y esta función inserta con el **service role**. Pesa más
 * desde el 2026-09-08, cuando la información técnica salió de las pantallas: esta tabla es hoy el
 * único diagnóstico que queda.
 *
 * ⚠️ **Este archivo se recuperó de la v1 desplegada** (`supabase functions download telemetria`,
 * 2026-09-09). La función se había escrito en el dashboard y no estaba versionada, que es
 * exactamente por qué nadie podía saber su contrato sin bajarla. Acá está con los tipos y el estilo
 * de la base; **la lógica es la misma, línea por línea**, así que desplegarlo no cambia nada.
 *
 * Sin auth de usuario a propósito (`verify_jwt = false`, igual que el proxy de visión, ADR 0008): la
 * app no tiene cuentas y una anon key dentro del bundle no sería una defensa. El costo de abuso es
 * ruido en una tabla de desarrollo, acotado por los dos topes de abajo.
 *
 * El espejo del lado de la app es `app/src/services/telemetria/tipos.ts`: si cambia el contrato acá,
 * cambia allá en el mismo PR.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

/** Más que esto por lote se recorta y se pierde la cola: la app manda de a 100 por eso. */
const MAX_EVENTOS_POR_LOTE = 100;

/**
 * Tope del detalle. Al pasarse se reemplaza el detalle **entero** por `{recortado: true}`, no la
 * parte de más: es la señal de que alguien mandó algo que no va acá (una imagen, un texto largo).
 */
const MAX_DETALLE_BYTES = 8_000;

interface EventoEntrante {
  tipo?: unknown;
  momento?: unknown;
  ms?: unknown;
  detalle?: unknown;
}

interface LoteEntrante {
  telefono?: unknown;
  sesion?: unknown;
  app?: unknown;
  eventos?: unknown;
}

function respuesta(status: number, cuerpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve(async (peticion: Request) => {
  if (peticion.method !== 'POST') return respuesta(405, { error: 'POST' });

  let lote: LoteEntrante;
  try {
    lote = await peticion.json();
  } catch {
    return respuesta(400, { error: 'JSON inválido' });
  }

  if (!lote?.telefono || !lote?.sesion || !Array.isArray(lote.eventos)) {
    return respuesta(400, { error: 'faltan telefono, sesion o eventos' });
  }

  // Un evento sin `tipo` o sin `momento` se descarta **en silencio**: la respuesta sigue siendo 200
  // con `guardados: 0`. Es la trampa del contrato, y por eso el cliente los pone siempre.
  const eventos = (lote.eventos as EventoEntrante[]).slice(0, MAX_EVENTOS_POR_LOTE).flatMap((e) => {
    if (!e?.tipo || !e?.momento) return [];
    let detalle: unknown = e.detalle ?? {};
    if (JSON.stringify(detalle).length > MAX_DETALLE_BYTES) detalle = { recortado: true };
    return [
      {
        telefono: String(lote.telefono).slice(0, 64),
        sesion: String(lote.sesion).slice(0, 64),
        app: lote.app ? String(lote.app).slice(0, 64) : null,
        tipo: String(e.tipo).slice(0, 64),
        momento: e.momento,
        ms: typeof e.ms === 'number' && Number.isFinite(e.ms) ? Math.round(e.ms) : null,
        detalle,
      },
    ];
  });

  if (eventos.length === 0) return respuesta(200, { guardados: 0 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { error } = await supabase.from('eventos').insert(eventos);
  if (error) return respuesta(500, { error: error.message });

  return respuesta(200, { guardados: eventos.length });
});
