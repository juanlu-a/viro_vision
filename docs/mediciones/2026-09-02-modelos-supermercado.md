# 2026-09-02 — Modelos de nube del modo supermercado

Primera medición de los proveedores del selector **contra sus APIs reales**. Cierra la deuda que
dejó el PR #48, donde los proveedores de OpenAI y Groq se escribieron contra la documentación porque
no había claves.

**Conclusión operativa**: el selector pasa a ofrecer `gpt-5.6-luna` (default) y `qwen/qwen3.8-27b`.
`gemini-3.5-flash-lite` sale. El análisis está en
[`../pruebas-y-decisiones.md`](../pruebas-y-decisiones.md); acá están los números y el método.

---

## Método

**Qué se midió.** Los tres proveedores con clave, sobre la tarea real del modo supermercado: entra
una foto de producto, salen los tres campos `tipo` / `marca` / `detalle`.

**Con qué código.** Con **el de la app**, no con una réplica. El arnés importa
`buildProductoRequest`, `getProvider().readEvent` y `parseProductoLeido` de
`app/src/services/vision/`, y sólo reemplaza el transporte (`node:https` en vez de `expo/fetch`,
porque el `fetch` global de jest-expo está mockeado). Es deliberado: **una réplica mide la réplica.**
Ya pasó en este proyecto que la documentación de un proveedor no describiera su API real, y lo único
que lo detecta es ejercitar el código que va a correr en producción.

**Prompt y schema**: los mismos para los tres, tomados de `providers/prompts.ts` y `producto.ts`. Es
la razón por la que viven fuera del proveedor — si cada uno tuviera el suyo, la comparación mediría
prompts y no modelos.

**Registrado por corrida**: status HTTP, tiempo total, **TTFB** (hasta el primer token de texto
visible, que es lo que se percibe como "empezó a contestar"), los tres campos, y el uso de tokens
que informa el proveedor.

**Espaciado**: 7 s entre corridas. No es cosmético — el tier gratuito de Gemini se satura
sosteniendo pedidos y el de Groq limita por tokens por minuto. Sin espaciar, la medición mide la
cuota y no el modelo.

**Entorno**: Montevideo, fibra doméstica, 2026-09-02. Imagen de 768×1024 px (53 KB), salvo en el
experimento de tamaño.

### Limitaciones — hay que leerlas antes que los números

1. **Una sola imagen, y sintética.** Un envase generado con texto nítido, alto contraste, sin fondo
   y de frente. Es el **mejor caso posible**: no hay reflejo, ni desenfoque, ni góndola detrás, ni
   el envase a 30 grados. Los aciertos de acá **no son la precisión del sistema**, son el piso de
   dificultad. La precisión real sale del dataset de evaluación con fotos reales, todavía pendiente.
2. **Pocas muestras.** Cinco corridas por modelo alcanzan para ver un orden de magnitud, no para
   afirmar diferencias de decenas de milisegundos.
3. **Una sola red y una sola ubicación.** La latencia hasta cada proveedor es parte del número y no
   se separó de la del modelo.
4. **Versiones móviles.** Los proveedores pueden cambiar los modelos sin avisar, y los dos Qwen de
   Groq están rotulados *preview*.

---

## Resultado 1 — Latencia

Cinco corridas por modelo, intercaladas y espaciadas.

| Modelo | Total mín | **Total mediana** | Total máx | TTFB mediana | Tokens entrada | Tokens salida |
|---|---|---|---|---|---|---|
| `qwen/qwen3.8-27b` (Groq) | 764 ms | **846 ms** | 1087 ms | 842 ms | 1974 | ~31 |
| `gpt-5.6-luna` (OpenAI) | 1410 ms | **1668 ms** | 2490 ms | 1383 ms | 1138 | 35 |
| `gemini-3.5-flash-lite` | 2820 ms | **10 649 ms** | 32 586 ms | 10 063 ms | no informa | no informa |

Corridas crudas, en orden:

```
gemini-3.5-flash-lite   30195, 10649, 32586,  3210,  2820  ms
gpt-5.6-luna             2490,  1668,  1421,  1410,  2375  ms
qwen/qwen3.8-27b          846,  1087,  1036,   764,   840  ms
```

**Lo que decide no es la mediana, es la dispersión.** Groq y OpenAI son predecibles: el peor caso de
Groq (1087 ms) está a 1,4× de su mejor caso, y el de OpenAI (2490 ms) a 1,8×. Gemini va de 2820 ms a
32 586 ms — **11,6×** — con la cuota fresca y las corridas espaciadas. Para alguien parado frente a
la góndola esperando escuchar qué agarró, un modelo que a veces tarda medio minuto es peor que uno
que siempre tarda dos segundos, aunque sus promedios se parecieran. Y no se parecen: la mediana de
Gemini es 6,4× la de OpenAI y 12,6× la de Groq.

Esto además **contradice la medición del 30/08**, que había dado 2-3 s para Gemini. Los dos extremos
de hoy (2820 ms y 32 586 ms) contienen aquel resultado: lo más probable es que la campaña anterior,
con menos muestras, haya caído en el extremo bueno. Es la lección metodológica de esta campaña —
**cinco corridas y no una**, y reportar el rango y no sólo el mejor número.

## Resultado 2 — Acierto

**15/15 corridas devolvieron los tres campos correctos.** Los tres modelos leyeron `tipo: arroz`,
`marca: SAMAN`, y un `detalle` con "Blue Patna", "grano largo fino" y "1 kg".

En esta tarea **la precisión no separa a los modelos**; los separa la latencia y la cuota. Con la
salvedad grande de la limitación 1: la imagen es el mejor caso posible, así que lo que esto muestra
es que ninguno falla en lo fácil — no que sean equivalentes en lo difícil.

Dos variaciones menores, sin consecuencia porque la frase hablada las tolera:

- La capitalización de la marca varía (`SAMAN` / `Saman`).
- Groq una vez metió el tipo dentro del detalle (`"Arroz Blue Patna, grano largo fino, 1 kg"`), que
  hace que el anuncio diga "arroz" dos veces.

## Resultado 3 — Cuota, y por qué el más rápido no puede ser el default

| Proveedor | Límite del tier | En lecturas | Costo por lectura |
|---|---|---|---|
| Groq | **8000 tokens/min** | **~4** | gratis, sin tarjeta |
| OpenAI | holgado para uso manual | — | ~USD 0,00030 |
| Gemini | 20 requests/min | 20 | gratis, sin tarjeta |

**El límite de Groq es por tokens, no por requests**, y una foto cuesta ~1974 tokens de entrada
fijos — Groq cobra la imagen a tarifa plana, así que **achicarla no lo baja**. Son unas 4 lecturas
por minuto, y en la campaña anterior la tercera seguida ya devolvió 429. Alguien recorriendo una
góndola hace del orden de 2 a 4 lecturas por minuto, así que Groq queda justo en el límite: es el
más rápido y el que primero se queda sin cupo.

**El costo de OpenAI es despreciable a la escala de la tesis**: 1138 tokens de entrada + 35 de
salida ≈ USD 0,0003. Mil lecturas cuestan menos de USD 0,50.

Gemini queda con la mejor cuota de las tres y la peor latencia.

## Resultado 4 — Efecto del tamaño de la imagen

Sobre `gpt-5.6-luna` (el más consistente y sin cuota apretada), tres corridas por tamaño. Valida —o
no— el techo de 1024 px que la app aplica antes de subir.

| Lado mayor | Peso | Tokens de entrada | Mediana | Corridas | Acierto |
|---|---|---|---|---|---|
| 1536 px | 97 KB | 2290 | 1331 ms | 2353, 1331, 1282 | 3/3 |
| **1024 px** | 53 KB | **1138** | 1532 ms | 1109, 1532, 1654 | 3/3 |
| 640 px | 30 KB | 577 | 1984 ms | 1984, 3024, 1147 | 3/3 |
| 384 px | 15 KB | 346 | 1121 ms | 1121, 1164, 1028 | 3/3 |

**Los tokens escalan con el tamaño; la latencia, no.** Los tokens de entrada se duplican a cada
escalón (346 → 577 → 1138 → 2290), pero las medianas de tiempo no ordenan: 640 px salió *más lento*
que 1536 px. A estos tamaños la latencia está dominada por el modelo y la red, no por subir 40 KB
más, y el ruido entre corridas (±800 ms) tapa cualquier diferencia real.

**El techo de 1024 px se mantiene, pero por un motivo distinto al que estaba escrito.** El comentario
del código lo justificaba por latencia; la medición dice que a esta escala la latencia no cambia. Lo
que sí cambia es el **costo en tokens** (1024 px cuesta la mitad que 1536 px) y el tráfico en una
conexión móvil de supermercado, que no se midió acá.

**Y ojo con leer el acierto a 384 px como que alcanza.** Acertó 3/3, pero sobre una imagen sintética
con texto de 90 px de alto y contraste máximo. Una foto real de góndola tiene el peso neto en cuerpo
8 y reflejo del envase; el objetivo opcional de OCR de etiqueta de la tesis vive justamente en esa
letra chica. Bajar el techo exige medirlo con fotos reales, no con ésta.

---

## Hallazgos que corrigieron el código

Tres cosas que sólo aparecen midiendo contra la API real, y ninguna daba error visible.

1. **La cuota no siempre llega como evento SSE.** Groq devuelve **HTTP 429 con cuerpo JSON** antes
   de abrir el stream. Por ese camino la app lanzaba `VisionHttpError`, que la UI no distingue: el
   usuario escuchaba "La nube no respondió" en vez de "Cuota agotada, reintentá en N s" — con el
   dato de cuánto esperar llegando en el cuerpo y nadie leyéndolo. Corregido en `httpError.ts`.
2. **El tope del limitador para Groq estaba mal por un orden de magnitud, y hacia el lado
   peligroso.** Estaba en 25/min, el número de un límite por requests que ese proveedor no tiene, así
   que el limitador nunca frenaba. Bajó a 3.
3. **Apagar el razonamiento no compra latencia fuera de Gemini.** El comentario del código lo
   justificaba extrapolando de Gemini, donde no apagarlo lleva la lectura de 3 s a decenas de
   segundos. Sobre `gpt-5.6-luna` da igual: `none` 1,5-2,1 s, `medium` 1,5 s, sin mandar nada 2,0 s
   — y los mismos 35 tokens de salida en los tres casos, o sea que no gasta razonamiento en tres
   campos cortos. Se sigue mandando `none` por intención y porque es gratis, no por los segundos.

Y una cosa que la documentación decía mal: **Groq documenta `reasoning_effort: none | default`, pero
`low` respondió 200.** Su lista documentada no es la real.

## Lo que esta campaña no midió

- **`claude-haiku-4-5`**: requiere tarjeta y no hay clave. Sigue sin verificar contra su API.
- **Fotos reales de góndola.** Es la limitación que más pesa, y lo que destraba el dataset de
  evaluación de la tesis.
- **Conexión móvil.** Todo se midió sobre fibra; el usuario va a estar en 4G dentro de un
  supermercado.
- **El proxy** (ADR 0008), que todavía no está desplegado y suma un salto de red al camino.
