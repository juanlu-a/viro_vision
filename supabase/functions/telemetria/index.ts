// Telemetría de la app: recibe lotes de eventos y los guarda en public.eventos.
//
// Existe para ver a distancia qué pasó cuando alguien usa el dispositivo (2026-09-07): la app no
// tiene clave de la base; manda a esta función, que inserta con el service role. Sin auth de
// usuario a propósito (la app no tiene cuentas): el costo de abuso es ruido en una tabla de
// desarrollo, acotado por los límites de abajo.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAX_EVENTOS_POR_LOTE = 100;
const MAX_DETALLE_BYTES = 8_000;

interface EventoEntrante {
  tipo: string;
  momento: string;
  ms?: number | null;
  detalle?: Record<string, unknown>;
}
interface Lote {
  telefono: string;
  sesion: string;
  app?: string;
  eventos: EventoEntrante[];
}

function respuesta(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
}

Deno.serve(async (peticion: Request): Promise<Response> => {
  if (peticion.method !== 'POST') return respuesta(405, { error: 'POST' });
  let lote: Lote;
  try {
    lote = await peticion.json();
  } catch {
    return respuesta(400, { error: 'JSON inválido' });
  }
  if (!lote?.telefono || !lote?.sesion || !Array.isArray(lote.eventos)) {
    return respuesta(400, { error: 'faltan telefono, sesion o eventos' });
  }
  const eventos = lote.eventos.slice(0, MAX_EVENTOS_POR_LOTE).flatMap((e) => {
    if (!e?.tipo || !e?.momento) return [];
    let detalle = e.detalle ?? {};
    if (JSON.stringify(detalle).length > MAX_DETALLE_BYTES) detalle = { recortado: true };
    return [{
      telefono: String(lote.telefono).slice(0, 64),
      sesion: String(lote.sesion).slice(0, 64),
      app: lote.app ? String(lote.app).slice(0, 64) : null,
      tipo: String(e.tipo).slice(0, 64),
      momento: e.momento,
      ms: typeof e.ms === 'number' && Number.isFinite(e.ms) ? Math.round(e.ms) : null,
      detalle,
    }];
  });
  if (eventos.length === 0) return respuesta(200, { guardados: 0 });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await supabase.from('eventos').insert(eventos);
  if (error) return respuesta(500, { error: error.message });
  return respuesta(200, { guardados: eventos.length });
});
