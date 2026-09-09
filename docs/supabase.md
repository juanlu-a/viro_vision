# Supabase backend & email auth

The online account layer (ADR 0002). Login uses **Supabase email + password** (Supabase native auth —
no Google, no OAuth). On sign-in the session is persisted by AsyncStorage, so the user stays signed in
across restarts and while offline.

The app code is wired and env-gated: with no `EXPO_PUBLIC_SUPABASE_*` vars it falls back to an
offline-safe stub (Settings shows "login not configured yet"); with them set, real email sign-in /
sign-up works. End-to-end login can only be tested against a real Supabase project.

## App wiring (already in the repo)

- `app/src/services/supabase/config.ts` — reads `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY`.
- `app/src/services/supabase/supabase.ts` — memoized supabase-js client (AsyncStorage session,
  `detectSessionInUrl: false`, url polyfill).
- `app/src/services/supabase/authClient.ts` — email auth (`signInWithPassword` / `signUp`).
- `app/src/services/supabase/client.ts` — `getSupabaseAuthClient()` returns the real client when
  configured, else the stub.
- Consumed by `features/auth/useAuth.ts` (`signIn` / `signUp` / `signOut`), surfaced in the Settings
  screen's Account section (email + password form).

## One-time setup

1. **Create the Supabase project** (supabase.com) → copy the **Project URL** and **anon public key**
   (Settings → API).
2. **Enable Email auth:** Supabase → *Authentication → Providers → Email* (on by default).
3. **Email confirmation:** decide whether to require it (*Authentication → Sign In / Providers →
   Confirm email*). For quick testing, turn it **off** so `signUp` returns a session immediately; for
   production, keep it **on** (then `signUp` returns no session until the user confirms — the app shows
   "revisa tu correo para confirmarla").
4. **Local env:** copy `app/.env.example` → `app/.env` and fill both `EXPO_PUBLIC_SUPABASE_*` values.
5. **CI/EAS:** `EXPO_PUBLIC_*` vars are inlined at build time, so add them where builds run — e.g. an
   `env` block per profile in `eas.json`, or EAS environment variables — for EAS builds/updates that
   should ship with the backend configured.

> No Google Cloud Console, OAuth client, or redirect-URL configuration is needed — email auth only.

## Boundary rule

Supabase is the account layer only. Nothing on the camera → detection/OCR → announcement path may
depend on it (ADR 0001). Losing connectivity must never break recognition or a persisted session.

**Ojo con la Edge Function de abajo, que parece la excepción y no lo es.** El proxy de visión usa la
*infraestructura* de Supabase, no la cuenta: no hay sesión, ni usuario, ni tabla — es una función
HTTP que da la casualidad de estar hospedada en el mismo proveedor. La regla de arriba sigue vigente
tal como está escrita. Y el camino que el proxy toca es el de **supermercado**, que ya dependía de
internet por decisión explícita (ADR 0006); el de ómnibus corre local y no lo atraviesa.

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

# Telemetría: la función `telemetria` y la tabla `eventos`

La segunda función del proyecto, y la única razón por la que hoy se puede saber qué pasó cuando algo
falla. Desde el **2026-09-08** la información técnica no está en las pantallas de la app (era una
consola de diagnóstico incrustada en la interfaz de alguien que no la ve); desde el **2026-09-09** la
app registra esos eventos acá.

## Cómo está armado

| Pieza | Dónde |
|---|---|
| Función | [`supabase/functions/telemetria/index.ts`](../supabase/functions/telemetria/index.ts) |
| Cliente | `app/src/services/telemetria/` (barrel: `@/services/telemetria`) |
| Tabla | `public.eventos` — **su DDL vive sólo en el dashboard**, ver el pendiente de abajo |
| Variable | `EXPO_PUBLIC_TELEMETRY_URL`, **opcional**: si falta se deriva de `EXPO_PUBLIC_VISION_PROXY_URL` |

La app **no tiene clave de la base**: manda lotes a la función, que inserta con el `service_role`.
Mismo criterio que el proxy de visión, `verify_jwt = false` (ADR 0008): sin login, exigir la anon key
sería pedir algo que ya viaja dentro del bundle.

**La URL se deriva del proxy** (`…/functions/v1/vision` → `…/functions/v1/telemetria`) cuando no hay
variable propia: las dos funciones viven en el mismo proyecto, y pedirlas por separado es pedir dos
veces el mismo dato y dejar que se desincronicen. Sin eso, un build con proxy pero sin el secret
nuevo sale **sin ninguna telemetría** y nadie se entera hasta que hace falta diagnosticar algo. La
derivación **no adivina**: lo que no termina en `/vision` no deriva nada, porque una URL armada a la
fuerza daría 404 en cada lote — apagada y sabida es mejor que encendida y rota.

## El contrato, y su trampa

```jsonc
POST https://<proyecto>.supabase.co/functions/v1/telemetria
{
  "telefono": "tel-…",   // id anónimo de la instalación, generado por la app
  "sesion":   "ses-…",   // cambia en cada arranque: es lo que agrupa "qué pasó esa vez"
  "app":      "1.0.0+42 ios",
  "eventos": [
    { "tipo": "lectura.ok", "momento": "2026-09-09T12:00:00.000Z", "ms": 1668,
      "detalle": { "modo": "supermercado", "modelo": "gpt-5.6-luna" } }
  ]
}
```

⚠️ **Un evento sin `tipo` o sin `momento` se descarta y la respuesta sigue siendo `200`**, con
`{"guardados": 0}`. O sea que una app que arma mal el cuerpo se ve idéntica a una que anda, y el
defecto recién aparece cuando alguien consulta la tabla después de una falla y no encuentra nada. Por
eso `registrar()` pone el `momento` él mismo y los tipos son una unión cerrada
(`services/telemetria/tipos.ts`), y por eso hay un test que arma el cuerpo y lo compara campo a campo.

Los otros dos topes: **100 eventos por lote** (lo de más se recorta del lado del servidor) y **8 KB
de `detalle`**, que al pasarse se reemplaza **entero** por `{"recortado": true}` — no la parte de
más. Nada de imágenes ni textos largos en `detalle`.

## Qué se registra

Ciclo de vida (`app.inicio`, `app.fondo`, `app.error`), enlace BLE (`ble.buscando`, `ble.conectado`,
`ble.fallo`, `ble.perdido`, `ble.reintento`, `ble.desconectado`), red con la placa (`wifi.uniendose`,
`wifi.listo`, `wifi.fallo`), lo que informa la placa (`placa.estado`, `placa.aviso`, `placa.modo`,
`placa.modoFallo`), modos (`modo.cambio`) y la lectura entera (`lectura.inicio`, `foto.ok`,
`foto.fallo`, `ocr.carga`, `nube.espera`, `lectura.ok`, `lectura.fallo`, `audio.sintesis`,
`audio.envio`).

`audio.sintesis` (la llamada al TTS de nube) va **separada** de `audio.envio` (la subida al parlante
de la placa): son dos cosas que fallan y tardan por motivos distintos, y juntas se ven como un solo
«tardó». Mismo criterio que separar los ms de la foto de los del pipeline.

`app.error` incluye el **manejador global de errores** de React Native: un crash es el evento más
útil que esta tabla puede tener y es justo el que ningún `try` de la app registra.

`placa.estado` llega cada 15 s desde la placa pero **sólo se registra cuando cambia algo** (AP, wifi,
cámara, ip, versión, o la batería por tramos de 5 %): registrarlo entero serían 240 filas por hora de
las cuales 239 son idénticas.

## Por qué falla seguido, y está bien

Mientras el teléfono está unido al **AP de la placa** hay WiFi pero no internet (ADR 0003): durante
una sesión de uso real los envíos fallan y los lotes se acumulan. La cola tiene tope (500) y **tira
lo más viejo**, porque cuando alguien reporta una falla lo que hay que mirar son los últimos
segundos. Lo descartado se cuenta y viaja en el siguiente lote como `app.error` con
`eventosPerdidos`: un hueco silencioso se leería como "eso no pasó".

Un lote se reintenta **como mucho tres veces** y después se da por perdido. Sin ese tope, un lote que
el servidor no puede aceptar volvería a la cola para siempre y —como siempre se sube lo más viejo
primero— **taparía toda la telemetría posterior**: un solo evento malo apagaría el diagnóstico entero
justo cuando hace falta.

## Verificar que funciona

```sh
# Un evento de prueba (la función no pide auth)
curl -sS -X POST "$EXPO_PUBLIC_TELEMETRY_URL" -H 'content-type: application/json' \
  -d '{"telefono":"prueba","sesion":"prueba","app":"curl","eventos":[
       {"tipo":"app.inicio","momento":"2026-09-09T00:00:00.000Z"}]}'
# Esperado: {"guardados":1}. Si dice {"guardados":0}, al evento le falta `tipo` o `momento`.
```

## Un solo vocabulario de `tipo`, y así conviene que siga

Los `tipo` son **`punto.separado`**: `app.inicio`, `ble.conectado`, `wifi.listo`, `foto.fallo`,
`modo.cambio`, `lectura.ok`. La lista completa y vigente está en
`app/src/services/telemetria/tipos.ts`, que es una **unión cerrada de TypeScript** a propósito: con
strings libres, un `lectura.fallo` y un `lectura_fallo` conviven felices y ninguna consulta los ve a
los dos. Agregar un tipo es agregar una línea ahí.

> **Ya pasó una vez.** Hasta el 2026-09-09 la tabla tenía además ~28 filas en `snake_case`
> (`app_abierta`, `ble_conectado`, `wifi_lista`) de un build manual de `feat/telemetria-supabase`,
> una rama que nunca se mergeó. Se **borraron** ese día para dejar un solo vocabulario: una consulta
> que filtre por `tipo` sin contemplar las dos formas muestra de menos **sin avisar**, que es la
> peor forma de estar mal. La tabla arranca limpia desde ahí.

## Esquema versionado (2026-09-09)

[`supabase/migrations/20260907190000_eventos.sql`](../supabase/migrations/20260907190000_eventos.sql).
Es el archivo original de la rama que creó la tabla, recuperado con su fecha, y **verificado contra
la base real** con `supabase db dump`: coincide campo por campo e índice por índice.

Lo que conviene saber al leerlo:

- **RLS encendido y sin ninguna política**, a propósito: con la anon key un `GET /rest/v1/eventos`
  devuelve `[]`, no filas (verificado el 2026-09-09). La función entra con el `service_role`, que
  salta RLS. **No agregar una política de lectura sin pensarlo**: la anon key viaja dentro del bundle
  de la app, así que una política para `anon` es una política para cualquiera que la extraiga.
- Tres índices, por los tres accesos que se usan: lo último que pasó (`creado_en desc`), una sesión
  entera en orden (`sesion, momento`) y todas las veces que pasó una cosa (`tipo, creado_en desc`).
- El `check` de `detalle` mide **bytes del jsonb ya comprimido** (≤ 8192) y el corte de la función
  mide **caracteres de JSON** (≤ 8000): son medidas distintas. En la práctica la de la función es
  más estricta —se probó con 7900 caracteres incompresibles y entró sin problema—, y ese margen es
  el que evita que un evento gigante haga fallar el insert del lote entero.
