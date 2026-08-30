# Spike — visión local en el teléfono (2026-08-12/13)

**Pregunta:** ¿puede el teléfono leer el cartel del ómnibus sin depender de la nube?
(ADR 0004 propone Gemma local; ADR 0001 permite la nube sólo como acelerador opcional.)

**Método:** los cuatro caminos medidos sobre el mismo hardware (iPhone 15 Pro, iOS 26.6), con la
misma foto, el mismo prompt y el mismo parser. Si algo de eso difiriera, las diferencias medidas
podrían venir del experimento y no del modelo. Todo corre desde la pantalla de desarrollo
`Ajustes → Modelo local` (gate por `EXPO_PUBLIC_ONDEVICE_SPIKE`).

## Resultados

| Camino | Qué usa | Resultado |
|---|---|---|
| **Nube** (Gemini) | `services/vision/` — API con streaming SSE | ✅ Funciona. TTFT < 1 s. Necesita internet; cuota de 20 req/min por modelo en el tier gratuito |
| **LiteRT-LM** (runtime de Google, sucesor de TFLite) | `react-native-litert-lm@0.6.0` + Gemma | ⚠️ **Texto sí**: Gemma 3 1B genera (910 ms, 13,4 tok/s); Gemma 4 E2B (2,5 GB) carga. **Visión no**: falla al crear la conversación con 3 modelos (756 MB–2,5 GB), en cualquier backend, contexto y precisión |
| **ExecuTorch** (runtime de PyTorch; en iOS corre sobre MLX, el stack de Apple) | `react-native-executorch@0.9.3` + Gemma 4 E2B multimodal (3 GB) | ✅ **La visión funciona**: carga en ~4 s y lee bien el cartel. Pero TTFT ~5,6 s / total ~6,4 s — lento para un ómnibus acercándose |
| **OCR local** (mismo ExecuTorch) | Detector CRAFT + reconocedor CRNN en **español**, ~250 MB | ✅ Rápido y liviano. Devuelve texto **+ posición + confianza**. La precisión mejora mucho con buen encuadre o recorte |

## La conclusión clave

**El problema del multimodal era la librería, no el teléfono.** El mismo Gemma 4 E2B que LiteRT-LM
no podía ni abrir en modo visión, por ExecuTorch/MLX carga y lee. El fallo de LiteRT quedó aislado
con evidencia: tres modelos con un rango de tamaño de más del triple, mismo error exacto, y
descartados uno por uno memoria (veredicto "safe" y fallaba igual), disco, contexto (1024→256 sin
cambio), precisión de activaciones y decodificado restringido. Es reportable con caso reproducible.

## Hallazgos que costaron caro (para no repagarlos)

- **LiteRT escribe su caché en la carpeta del modelo** → el modelo tiene que estar donde la app
  pueda escribir. Un archivo elegido de otra app se lee pero no se escribe al lado.
- **El disco lleno no dice "disco lleno"**: XNNPack aborta el proceso sin mensaje, y falla incluso
  con un modelo chico que antes andaba. La app ahora guarda **un solo modelo** y muestra
  diagnóstico (tamaño real, disco, memoria) *antes* de cargar.
- **La variante del archivo importa**: los Gemma `-gpu`/`-web` no traen codificador de visión. El
  multimodal es el `.litertlm` sin sufijo. Edge Gallery baja una variante de sólo texto.
- **Un modelo instruido sin su plantilla de chat responde vacío**: `forward()` crudo devolvió
  texto vacío en 3 s; `sendMessage()` (que aplica la plantilla) lee bien.
- **Sin decodificado restringido, la forma del JSON va en el prompt**: el modelo inventó claves
  (`line_number`) hasta que el prompt las fijó (`numero`/`nombre`).
- **El texto más nítido gana**: el modelo leyó la matrícula en vez del cartel hasta que el prompt
  lo prohibió explícitamente.

## Recomendación para discutir con el equipo

**Pipeline detección → recorte del banner → OCR, con modelos preentrenados de ExecuTorch:**

1. Detector chico (`rfdetr-nano` / `yolo26`): COCO ya trae la clase "bus" — **no hay que entrenar**.
2. El banner es geométricamente predecible: franja superior de la caja del ómnibus.
3. El recorte reescalado pasa por el OCR: letras grandes, precisión alta.
4. Caja más grande = ómnibus más cercano → la priorización que la tesis exige, gratis.

Es la arquitectura que la tesis describía (detección + OCR) **sin pagar el entrenamiento**. El VLM
local queda como término de comparación en el informe; la nube como acelerador opcional (ADR 0001).

La pregunta de alcance del ADR 0004 (¿Gemma multimodal reemplaza a YOLO+OCR?) ahora tiene evidencia:
**hoy, en este hardware, no** — 6,4 s contra fracciones de segundo, y sin coordenadas para priorizar.

## Nota de cierre (2026-08-30)

El laboratorio se **retiró de la app** (rama `staging`): queda **un solo runtime nativo**, ExecuTorch,
y sólo para el OCR del modo ómnibus; LiteRT-LM y el Gemma multimodal se desinstalaron
(`react-native-litert-lm`, `react-native-nitro-modules`, `expo-document-picker`), y el benchmark de
nube también, porque el modo supermercado ya usa la nube como camino de producto con selector de
modelo (ADR 0006, actualización 2026-08-30). El código completo del laboratorio sigue disponible en
la rama `spike/laboratorio-vision-local`, el tag `spike-laboratorio-vision-local-2026-08-30` y el PR
draft "[NO MERGEAR]" #33; el índice y la receta para revivirlo están en
[`spike-laboratorio-referencia.md`](spike-laboratorio-referencia.md) (en esa rama).

## Pendientes

- Reportar el bug de visión a `react-native-litert-lm` con el caso reproducible (desde la rama).
- ~~Decidir runtime único~~ → resuelto el 2026-08-30: queda ExecuTorch (OCR).
- Anotado: el mínimo de iOS subió a **17.0** (lo exige el podspec de ExecuTorch).
- La cuenta paga de Apple quedó **desacoplada de esto**: sirve para distribuir la app al equipo,
  no hace falta para la visión local.
