# Tiempos del modo supermercado según la telemetría (al 23 de noviembre de 2026)

Fuente de la Tabla 42 de la tesis (sec. 9.5). Consulta hecha el 24 de noviembre de 2026 sobre la
tabla `events` del proyecto de Supabase de ViroVision, con los eventos registrados entre el 9 de
septiembre y el fin del 23 de noviembre de 2026, hora de Montevideo (UTC−3). Los eventos provienen
del uso del sistema por el equipo durante el desarrollo, con un único teléfono, y no de un protocolo
de prueba.

## Consultas

```sql
-- Consulta al modelo, por modelo que respondió (reading.ok ya lleva el modo)
select detail->>'model' as model, count(*) as n,
       round(percentile_cont(0.5) within group (order by ms)) as median_ms,
       round(percentile_cont(0.9) within group (order by ms)) as p90_ms
from events
where occurred_at >= '2026-09-09 00:00:00-03' and occurred_at < '2026-11-24 00:00:00-03'
  and type = 'reading.ok' and detail->>'mode' = 'supermarket'
group by 1;

-- Foto, síntesis y envío: el modo se atribuye con el reading.start más reciente de la misma sesión
with e as (
  select * from events
  where occurred_at >= '2026-09-09 00:00:00-03' and occurred_at < '2026-11-24 00:00:00-03'
), t as (
  select e.type, e.ms, e.detail,
         (select s.detail->>'mode' from e s
          where s.type = 'reading.start' and s.session = e.session and s.occurred_at <= e.occurred_at
          order by s.occurred_at desc limit 1) as mode
  from e where e.type in ('photo.ok', 'audio.synthesis', 'audio.send')
)
select type, mode, count(*) as n,
       round(percentile_cont(0.5) within group (order by ms)) as median_ms,
       round(percentile_cont(0.9) within group (order by ms)) as p90_ms
from t
where type <> 'audio.send' or detail->>'sent' = 'true'
group by 1, 2 order by 1, 2;
```

## Resultados

| Etapa (evento) | n | Mediana | Percentil 90 |
|---|---|---|---|
| Descarga de la foto (`photo.ok`) | 110 | 282 ms | 900 ms |
| Consulta a gpt-5.6-luna (`reading.ok`) | 81 | 1.941 ms | 3.072 ms |
| Consulta a qwen/qwen3.8-27b (`reading.ok`) | 27 | 1.142 ms | 1.861 ms |
| Síntesis de voz en la nube (`audio.synthesis`) | 38 | 2.128 ms | 2.842 ms |
| Envío del audio al dispositivo (`audio.send`, exitosos) | 38 | 230 ms | 657 ms |

Sólo se cuentan los eventos atribuidos al modo supermercado. Quedaron afuera 6 `photo.ok` y 7
`audio.synthesis` de sesiones anteriores a que existiera el evento `reading.start`, cuyo modo no se
puede atribuir; ningún evento se atribuyó al modo ómnibus. La atribución puede fallar si en la misma sesión empieza una lectura nueva, después de un cambio de modo, mientras la anterior todavía termina su foto o su síntesis; esos casos no se separaron, y como ningún evento cayó en el modo ómnibus, su efecto sobre las medianas es, a lo sumo, marginal. De `audio.send` se toman sólo los envíos
exitosos: un envío que falla por una excepción registra el tiempo desde antes de la síntesis, y uno
que el dispositivo rechaza, desde después.

## Qué mide cada evento

- `reading.ok`: `ms` es la duración de la consulta al modelo (`app/src/features/reader/readingService.ts`).
- `photo.ok`: la descarga de la foto desde el dispositivo por WiFi.
- `audio.synthesis`: la síntesis en la nube; sólo ocurre cuando la salida elegida es el dispositivo.
- `audio.send`: el envío del audio sintetizado al dispositivo.

Ningún evento registra el ciclo completo, desde el doble clic hasta el comienzo del audio, con un
único cronómetro. La tesis estima el total sumando medianas: unos 2,2 s con salida por el teléfono
(282 + 1.941 ms) y unos 4,6 s con salida por el dispositivo (sumando 2.128 + 230 ms). Falta medir
el ciclo completo.
