# ADR 0008 — Un proxy propio para las claves de los modelos de nube

- **Status:** Accepted (2026-09-01)
- **Date:** 2026-09-01
- **Deciders:** ViroVision team (Juan Lucas Abreu, Magalí Dellapiazza, Francisco Tauber)
- **Tags:** app, backend, architecture, security
- **Relates to:** [ADR 0001](0001-offline-first-on-device-inference.md),
  [ADR 0002](0002-backend-and-auth-supabase.md),
  [ADR 0006](0006-pipelines-por-caso-de-uso.md)

## Contexto

El modo supermercado llama a un modelo de visión en la nube (ADR 0006). Hoy la app lo llama
**directo**, con la clave en una variable `EXPO_PUBLIC_*`. Eso tiene una propiedad que hasta ahora
era tolerable y dejó de serlo:

**`EXPO_PUBLIC_*` se inlinea en el bundle JS en tiempo de build.** No es una variable de entorno
que el binario lea al arrancar: es una constante compilada dentro del `.ipa`/`.apk`. Un `strings`
sobre el bundle la devuelve. El propio [`app/.env.example`](../../../app/.env.example) lo dice desde
que se escribió, y ADR 0006 lo dejó anotado como pendiente **(b): cómo despliega la clave un build
distribuible sin exigirle credenciales al usuario**.

Dos cosas lo convirtieron en bloqueante:

1. **La app se distribuye por un link público de TestFlight** desde el 2026-08-31
   (<https://testflight.apple.com/join/jbE7GDqV>). Cualquiera puede instalarla y extraer la clave.
2. **Cae la restricción de gratuidad.** ADR 0006 exigía que el modelo fuera gratuito para el
   usuario, lo que en la práctica limitaba el selector a Gemini. Para poder **comparar los modelos
   más rápidos del mercado** —que es lo que la tesis necesita medir— hay que poder pagar. Y una
   clave de OpenAI o Anthropic filtrada no es una cuota agotada: es la tarjeta del proyecto.

La restricción de gratuidad **para el usuario final** no cambia: sigue siendo inaceptable pedirle
credenciales propias a una persona ciega para usar la app. Lo que cambia es quién paga y dónde vive
la clave.

## Decisión

**Un proxy propio, desplegado como Supabase Edge Function, entre la app y los proveedores.**

Es un **proxy tonto**: recibe el request que el cliente ya sabe armar, le inyecta la clave del
proveedor desde los secrets del servidor, lo reenvía y devuelve el body upstream **sin tocarlo**.
Deliberadamente no interpreta la respuesta.

Que sea tonto es la decisión de diseño, no un atajo. Los módulos de
`app/src/services/vision/providers/` siguen armando el request y traduciendo los eventos SSE
exactamente igual que hoy; el proxy sólo cambia el destino y quién pone la cabecera de
autenticación. Consecuencias: la lógica de proveedor **no se duplica** en el servidor (no hay dos
copias que se desincronicen), los tests siguen siendo tests de módulos puros del lado del cliente,
y agregar un proveedor nuevo es una entrada de configuración, no un despliegue.

La app lo activa con `EXPO_PUBLIC_VISION_PROXY_URL`. **Sin esa variable el camino directo de hoy
sigue funcionando**, lo que permite desarrollar y medir con un `.env` local sin depender del
despliegue.

### Guardas obligatorias

Sin estas tres, un proxy con claves adentro es peor que no tenerlo:

- **Allowlist de hosts destino.** El cliente manda **qué proveedor**, nunca una URL libre. Un proxy
  que reenvía a la URL que le pasen es un SSRF que le entrega tu clave al primero que la pida.
- **Rate limit por IP** dentro de la función.
- **Tope de gasto duro** configurado en la consola de cada proveedor. Es la única red de seguridad
  que no depende de que nuestro código esté bien.

### Qué compra el proxy, y qué no

Vale escribirlo sin adornos, porque es fácil creer que resuelve más de lo que resuelve. La app **no
tiene login** (ADR 0002, actualización 2026-07-20), así que el endpoint queda abierto: la anon key
de Supabase también viaja en el bundle, y por lo tanto el proxy **no vuelve inabusable el
endpoint**.

Lo que sí hace es cambiar el modo de falla:

| Sin proxy | Con proxy |
|---|---|
| La clave del proveedor está en el `.ipa` de todos los testers. | La clave nunca sale del servidor. |
| Rotarla exige **publicar una versión nueva** y esperar la revisión de la tienda. | Se rota, se rate-limitea o se apaga **en segundos**, sin tocar la app. |
| El abuso se descubre en la factura. | El abuso se ve en los logs de la función y se corta ahí. |
| Agregar un proveedor exige un build nuevo. | Es una variable de entorno de la función. |

Es decir: convierte *"me robaron la clave y no me entero"* en *"me abusan el endpoint y lo corto
cuando quiera"*. Para un proyecto de tesis con distribución acotada, más topes de gasto en cada
proveedor, es la postura proporcionada. Si algún día la app tiene usuarios reales, el paso
siguiente es autenticar la función — y para eso el código de auth de ADR 0002 ya existe archivado.

## Alternativas consideradas

| Opción | A favor | En contra | Veredicto |
|---|---|---|---|
| **Supabase Edge Function** | Supabase **ya es el backend declarado del proyecto** (ADR 0002) y ya es dependencia de la app: no suma un proveedor más ni una cuenta más que mantener. Free tier de sobra para una tesis (500 K invocaciones/mes). Deno reemite SSE con un `new Response(upstream.body)` — el streaming es un pasamanos, no código. Secrets con `supabase secrets set`. 150 s de wall clock en el free tier contra lecturas de 2-3 s, y el límite de 2 s de CPU **no cuenta I/O**, que es todo lo que hace un proxy. | Hay que crear el proyecto Supabase, que todavía no existe (era el pendiente interactivo #2 de `PROJECT-STATUS.md`). | ✅ **Elegida** |
| Cloudflare Workers | Técnicamente el mejor proxy de streaming de la lista: sin cold start, 100 K req/día gratis, `wrangler deploy` de una línea, SSE nativo. | Suma **un proveedor y una cuenta más** al proyecto sin comprar nada que Supabase no dé ya. La ventaja de latencia (decenas de ms de cold start) es ruido frente a los 2-3 s del modelo. | ❌ Mejor herramienta, peor encaje |
| AWS Lambda + Function URL | Streaming soportado (`RESPONSE_STREAM`), 1 M req/mes gratis, y es lo que el equipo se va a encontrar en el mundo laboral. | La más pesada por lejos: IAM, roles, y una herramienta de despliegue (SAM/CDK/Serverless) que hoy no está en el repo. Cero presencia previa de AWS en el proyecto. Desproporcionado para reenviar un POST. | ❌ Costo de setup desproporcionado |
| Servidor self-hosted (VM de Arnaldo Castro) | Cerraría **proxy y modelo local en el mismo lugar**: si hay GPU, ahí puede correr también el Gemma que ADR 0006 quiere como fallback local. | No hay nada concreto todavía (ver abajo). Y meter la disponibilidad de la app en una VM que hay que operar, monitorear y parchear es infraestructura que este equipo no tiene tiempo de sostener hasta noviembre. | ⏸️ Documentado, no implementado |
| Seguir sin proxy, con topes de gasto | Cero infraestructura. Se prueba hoy mismo. | Con modelos pagos y un link público de TestFlight, es regalar la clave y confiar en el tope. El tope limita el daño, no lo evita, y no se puede rotar sin publicar. | ❌ No es opción desde que hay link público |
| Que cada usuario ponga su clave | Cero costo, cero infraestructura. | Rompe la accesibilidad, que es **el** criterio de diseño: pedirle a una persona ciega que cree una cuenta en Google AI Studio y pegue una clave de 39 caracteres es descalificar al usuario objetivo. Ya estaba descartado en ADR 0006. | ❌ Descartado desde 0006 |

### Sobre Arnaldo Castro

Arnaldo C. Castro S.A. apoya el proyecto y es una de las empresas que más invierte en I+D en
Uruguay. La opción de **hostear el modelo en su infraestructura** queda registrada acá porque es
atractiva por dos motivos que no son técnicos y sí importan para la tesis: soberanía del dato (la
foto de la góndola no sale del país) y una historia de sponsor local.

**No se implementa todavía** porque no hay endpoint ni credenciales. Lo que sí hace este ADR es
dejar el camino barato: el modelo que correríamos ahí sería un Gemma o un Qwen-VL sobre vLLM o
Ollama, y **los dos hablan el dialecto de OpenAI**. Como el proveedor `openaiCompatible` de la app
está parametrizado por base URL, sumarlos el día que haya acceso es completar variables de entorno,
no escribir un proveedor nuevo.

## Consecuencias

**Positivas**

- Cierra el pendiente **(b)** de ADR 0006, abierto desde el 2026-08-30.
- Desbloquea los modelos pagos, y con eso la comparación de los cinco modelos más rápidos que la
  tesis necesita medir.
- Rotar, cortar o agregar un proveedor deja de requerir un build y una revisión de tienda.
- Crea el proyecto Supabase, que ADR 0002 daba por supuesto y nunca se había materializado.

**Costos / riesgos**

- **Una pieza más que puede estar caída**, y está en el camino de reconocimiento del modo
  supermercado. No agrava la restricción de ADR 0001 —ese modo ya dependía de internet y ya
  **avisa** en vez de romper (`VisionNetworkError`)— pero suma un punto de falla propio a uno
  ajeno. El error tipado que ve el usuario no cambia.
- **El modo ómnibus no toca esto.** Sigue corriendo local, sin red, como exige ADR 0001. La regla
  de frontera que el linter ya impone sobre `@/services/vision` cubre también el módulo nuevo.
- Sin autenticación, el endpoint es abusable (ver arriba). Aceptado a conciencia, con mitigaciones.
- Los costos de los modelos pagos pasan a ser del proyecto. Es el punto: se paga para poder medir.

## Implicaciones para el código actual

- `app/src/services/vision/providers/` **no cambia**. Es el objetivo del diseño.
- Se agrega `app/src/services/vision/transport.ts`: toma el `{url, headers, body}` que
  `buildRequest` ya devuelve y lo reescribe hacia el proxy cuando `EXPO_PUBLIC_VISION_PROXY_URL`
  está seteada. Lleva **regla de frontera** comentada, como `reconocerProducto.ts`.
- Se agrega `supabase/functions/vision/`, el primer código de servidor del repo.
- **Tensión a nombrar, para que nadie la lea como una violación.** El boundary rule de
  `app/src/services/supabase/client.ts` (ADR 0001 + 0002) dice que **la cuenta online** no puede
  estar en el camino de reconocimiento. El proxy usa la **infraestructura** de Supabase, no la
  cuenta: no hay sesión, ni usuario, ni tabla; es una función HTTP que da la casualidad de estar
  hospedada en el mismo proveedor. La regla sigue vigente tal cual está escrita.
- El `.env.example` y los workflows de CI dejan de necesitar las claves de proveedor cuando el
  proxy esté activo; se mantienen mientras el camino directo siga siendo el de desarrollo.

## Ver también

[ADR 0006](0006-pipelines-por-caso-de-uso.md) (por qué supermercado va a la nube y qué modelos),
[ADR 0002](0002-backend-and-auth-supabase.md) (Supabase como capa de cuenta, y por qué la app no
tiene login), [`docs/supabase.md`](../../supabase.md) (el despliegue) y los flujos dibujados en
[`docs/architecture/README.md`](../README.md#flujos-por-caso-de-uso).
