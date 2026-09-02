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
