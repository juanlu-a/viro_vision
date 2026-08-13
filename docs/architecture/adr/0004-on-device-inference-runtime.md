# ADR 0004 — Runtime de inferencia on-device (Gemma vía LiteRT-LM)

- **Status:** Proposed — a discutir con el tutor
- **Date:** 2026-08-11
- **Deciders:** ViroVision team (Juan Lucas Abreu, Magalí Dellapiazza, Francisco Tauber)
- **Tags:** ml, app, hardware, requirement

## Contexto

ADR 0001 exige que el reconocimiento funcione sin internet, con inferencia local. Falta decidir
**con qué runtime** y **qué modelo**. La reunión con el tutor del 2026-08-10
([`REUNIONES-TUTOR.md`](../../REUNIONES-TUTOR.md)) dejó cuatro caminos abiertos; este ADR los cierra.

Dos hechos nuevos, posteriores a esa reunión:

1. **Gemma probado a mano en el iPhone del equipo anda bien.** Es evidencia directa de viabilidad
   sobre el hardware objetivo, no una estimación. Valida el "Camino A" antes de invertir en él.
2. **MediaPipe LLM Inference quedó en modo mantenimiento.** Google recomienda migrar a
   **LiteRT-LM**, que tiene API Swift nativa con aceleración GPU por Metal
   ([LiteRT-LM Overview](https://ai.google.dev/edge/litert-lm/overview),
   [aviso de mantenimiento](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference)).
   Coincide con lo que el tutor ya había dicho ("LiteRT, sucesor de TensorFlow Lite").

## Restricción encontrada: el sandbox de iOS

**No se puede usar el Gemma que corre dentro de otra app.** iOS aísla cada app en su sandbox: ni el
proceso ni el archivo del modelo son accesibles desde ViroVision. Tener Gemma andando en Edge
Gallery no acerca nada al producto — sólo prueba que el hardware da.

Los dos caminos reales:

- **(a) Servidor local.** Si la app que hospeda a Gemma expone un HTTP en `localhost`, ViroVision
  puede pegarle. `services/vision/sse.ts`, las métricas y el schema ya son agnósticos del proveedor,
  así que sería un adapter y nada más. Sirve para **medir**, no para producto: depende de una app de
  terceros instalada.
- **(b) Embeber Gemma en ViroVision** con LiteRT-LM. Es el producto.

## Decisión propuesta

**Embeber Gemma vía LiteRT-LM, arrancando por la variante más chica (E2B), con la cámara del
teléfono como fuente de imagen.**

1. **Runtime: LiteRT-LM**, no MediaPipe LLM Inference (mantenimiento) ni Core ML + Apple Vision
   (cierra la plataforma a iOS, y el equipo aún no validó el perfil iOS vs. Android).
2. **Modelo: la variante más chica primero.** La tarea es extremadamente acotada — leer número y
   nombre de un cartel. Empezar por el modelo grande sería pagar latencia, RAM y batería sin
   evidencia de que haga falta. Se sube sólo si la precisión medida no alcanza.
3. **Cámara: React Native Vision Camera** (AVFoundation en iOS, CameraX en Android). Mantiene el
   camino cross-platform abierto, que es el "Camino C" del tutor.
4. **Antes del módulo nativo, evaluar
   [`react-native-litert-lm`](https://github.com/hung-yueh/react-native-litert-lm).** Si es
   compatible con Expo 57 / RN 0.86 y está mantenido, el esfuerzo baja de "escribir un módulo Swift"
   a "instalar y probar". Si no, se escribe el módulo.

## La pregunta abierta que este ADR NO cierra

**Si Gemma es multimodal y lee el cartel directamente, el pipeline YOLO + OCR deja de ser necesario
en el camino del teléfono.**

Eso no es una optimización: borraría buena parte de la tarea **B1** del roadmap (entrenar YOLO11,
definir el enfoque de OCR), que el documento principal de la tesis describe como *el* método.

**Hay que decidirlo explícitamente con el tutor, no dejar que se filtre por omisión.** Opciones:

- **Reemplazar:** Gemma multimodal hace detección + lectura en un paso. Más simple, menos control,
  y obliga a reescribir la sección de método de la tesis.
- **Conservar como comparación:** implementar los dos y medirlos uno contra otro. Más trabajo, pero
  es una contribución mucho más fuerte para una tesis que elegir uno sin evidencia.
- **Híbrido:** YOLO + OCR en el dispositivo de las gafas (donde no entra un LLM), Gemma en el
  teléfono. Justifica las dos arquitecturas que el proyecto ya venía comparando.

Recomendación: **conservar como comparación**. El benchmark ya construido mide latencia con la misma
vara para cualquier backend, así que el costo marginal de comparar es bajo y el valor para la tesis
es alto.

## Consecuencias

**Positivas**
- Cumple ADR 0001 sin depender de la nube.
- Viabilidad ya demostrada sobre el hardware objetivo.
- Salida JSON gobernada por prompt: agregar funcionalidades no exige reentrenar.

**Costos y riesgos**
- **Descarga del modelo:** de 1 a 3 GB la primera vez. No va en el bundle. Hay que definir dónde
  vive, qué pasa si se corta la descarga, y qué escucha el usuario mientras espera.
- **Memoria:** la variante chica pide ~1,1 GB *antes* del contexto y el overhead, en un teléfono que
  además corre la cámara. iOS mata apps que se exceden, sin aviso. Es el riesgo técnico principal.
- **Tiempo de carga del modelo:** cargar varios GB son segundos, y para un usuario ciego apuntando a
  un ómnibus que se aproxima eso cuenta igual que el time-to-first-token. **Es una métrica aparte
  que todavía nadie midió** y hay que agregar al benchmark.
- **Batería y temperatura** con cámara + GPU sostenidas. Sin medir.
- **El pilar de hardware no se beneficia:** la RPi Zero 2 W (~0,5 GB) no corre Gemma. LiteRT-LM sí
  corre en Raspberry Pi, así que una Pi más grande sería opción sin cambiar el stack de software.

## Actualización 2026-08-12 — resultados del spike de viabilidad

Se hizo el paso 2 de "Próximos pasos" (evaluar `react-native-litert-lm`). Lo que sigue está medido
sobre el iPhone 15 Pro del equipo, no estimado. El spike vive en `app/src/services/ondevice/` y en
la pantalla `dev/ondevice-bench`, detrás de la misma regla de frontera que el benchmark de nube.

### El riesgo principal quedó descartado

**`react-native-litert-lm@0.6.0` compila y enlaza contra Expo SDK 57 / RN 0.86 / New Architecture**
(corre sobre Nitro Modules), y **el Gemma 3 1B carga y genera** en el teléfono. El criterio de corte
"la librería no es compatible" está descartado con evidencia. Trae config plugin de Expo, pero es
**sólo Android**; en iOS cualquier entitlement queda de nuestro lado.

### Correcciones a este ADR

| Lo que decía | Lo verificado |
|---|---|
| Runtime en `ai.google.dev/edge/litert-lm/` | La URL redirige a `developers.google.com/edge/litert-lm/` |
| Empezar por Gemma 3n E2B | **Gemma 4 E2B**: es *más chico* (2,59 GB contra 3,66) y apache-2.0. El 3n está gated con aprobación manual, así que el descargador no lo puede traer sin token |
| "~1,1 GB antes del contexto" | 2,59 GB en disco pero **0,6–1,45 GB residentes**: los pesos van mapeados. La estimación erraba en las dos direcciones y tapaba el riesgo real |
| API Swift de LiteRT-LM | Está en **"Early Preview"**, no estable |
| "El pilar de hardware no se beneficia" | Una **Raspberry Pi 5 de 16 GB corre este mismo modelo** a 7,6 tok/s de decode. La Pi Zero 2 W sigue descartada, pero el pilar no está muerto |

### Restricciones nuevas, encontradas al usarlo

**1. El modelo tiene que estar en una carpeta donde la app pueda escribir.** LiteRT-LM pone su caché
compilada en el directorio del propio modelo (`cacheDir = parent(modelPath)`). Un archivo elegido de
otra app se lee pero no se escribe al lado: el motor se crea bien y falla un paso después, al armar
la conversación, con un mensaje que no menciona permisos. Consecuencia de producto: el modelo se
descarga **al contenedor de la app**, no se referencia desde afuera.

**2. El costo en disco es el doble de lo que parece.** Modelo + caché de pesos de XNNPack. Y cuando
el disco se llena, el síntoma **no dice "disco lleno"**: XNNPack llama a `abort()` y la app se
cierra sin mensaje — incluso con un modelo chico que antes funcionaba, lo que hace parecer que se
rompió otra cosa. Para producto esto implica **verificar espacio antes de descargar** y poder
liberar las copias desde la app.

**3. Cuidado con la variante del archivo.** El Gemma 4 que baja Edge Gallery **no trae codificador
de visión** (`TF_LITE_VISION_ENCODER not found` en el log del runtime): es una variante de sólo
texto y no puede leer un cartel aunque cargue. El multimodal es `gemma-4-E2B-it.litertlm`, sin
sufijo — las variantes `-gpu` y `-web` no sirven para esta tarea.

**4. El sandbox se confirma en la práctica.** El modelo dentro de Edge Gallery no es utilizable por
ViroVision, como decía este ADR. Sí es utilizable si el usuario lo expone por la app Archivos, pero
sólo copiándolo — ver la restricción 1.

### Lo que todavía no se midió

**El entitlement `com.apple.developer.kernel.extended-virtual-addressing` sigue sin ponerse a
prueba**: no llegamos a cargar el modelo grande porque nos frenó el disco, no la memoria. La
documentación de la librería dice que un modelo de más de ~2 GB lo necesita y que eso **requiere
cuenta paga de Apple Developer** (USD 99/año) — la misma que haría falta para distribuir la app al
resto del equipo. **Si se confirma, deja de ser una pregunta técnica y pasa a ser de presupuesto,
para decidir con el tutor.**

Tampoco hay todavía números de tiempo de carga ni de time-to-first-token con imagen, que son los que
harían comparable el camino local contra el benchmark de nube.

## Actualización 2026-08-13 — la contraprueba cierra el spike

Resultados completos y hallazgos en [`docs/spike-vision-local.md`](../../spike-vision-local.md).
Lo que cambia para este ADR:

1. **El camino de visión de LiteRT-LM no funciona en iOS** (vía `react-native-litert-lm`): tres
   modelos multimodales de 756 MB a 2,5 GB fallan idéntico al crear la conversación, con memoria,
   disco, contexto y precisión descartados con evidencia. El texto sí funciona. Bug reportable.
2. **La contraprueba lo confirma**: el mismo Gemma 4 E2B multimodal, por **ExecuTorch** (MLX en
   iOS), carga en ~4 s y lee el cartel correctamente. El problema era la librería, no el hardware.
3. **Pero el VLM local es lento para este caso de uso**: TTFT ~5,6 s, total ~6,4 s. Un ómnibus
   acercándose no espera eso.
4. **La pregunta de alcance de este ADR ya tiene evidencia**: el pipeline detección + OCR con
   modelos **preentrenados** de ExecuTorch (COCO trae la clase "bus"; OCR CRAFT+CRNN en español,
   ~250 MB) lee en fracciones de segundo y devuelve coordenadas — que son lo que permite priorizar
   el ómnibus más cercano. La recomendación pasa de "conservar como comparación" a **"detección +
   OCR como camino primario del teléfono, VLM local como término de comparación en el informe"**,
   a validar con el tutor.

Consecuencias nuevas: el mínimo de iOS sube a **17.0** (podspec de ExecuTorch); hoy conviven dos
runtimes en el binario y hay que decidir uno; la cuenta paga de Apple queda desacoplada de la
visión local (sirve para distribuir, no para esto).

## Próximos pasos

1. Averiguar qué app hospeda a Gemma en el iPhone y si expone servidor local → habilitaría medir
   local vs. nube esta semana, sin módulo nativo.
2. Evaluar `react-native-litert-lm` contra Expo 57 / RN 0.86.
3. Agregar **tiempo de carga del modelo** como métrica del benchmark.
4. Llevarle al tutor la pregunta de YOLO + OCR. Es decisión de alcance de tesis, no técnica.

Ver también: [ADR 0001](0001-offline-first-on-device-inference.md) (y su nota del 2026-08-10 sobre la
nube como acelerador opcional), [`REUNIONES-TUTOR.md`](../../REUNIONES-TUTOR.md), y
`.claude/skills/virovision/references/ml.md`.
