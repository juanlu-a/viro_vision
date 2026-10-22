# Supabase: backend, capa de cuenta y funciones

Supabase cumple hoy dos papeles distintos, y conviene no mezclarlos:

1. **Infraestructura sin cuentas**, en uso: tres Edge Functions (`vision`, `telemetry`, `evidence`),
   la tabla `events` y el bucket privado `evidence`. Ninguna pide login (ADR 0008).
2. **La capa de cuenta** (ADR 0002), **archivada**: auth por **email y contraseña** de Supabase (sin
   Google ni OAuth), con la sesión persistida en AsyncStorage. El código existe, pero **el login no
   está montado**: `AuthProvider` no figura en `app/src/app/_layout.tsx`, la app abre directo en las
   pestañas y Ajustes no tiene sección de cuenta (ADR 0002, actualizaciones del 2026-07-18 y del
   2026-07-20).

## La capa de cuenta en el código (archivada)

- `app/src/services/supabase/config.ts`: lee `EXPO_PUBLIC_SUPABASE_URL` y `_ANON_KEY`.
- `app/src/services/supabase/supabase.ts`: cliente supabase-js memoizado (sesión en AsyncStorage,
  `detectSessionInUrl: false`, polyfill de URL).
- `app/src/services/supabase/authClient.ts`: auth por email (`signInWithPassword`, `signUp`).
- `app/src/services/supabase/client.ts`: `getSupabaseAuthClient()` devuelve el cliente real si hay
  configuración, y si no un sustituto que lo dice en lugar de fingir.
- `app/src/features/auth/AuthContext.tsx`: `AuthProvider` y `useAuth` (`signIn`, `signUp`,
  `signOut`). Ninguna pantalla lo consume.

Si el login vuelve, la puesta en marcha es corta: habilitar *Authentication → Providers → Email*
(viene encendido), decidir si se exige confirmar el correo (*Confirm email*; sin confirmación,
`signUp` devuelve la sesión al instante), cargar los dos `EXPO_PUBLIC_SUPABASE_*` en `app/.env`
(plantilla en `app/.env.example`) y en los secrets de los workflows que compilan, porque las
`EXPO_PUBLIC_*` se incrustan en el bundle al compilar. No hace falta Google Cloud Console, cliente
OAuth ni URL de redirección. Y montar `AuthProvider`, que es la decisión que hoy está tomada en
contra.

## Regla de frontera

La capa de cuenta es sólo eso. Nada en el camino cámara → detección/OCR → anuncio puede depender de
ella (ADR 0001). Perder conectividad nunca puede romper el reconocimiento.

**Ojo con las Edge Functions de abajo, que parecen la excepción y no lo son.** Usan la
*infraestructura* de Supabase, no la cuenta: no hay sesión ni usuario. El proxy de visión está en el
camino de **supermercado**, que ya dependía de internet por decisión explícita (ADR 0006); el modo
ómnibus corre entero en la placa (#88) y no lo atraviesa. La telemetría y la evidencia son
instrumentación: el analizador estático impide importarlas desde el camino que lee y anuncia
(`app/eslint.config.js`).

---

# Edge Function `vision` — el proxy de claves (ADR 0008)

Por qué existe: `EXPO_PUBLIC_*` no es una variable de entorno que el binario lea al arrancar, es una
constante **compilada dentro del `.ipa`/`.apk`**. Un `strings` sobre el bundle la devuelve, y desde
que hay link público de TestFlight cualquiera puede instalarlo. Con el tier gratuito de Gemini eso
era una molestia; con modelos pagos en el selector, es la tarjeta del proyecto.

La función es un **proxy tonto**: recibe el cuerpo que el módulo de proveedor del cliente ya armó,
le agrega la cabecera de autenticación desde los secrets y devuelve el body upstream **sin tocarlo**
(el stream SSE incluido). No interpreta la respuesta ni conoce los prompts, así que la lógica de
proveedor no se duplica del lado del servidor y agregar un modelo sigue siendo un cambio en la app.

Código: [`supabase/functions/vision/index.ts`](../supabase/functions/vision/index.ts). El lado
cliente es `app/src/services/vision/transport.ts`.

## Qué compra, y qué no

**No está autenticado** (`verify_jwt = false`): la app no tiene login y la anon key viajaría igual
en el bundle, así que exigirla sería una indirección, no una defensa. El endpoint **es abusable**, y
eso está aceptado a conciencia en ADR 0008.

Lo que cambia es el modo de falla: sin proxy, la clave está en el `.ipa` de todos los testers y
rotarla exige publicar una versión nueva y esperar la revisión de la tienda; con proxy, se rota, se
rate-limitea o se apaga **en segundos**. Las defensas reales son:

1. La **allowlist de hosts** de la función — sin ella, `url` sería un agujero por el que la clave
   sale hacia donde el atacante quiera (SSRF).
2. El **freno por IP** de la función. Es un badén, no una pared: Supabase puede levantar varios
   isolates y cada uno cuenta lo suyo.
3. El **tope de gasto** en la consola de cada proveedor. Es la única que no depende de que nuestro
   código esté bien. **Ponelo antes de cargar el primer secret pago.**

## Estado (2026-09-02): desplegado

Proyecto `viro_vision` — ref **`oxukvenxiqkjhksgoigq`**, us-east-2. Función `vision` ACTIVE, con
`GEMINI_API_KEY`, `OPENAI_API_KEY` y `GROQ_API_KEY` cargadas. `EXPO_PUBLIC_VISION_PROXY_URL` es
secret del repo, así que **los builds de TestFlight y Play ya no llevan ninguna clave de proveedor**.

El proyecto existía desde el 2026-07-18 (se creó para la capa de cuenta de ADR 0002) y nunca se
había usado: 0 usuarios, 0 tablas, 0 buckets.

⚠️ **Se pausa solo.** El tier gratuito pausa los proyectos sin actividad por una semana, y a éste ya
le pasó. Con el proxy en producción y sin claves en el bundle, una pausa deja sin modo supermercado a
todos los builds a la vez. Ver el riesgo operativo en
[ADR 0008](architecture/adr/0008-proxy-propio-para-claves-de-nube.md).

⚠️ **`supabase projects api-keys` imprime la `service_role` en claro.** Es la clave que saltea RLS.
No correrlo en un log, un CI ni una sesión compartida.

## Despliegue

```sh
# Una vez: instalar la CLI y enlazar el proyecto
brew install supabase/tap/supabase
supabase link --project-ref <ref-del-proyecto>

# Los secrets: uno por proveedor. Los que falten hacen que ese proveedor responda 503
# nombrando cuál falta — el resto del selector sigue andando.
supabase secrets set GEMINI_API_KEY=...
supabase secrets set OPENAI_API_KEY=...
supabase secrets set ANTHROPIC_API_KEY=...
supabase secrets set GROQ_API_KEY=...

supabase functions deploy vision
```

Después, en `app/.env` (y en los secrets del repo, para los builds de CI):

```
EXPO_PUBLIC_VISION_PROXY_URL=https://<ref>.supabase.co/functions/v1/vision
```

Con esa variable puesta, la app **deja de necesitar cualquier `EXPO_PUBLIC_*_API_KEY`** y los cinco
modelos aparecen en el selector aunque el build no traiga ninguna clave: `isProviderConfigured`
devuelve `true` cuando hay proxy, precisamente porque las claves las tiene el servidor.

Sin la variable, la app llama directo al proveedor con la clave del `.env`. Ése es el camino de
desarrollo y sigue funcionando igual: el proxy no es un reemplazo, es un interruptor.

## Límites que importan

| Límite | Valor | Por qué no molesta acá |
|---|---|---|
| Wall clock | 150 s (free) | Las lecturas son de 2-3 s. |
| CPU | 2 s por request | **No cuenta I/O**, que es todo lo que hace un proxy. |
| Invocaciones | 500 K/mes (free) | Una tesis no las roza. |

## Verificar que funciona

```sh
# 1. Que el proxy responde y no filtra
curl -sS -X POST "$EXPO_PUBLIC_VISION_PROXY_URL" \
  -H 'content-type: application/json' \
  -d '{"provider":"gemini","url":"https://example.com/","body":{}}'
# Esperado: 400 "El destino no corresponde al proveedor" — la allowlist funcionando.

# 2. Que la clave NO está en el binario
strings app/ios/build/.../ViroVision | grep -E 'AIza|sk-'
# Esperado: nada.
```

# Telemetría: la función `telemetry` y la tabla `events`

La segunda función del proyecto, y la única razón por la que hoy se puede saber qué pasó cuando algo
falla. Desde el **2026-09-08** la información técnica no está en las pantallas de la app (era una
consola de diagnóstico incrustada en la interfaz de alguien que no la ve); desde el **2026-09-09** la
app registra esos eventos acá.

## Cómo está armado

| Pieza | Dónde |
|---|---|
| Función | [`supabase/functions/telemetry/index.ts`](../supabase/functions/telemetry/index.ts) |
| Cliente | `app/src/services/telemetry/` (barrel: `@/services/telemetry`) |
| Tabla | `public.events` — versionada en `supabase/migrations/` |
| Variable | `EXPO_PUBLIC_TELEMETRY_URL`, **opcional**: si falta se deriva de `EXPO_PUBLIC_VISION_PROXY_URL` |

La app **no tiene clave de la base**: manda lotes a la función, que inserta con el `service_role`.
Mismo criterio que el proxy de visión, `verify_jwt = false` (ADR 0008): sin login, exigir la anon key
sería pedir algo que ya viaja dentro del bundle.

**La URL se deriva del proxy** (`…/functions/v1/vision` → `…/functions/v1/telemetry`) cuando no hay
variable propia: las dos funciones viven en el mismo proyecto, y pedirlas por separado es pedir dos
veces el mismo dato y dejar que se desincronicen. Sin eso, un build con proxy pero sin el secret
nuevo sale **sin ninguna telemetría** y nadie se entera hasta que hace falta diagnosticar algo. La
derivación **no adivina**: lo que no termina en `/vision` no deriva nada, porque una URL armada a la
fuerza daría 404 en cada lote — apagada y sabida es mejor que encendida y rota.

## El contrato, y su trampa

```jsonc
POST https://<proyecto>.supabase.co/functions/v1/telemetry
{
  "phone":   "phone-…",  // id anónimo de la instalación, generado por la app
  "session": "ses-…",    // cambia en cada arranque: es lo que agrupa "qué pasó esa vez"
  "app":     "1.0.0+42 ios",
  "events": [
    { "type": "reading.ok", "at": "2026-09-09T12:00:00.000Z", "ms": 1668,
      "detail": { "mode": "supermarket", "model": "gpt-5.6-luna" } }
  ]
}
```

⚠️ **Un evento sin `type` o sin `at` se descarta y la respuesta sigue siendo `200`**, con
`{"stored": 0}`. O sea que una app que arma mal el cuerpo se ve idéntica a una que anda, y el defecto
recién aparece cuando alguien consulta la tabla después de una falla y no encuentra nada. Por eso
`record()` pone el `at` él mismo y los tipos son una unión cerrada
(`services/telemetry/types.ts`), y por eso hay un test que arma el cuerpo y lo compara campo a campo.

Los otros dos topes: **100 eventos por lote** (lo de más se recorta del lado del servidor) y **8 KB
de `detail`**, que al pasarse se reemplaza **entero** por `{"trimmed": true}` — no la parte de más.
Nada de imágenes ni textos largos en `detail`.

## Qué se registra

Ciclo de vida (`app.start`, `app.background`, `app.error`), enlace BLE (`ble.scanning`,
`ble.connected`, `ble.failed`, `ble.lost`, `ble.retry`, `ble.disconnected`), red con la placa
(`wifi.joining`, `wifi.ready`, `wifi.failed`), lo que informa la placa (`device.status`,
`device.warning`, `device.mode`, `device.modeFailed`), modos (`mode.change`) y la lectura entera
(`reading.start`, `photo.ok`, `photo.failed`, `ocr.load`, `cloud.wait`, `reading.ok`,
`reading.failed`, `audio.synthesis`, `audio.send`).

`audio.synthesis` (la llamada al TTS de nube) va **separada** de `audio.send` (la subida al parlante
de la placa): son dos cosas que fallan y tardan por motivos distintos, y juntas se ven como un solo
«tardó». Mismo criterio que separar los ms de la foto de los del pipeline.

`app.error` incluye el **manejador global de errores** de React Native: un crash es el evento más
útil que esta tabla puede tener y es justo el que ningún `try` de la app registra.

`device.status` llega cada 15 s desde la placa pero **sólo se registra cuando cambia algo** (AP, wifi,
cámara, ip, versión, o la batería por tramos de 5 %): registrarlo entero serían 240 filas por hora de
las cuales 239 son idénticas.

## Por qué falla seguido, y está bien

Mientras el teléfono está unido al **AP de la placa** hay WiFi pero no internet (ADR 0003): durante
una sesión de uso real los envíos fallan y los lotes se acumulan. La cola tiene tope (500) y **tira
lo más viejo**, porque cuando alguien reporta una falla lo que hay que mirar son los últimos
segundos. Lo descartado se cuenta y viaja en el siguiente lote como `app.error` con
`droppedEvents`: un hueco silencioso se leería como "eso no pasó".

Un lote se reintenta **como mucho tres veces** y después se da por perdido. Sin ese tope, un lote que
el servidor no puede aceptar volvería a la cola para siempre y —como siempre se sube lo más viejo
primero— **taparía toda la telemetría posterior**: un solo evento malo apagaría el diagnóstico entero
justo cuando hace falta.

## Verificar que funciona

```sh
# Un evento de prueba (la función no pide auth)
curl -sS -X POST "$EXPO_PUBLIC_TELEMETRY_URL" -H 'content-type: application/json' \
  -d '{"phone":"test","session":"test","app":"curl","events":[
       {"type":"app.start","at":"2026-09-09T00:00:00.000Z"}]}'
# Esperado: {"stored":1}. Si dice {"stored":0}, al evento le falta `type` o `at`.
```

## Un solo vocabulario de `type`, y así conviene que siga

Los `type` son **`punto.separado`**: `app.start`, `ble.connected`, `wifi.ready`, `photo.failed`,
`mode.change`, `reading.ok`. La lista completa y vigente está en
`app/src/services/telemetry/types.ts`, que es una **unión cerrada de TypeScript** a propósito: con
strings libres, un `reading.failed` y un `reading_failed` conviven felices y ninguna consulta los ve
a los dos. Agregar un tipo es agregar una línea ahí.

> **Ya pasó una vez.** Hasta el 2026-09-09 la tabla tenía además ~28 filas en `snake_case`
> (`app_abierta`, `ble_conectado`, `wifi_lista`) de un build manual de `feat/telemetria-supabase`,
> una rama que nunca se mergeó. Se **borraron** ese día para dejar un solo vocabulario: una consulta
> que filtre por `type` sin contemplar las dos formas muestra de menos **sin avisar**, que es la
> peor forma de estar mal. La tabla arranca limpia desde ahí.

> **El vocabulario pasó a inglés el 2026-09-09** (ADR 0009), y las filas viejas se tradujeron en la
> misma migración (`app.inicio` → `app.start`, y así con los 25 tipos). No quedaron dos formas
> conviviendo: por eso una consulta no necesita contemplar las dos.

## Esquema versionado (2026-09-09)

Dos migraciones, en este orden:

1. [`20260907190000_eventos.sql`](../supabase/migrations/20260907190000_eventos.sql) — el archivo
   original de la rama que creó la tabla, recuperado con su fecha y **verificado contra la base real**
   con `supabase db dump`: coincide campo por campo e índice por índice. **No se toca**: ya está
   aplicada, y un log de migraciones se agrega, no se edita.
2. [`20260909120000_rename_eventos_to_events.sql`](../supabase/migrations/20260909120000_rename_eventos_to_events.sql)
   — el pase a inglés (ADR 0009). **Renombra en vez de recrear**, así que las filas de las primeras
   sesiones de campo se quedan donde están; traduce además los `type` históricos.

Lo que conviene saber al leerlas:

- **RLS encendido y sin ninguna política**, a propósito: con la anon key un `GET /rest/v1/events`
  devuelve `[]`, no filas (verificado el 2026-09-09). La función entra con el `service_role`, que
  salta RLS. **No agregar una política de lectura sin pensarlo**: la anon key viaja dentro del bundle
  de la app, así que una política para `anon` es una política para cualquiera que la extraiga.
- Tres índices, por los tres accesos que se usan: lo último que pasó (`created_at desc`), una sesión
  entera en orden (`session, occurred_at`) y todas las veces que pasó una cosa (`type, created_at desc`).
- El `check` de `detail` mide **bytes del jsonb ya comprimido** (≤ 8192) y el corte de la función
  mide **caracteres de JSON** (≤ 8000): son medidas distintas. En la práctica la de la función es
  más estricta —se probó con 7900 caracteres incompresibles y entró sin problema—, y ese margen es
  el que evita que un evento gigante haga fallar el insert del lote entero.

---

# Edge Function `evidence` — las fotos del modo ómnibus (2026-10-12)

> ⚠️ **Temporal, sólo para desarrollo.** Se saca antes de la versión final (`docs/ROADMAP.md`,
> «Antes de la versión final»): son fotos de la calle, con gente.

Une cada línea del log con la foto que la explica. El camino:

1. La placa guarda el cuadro de cada ómnibus y el recorte de cada lectura del OCR y avisa por BLE
   (`hardware/raspi/virovision/evidence.py`).
2. La app baja el registro y las fotos por WiFi, como la foto del modo supermercado, y graba **en el
   momento** una fila `bus.evidence` en `events` con lo que leyó el OCR (textos, scores, línea,
   destino, ms) y, en `detail.storage`, la ruta de cada foto (`app/src/services/evidence/`).
3. Las fotos quedan en cola en el teléfono y se suben cuando hay internet a esta función, que las
   guarda con service role en el bucket **privado** `evidence`, en
   `<phone>/<corrida>/<archivo>.jpg` — la misma ruta que ya dice la fila. Con el celular unido al AP
   de la placa no hay internet: se reintenta cada minuto y la cola tiene tope (150).

Las rutas son deterministas a propósito: la fila es correcta aunque la foto suba una hora después, y
ninguno de los dos lados tiene que avisarle al otro dónde quedó nada.

Para mirar: en la tabla `events`, `type = 'bus.evidence'`, y abrir `detail->'storage'` en el
dashboard (*Storage → evidence*) o con una URL firmada. `bus.evidenceFailed` dice por qué una foto no
llegó (`detail.stage`: `pull`, `upload`, `dropped`, `noAddress`).

Sin JWT, igual que `telemetry` (ADR 0008). Topes: 4 archivos por pedido, 2 MB por archivo, sólo
JPEG (los primeros bytes se verifican), sólo nombres que escribe la placa. El bucket se crea con la
migración `20261012120000_evidence_bucket.sql`.
