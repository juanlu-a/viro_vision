# Convenciones de trabajo en el repo

Cómo se trabaja acá. El *qué* del proyecto está en `SKILL.md`; lo visual, en la skill
`virovision-marca`; las decisiones y su estado, en `decisiones.md`.

## Stack y comandos

Expo **SDK 57** · React Native **0.86** · React **19.2** · TypeScript **6** · New Architecture ·
Expo Router con `typedRoutes` y `reactCompiler` activados.

```sh
cd app
npm run lint       # expo lint
npm run typecheck  # tsc --noEmit
npm test           # jest
```

Alias `@/*` → `./src/*`, declarado en `tsconfig.json` y **espejado en `moduleNameMapper` de
`jest.config.js`** — si agregás un alias, va en los dos lados o los tests dejan de resolver.

> ⚠️ **`app/AGENTS.md` manda: verificá la API contra
> <https://docs.expo.dev/versions/v57.0.0/> antes de escribir código de Expo.** Expo cambia rápido y
> escribir de memoria produce código que compila y hace otra cosa. Esta regla ya evitó errores
> reales en esta base.

## Continuous Native Generation

**`app/ios/` es un artefacto regenerable y está gitignoreado.** Se recrea con
`npx expo prebuild --clean -p ios`. Un ajuste hecho a mano en Xcode **se pierde** en el próximo
prebuild.

Todo cambio nativo va por `app.json` o por un **config plugin** en `app/plugins/`. Ejemplo vivo:
`withoutUserScriptSandboxing.js`, que apaga `ENABLE_USER_SCRIPT_SANDBOXING` porque
`expo-build-properties` no expone esa build setting.

Para correr en el iPhone: `docs/dev-build-ios.md`. Desde 2026-08 hay **Apple Developer Program**
(cuenta Individual del Apple ID del proyecto), así que el camino para el equipo y los testers es
**TestFlight**: cada merge a `staging` llega al grupo interno del equipo (sin revisión, minutos) y
cada merge a `main` al grupo externo con link público (workflow `testflight.yml`; a mano, `npm run ios:testflight`); el dev build por cable
(`npx expo run:ios --device "iPhone de Juan"` **desde `app/`**) sigue siendo el ciclo de desarrollo,
ya sin la caducidad de 7 días.

## Estructura de `app/src/`

| carpeta | qué va | nombres |
|---|---|---|
| `app/` | rutas de Expo Router. `(tabs)/` son pestañas; `dev/` son rutas sueltas de desarrollo | según Router |
| `components/` | primitivos reutilizables, sin dominio | kebab-case: `accessible-button.tsx` |
| `features/` | dominio: hooks, providers, lógica | PascalCase componentes/providers, camelCase hooks |
| `services/` | frontera con el mundo exterior (red, BLE, storage) | camelCase |
| `constants/` · `hooks/` · `i18n/` · `types/` | tokens, hooks compartidos, cadenas, tipos | |

## Dos formas de servicio, y cuándo usar cada una

**(a) Interfaz + stub offline-safe + selector** — `services/supabase/`, `services/ble/`.
Cuando el servicio puede no estar configurado o no existir todavía. Un selector devuelve la
implementación real o un stub que falla con un error tipado ("no configurado", "no implementado").
**Degrada a un estado rotulado, nunca rompe ni finge.**

**(b) Barrel + estrategia de proveedor** — `services/vision/`.
Cuando hay varias implementaciones intercambiables. `types.ts` define el contrato neutro,
`providers/` lo implementa, el motor no sabe con quién habla. `index.ts` es un barrel puro: es la
única superficie de import (`@/services/vision`).

## Comentarios: el *porqué*, no el qué

Es el rasgo más distintivo de esta base y **hay que sostenerlo**. Un comentario que dice lo que el
código ya dice es ruido; los de acá citan el ADR, la cláusula WCAG, la medición o el fallo concreto
que el código previene. Ejemplo real (`services/vision/types.ts`, sobre `BuildRequestInput.prompts`):

> *Viven fuera del proveedor a propósito: si cada proveedor tuviera su prompt, cambiar de modelo en
> el selector cambiaría también la pregunta, y la comparación entre modelos dejaría de medir el
> modelo.*

Si al escribir un comentario no podés nombrar la consecuencia de no tenerlo, probablemente no hace
falta.

## Reglas de frontera

Un módulo que **no debe ser llamado desde cierto camino** lleva un comentario que lo dice, cita el
ADR y explica la consecuencia. Dos vivos:

- `services/vision/reconocerProducto.ts` — *REGLA DE FRONTERA (ADR 0001 + ADR 0006)*: la nube sólo
  desde el modo supermercado; nunca desde el camino de ómnibus, que corre local. El linter lo fuerza
  (`eslint.config.js`).
- `services/supabase/client.ts` — *BOUNDARY RULE (ADR 0001 + 0002)*: la cuenta online no puede estar
  en el camino de reconocimiento.

Cualquier módulo nuevo que sea instrumentación, o que dependa de la red, lleva uno.

## Errores tipados

Una clase por modo de falla, con un código SCREAMING_SNAKE en `super()` y `this.name` explícito:
`VisionNotConfiguredError`, `VisionHttpError` (lleva `status` y `body`), `VisionQuotaError` (lleva
`retryAfterSeconds`), `VisionStreamError`, `SseOverflowError`, `SupabaseNotConfiguredError`,
`BleNotImplementedError`.

El motivo es que la UI decide qué mensaje mostrar **por el tipo**, no parseando strings. Cuando un
error transporta un dato accionable (cuánto esperar, qué status), va como campo de la clase — y
**alguien tiene que leerlo**: hubo un bug real donde `VISION_STREAM_ERROR` mostraba su propio nombre
y el detalle quedaba en un campo que nadie miraba.

## Tests

- **Co-locados**: `foo.test.ts` al lado de `foo.ts`. No hay carpeta `__tests__/`.
- **Jest**, no `node:test`. Importar `node:test` compila y hasta corre, pero **jest no descubre esos
  tests** y el archivo pasa por vacío. Ya pasó.
- No hay `@testing-library/react-native`: **por eso la lógica vive fuera de los componentes**. Si
  algo merece un test, sacalo del `.tsx`.
- Cada test lleva un docblock que dice **por qué existe**. `theme.test.ts` es el mejor ejemplo:
  existe porque el manual de marca y la accesibilidad tiran para lados distintos, y sin él cualquiera
  puede "corregir" un token para que coincida con el manual y degradar la app sin enterarse.
- Los tests que documentan un límite conocido (combinaciones de color que *fallan* WCAG) son
  deliberados: si algún día pasaran, hay que revisar la decisión.
- Reloj y esperas **inyectables** en cualquier cosa con tiempo (`now`, `sleep`), o el test tarda un
  minuto real.

## i18n

**Toda cadena visible va en `src/i18n/es.ts`**, nunca literal en un componente. No es purismo de
traducción: es para que las etiquetas del lector de pantalla sean consistentes y revisables en un
solo lugar. Los componentes importan `strings` de `@/i18n`.

## Idioma

Identificadores en **inglés**; comentarios y cadenas en **español** en todo lo escrito desde
2026-08-10. Los sustantivos del dominio quedan en español aun en código inglés (`BusReading.numero`,
`BusReading.nombre`). **Al tocar un archivo, seguí el idioma que ya tiene** — hay archivos de julio
enteramente en inglés y no se traducen porque sí.

## Accesibilidad

No es una capa que se agrega al final; es el criterio de diseño. Mínimos:

- `accessibilityRole` / `accessibilityLabel` / `accessibilityHint` en todo lo interactivo.
- Objetivos táctiles ≥ **48 dp** (`A11y.minTouchTarget`).
- Nada se comunica **sólo** por color o por posición: un indicador de batería lleva el número en
  texto y la barra es refuerzo, no reemplazo.
- Preferir componentes RN estándar bien anotados sobre UI dibujada a mano (Mascetti et al. 2020;
  ver `references/app.md`).

Trampas ya pisadas, que no hay que repetir:

- **`accessibilityLiveRegion` es sólo Android.** En iOS hay que llamar
  `AccessibilityInfo.announceForAccessibility` — sin eso, VoiceOver no anunciaba *ningún* mensaje de
  estado en una pantalla que es, entera, una máquina de estados.
- `numberOfLines={1}` recorta etiquetas cuando el usuario agranda el tipo del sistema.
- Si un botón cambia de identidad (Medir ↔ Cancelar), el foco de VoiceOver se pierde: un solo botón
  que muta, no dos que se intercambian.

## Git

- **Todo trabajo nuevo empieza creando su feature branch, antes del primer edit.** Desde un
  `staging` al día (`git fetch` + rama desde `origin/staging`), nunca sobre `staging`/`main`
  directo ni sobre la rama de la sesión anterior. **Los PRs van a `staging`** (rama por defecto);
  `main` es producción y sólo recibe PRs `staging → main` (= release). Desde 2026-08-30. Al arrancar una sesión: `git branch --show-current`; si la rama
  actual es de otro tema, primero se le abre PR (o se descarta a conciencia) y recién después se
  crea la rama nueva. La lección viene de dos ramas que quedaron huérfanas sin PR
  (`feat/lector-en-inicio`, `docs/decisiones-equipo-2026-08`) mientras los ADRs ya referenciaban
  su contenido como existente.
- **Conventional Commits con scope**, asunto en español: `fix(vision):`, `feat(marca):`,
  `docs:`. El cuerpo explica **el razonamiento**, no el diff — se lee dentro de seis meses.
- **Nunca agregues un trailer de co-autoría de IA.** Los commits son del autor humano.
- **Una rama por cambio, desde un `staging` al día. Sin apilar PRs.** La lección viene de los PRs
  #1–#4. Si hay dos temas, son dos ramas en secuencia: se mergea la primera, se actualiza
  `staging`, se crea la segunda.
- Nombres: `feat/…`, `fix/…`, `docs/…`, `spike/…`, kebab-case.
- El PR usa `.github/pull_request_template.md`, **incluido el checkbox de accesibilidad** — no es
  decorativo.
- CI (`.github/workflows/ci.yml`) corre lint + typecheck + test y un bundle de verificación, con
  `working-directory: ./app`.

### Verificar que un merge no perdió nada

`staging` mergea con **squash**, así que las ramas viejas quedan divergentes aunque el contenido
esté. Para confirmar que una rama ya está íntegra, el chequeo es el contenido, no la historia:

```sh
git diff origin/staging <rama-vieja>   # vacío = todo el contenido está en staging
```

### Cómo se libera (resumen; el detalle en `docs/dev-build-ios.md` y `docs/android-play.md`)

| Evento | Efecto |
|---|---|
| merge a `staging` (cambios en `app/`) | build de TestFlight al grupo **interno** *Equipo ViroVision* (devs, sin revisión, minutos) y — cuando `PLAY_ENABLED=true` — `.aab` a *internal testing* de Google Play |
| PR `staging → main` mergeado (= release) | build al grupo **externo** *Testers ViroVision*, link público <https://testflight.apple.com/join/jbE7GDqV> (Beta App Review del 1.er build de cada versión) |
| *Actions → TestFlight / Google Play → Run workflow* | publicar cualquier rama al destino que se elija |

Cada grupo de TestFlight muestra **un solo build** (el último; el externo conserva además el último
aprobado). El grupo interno **no tiene link para compartir** (regla de Apple): sus testers son
usuarios de App Store Connect, se invitan en ASC y TestFlight les avisa solo; el link compartible
es el del grupo externo, <https://testflight.apple.com/join/jbE7GDqV>. Un build tarda ~30 min de runner + procesamiento de la tienda. Lo que no va a producción
se **revierte en `staging` con un PR de revert** antes del release.

## Qué documento actualizar

| documento | cuándo |
|---|---|
| `docs/SESSION-LOG.md` | siempre, al cerrar una sesión: narrativa cronológica de qué se hizo y por qué |
| `docs/PROJECT-STATUS.md` | cuando cambia el estado vigente del proyecto |
| `docs/ROADMAP.md` | cuando cambia el plan |
| `docs/REUNIONES-TUTOR.md` | después de cada reunión con el tutor |
| un ADR nuevo | cuando se toma una decisión con consecuencias, aunque sea provisoria (`Proposed`) |
| esta skill | cuando cambia **cómo se trabaja**, no cuando cambia el código |

Los diagramas de flujo/estados van en **mermaid** (GitHub los renderiza y se versionan como
texto), con el diagrama canónico en `docs/architecture/README.md` — los demás documentos lo
linkean, nunca lo duplican.
