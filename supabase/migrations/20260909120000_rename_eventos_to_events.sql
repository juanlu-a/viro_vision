-- The telemetry table moves to English, together with the rest of the codebase (2026-09-09).
--
-- The previous migration is left untouched on purpose: it is already applied and a migration log is
-- append-only. This one renames rather than recreating, so the rows recorded since 2026-09-07 stay
-- where they are — they are the only diagnosis of the first field sessions and losing them to a
-- rename would be paying for tidiness with evidence.
--
-- The event vocabulary is translated too. It was tempting to leave the old rows with the old names,
-- but the `type` list is closed and the mapping is one to one, so a single UPDATE keeps every query
-- working across the whole history instead of forcing `type in ('reading.ok','lectura.ok')` forever.
-- Anything not in the map is left as it is: an unknown value is a bug worth seeing, not worth hiding.

alter table public.eventos rename to events;

alter table public.events rename column creado_en to created_at;
alter table public.events rename column momento   to occurred_at;
alter table public.events rename column telefono  to phone;
alter table public.events rename column sesion    to session;
alter table public.events rename column tipo      to type;
alter table public.events rename column detalle   to detail;

alter index if exists public.eventos_pkey          rename to events_pkey;
alter index if exists public.eventos_creado_en_idx rename to events_created_at_idx;
alter index if exists public.eventos_sesion_idx    rename to events_session_idx;
alter index if exists public.eventos_tipo_idx      rename to events_type_idx;

alter table public.events rename constraint eventos_tipo_corto    to events_type_short;
alter table public.events rename constraint eventos_detalle_chico to events_detail_small;

update public.events set type = map.new_type
from (values
  ('app.inicio',      'app.start'),
  ('app.fondo',       'app.background'),
  ('ble.buscando',    'ble.scanning'),
  ('ble.conectado',   'ble.connected'),
  ('ble.fallo',       'ble.failed'),
  ('ble.perdido',     'ble.lost'),
  ('ble.reintento',   'ble.retry'),
  ('ble.desconectado','ble.disconnected'),
  ('wifi.uniendose',  'wifi.joining'),
  ('wifi.listo',      'wifi.ready'),
  ('wifi.fallo',      'wifi.failed'),
  ('placa.estado',    'device.status'),
  ('placa.aviso',     'device.warning'),
  ('placa.modo',      'device.mode'),
  ('placa.modoFallo', 'device.modeFailed'),
  ('modo.cambio',     'mode.change'),
  ('lectura.inicio',  'reading.start'),
  ('lectura.ok',      'reading.ok'),
  ('lectura.fallo',   'reading.failed'),
  ('foto.ok',         'photo.ok'),
  ('foto.fallo',      'photo.failed'),
  ('ocr.carga',       'ocr.load'),
  ('nube.espera',     'cloud.wait'),
  ('audio.sintesis',  'audio.synthesis'),
  ('audio.envio',     'audio.send')
) as map(old_type, new_type)
where public.events.type = map.old_type;

comment on table public.events is 'ViroVision app telemetry: written by the telemetry Edge Function with the service role.';
