-- Eventos de uso de la app y del dispositivo (telemetría de desarrollo, 2026-09-07).
--
-- Este archivo venía de la rama `feat/telemetria-supabase`, que creó la tabla el 2026-09-07 y
-- **nunca se mergeó**: por eso el esquema estuvo dos días sin existir en `staging`. Se recupera tal
-- cual, con su fecha original, y se verificó contra la base real con `supabase db dump` el
-- 2026-09-09: coincide campo por campo, índice por índice.
--
-- Los escribe sólo la Edge Function `telemetria` con la clave de servidor; la app nunca toca la
-- tabla directo (RLS habilitado y sin políticas: para anon/authenticated no existe). Sirve para
-- ver a distancia qué pasó en cada sesión: conexión BLE, red con la placa, cada lectura con sus
-- tiempos, errores. No hay usuarios: `telefono` es un id aleatorio que la app genera una vez.
create table if not exists public.eventos (
  id          bigint generated always as identity primary key,
  creado_en   timestamptz not null default now(),   -- cuándo llegó al servidor
  momento     timestamptz not null,                 -- cuándo pasó en el teléfono
  telefono    text not null,                        -- id anónimo del teléfono (UUID generado por la app)
  sesion      text not null,                        -- id por arranque de la app
  tipo        text not null,                        -- p. ej. ble_conectado, wifi_lista, lectura, error
  ms          integer,                              -- duración, cuando aplica
  detalle     jsonb not null default '{}'::jsonb,   -- lo demás, por tipo
  app         text,                                 -- versión/build de la app que lo mandó
  constraint eventos_tipo_corto check (char_length(tipo) <= 64),
  constraint eventos_detalle_chico check (pg_column_size(detalle) <= 8192)
);

create index if not exists eventos_creado_en_idx on public.eventos (creado_en desc);
create index if not exists eventos_sesion_idx on public.eventos (sesion, momento);
create index if not exists eventos_tipo_idx on public.eventos (tipo, creado_en desc);

alter table public.eventos enable row level security;
-- Sin políticas a propósito: sólo el service role (la función) lee y escribe.

comment on table public.eventos is 'Telemetría de la app ViroVision: la escribe la Edge Function telemetria con service role.';
