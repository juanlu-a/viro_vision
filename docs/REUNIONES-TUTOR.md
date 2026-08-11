# ViroVision — Reuniones con el tutor

Registro de las reuniones con el director de tesis, **Ing. MSc. Sebastián García Parra**. Una sección
por reunión, más nuevas al final. Cada entrada guarda: temas tratados, decisiones/posturas que salieron
de la charla y próximos pasos acordados.

Documentos relacionados: historia cronológica del trabajo en [`SESSION-LOG.md`](SESSION-LOG.md),
plan hacia adelante en [`ROADMAP.md`](ROADMAP.md), decisiones formales en
[`architecture/adr/`](architecture/adr/).

---

## 2026-08-10 — Integración del modelo y performance

Reunión centrada en **dónde corre la inferencia** y **con qué stack**. Es la primera vez que se discute
Gemma sobre celular como alternativa concreta al camino YOLO + Coral TPU en el dispositivo.

### 1. Arquitectura de inferencia: local vs. remoto

- **Gemma (2B params, ~2.6 GB)** corre con GPU local en iPhone.
  - Métrica clave: **time to first token**, no la latencia total de la imagen.
  - Parámetros a barrer en las pruebas: `max tokens`, `top-K`, `top-P`, `temperature`, backend GPU/CPU.
- **Propuesta del tutor: _model gateway_ dinámico.**
  - Decide **en runtime** si la inferencia va al modelo local o a la nube.
  - Factores de decisión: calidad del hardware del celular, cobertura, carga de CPU, costo acumulado.
  - Ventaja: sin hardcodeo — la decisión se adapta por caso de uso y por dispositivo.
- **Ómnibus vs. canasta básica tienen perfiles distintos:**
  - *Ómnibus*: prioridad **latencia baja** → modelo más liviano, local.
  - *Canasta básica*: tolera más latencia a cambio de **precisión** → puede ir a nube o a un modelo
    más potente.
- **Cobertura offline:** si el usuario llegó al supermercado, es probable que tenga señal. Igual se
  mantiene **fallback automático al modelo local** cuando no hay cobertura.

### 2. Opciones de stack técnico

| Camino | Qué es | Notas |
|--------|--------|-------|
| **A — Gemma embebido en la app** | **LiteRT** (sucesor de TensorFlow Lite) para inferencia on-device. Modelo descargado la primera vez que se usa y luego instanciado localmente. | Permite **elegir el modelo en el onboarding** (Gemma 2B, 4B, …) según el hardware del usuario. |
| **B — Apple Vision + Core ML** (solo iOS) | Un Core ML chico detecta y localiza el ómnibus en el frame; el **OCR integrado de Apple Vision** procesa el cartel, sin dependencia externa. | Estrategia multi-frame: enviar 4 frames y quedarse con el de mayor confianza (ej. 90 % en el frame 2 → línea 116). **Cierra la plataforma a iOS.** |
| **C — React Native Vision Camera** (cross-platform) | Usa **AVFoundation** en iOS y **CameraX** en Android. Frame processors nativos, compatible con modelos vía **ML Kit OCR**. | Cubre Android sin reescribir; no cierra la plataforma. |
| **D — Modelo en la nube** (Bedrock, Perplexity, …) | Latencia mayor garantizada vs. local, pero simplifica el stack inicial. | Útil como **benchmark rápido** desde la app actual, sin build nativo. |

### 3. Capacidades de Gemma y recolección de datos

- Gemma **identifica múltiples ómnibus en una misma imagen**, con posición y línea. Ejemplo de salida:
  *"ómnibus 0: línea 115 Luis Braille; ómnibus 1: línea 174 Plaza Americana"*.
- **Salida JSON flexible**: se agregan funcionalidades cambiando sólo el prompt, sin reentrenar.
- También da **descripción general de escena** (objetos, colores, contexto), pero requiere un prompt
  más sintético para que el output sea útil en producción.
- **Fine-tuning / entrenamiento:** necesita imágenes en **todos los contextos** — lluvia, noche, baja
  luminosidad, distintos ángulos. Recomendación explícita del tutor: **seguir sacando fotos en la calle
  en condiciones variadas**.
- **La Raspberry Pi actual (Zero 2 W, ~0.5 GB de RAM) no alcanza para Gemma.** La TPU sirve para YOLO
  local, pero no habilita Gemma.
- Herramienta mencionada: **"Can I Run"** (GitHub) — detecta el hardware y sugiere modelos compatibles.

### 4. Postura acordada sobre offline-first

El *model gateway* choca con [`ADR 0001`](architecture/adr/0001-offline-first-on-device-inference.md),
que **decía**, antes de la enmienda del 2026-08-10, *"Recognition inference always runs locally —
never a cloud API"*.

**Postura del equipo:** la **nube pasa a ser un acelerador opcional** y lo local queda como **fallback
garantizado**. El requisito duro se mantiene intacto: *sin internet, el reconocimiento y la respuesta
auditiva siguen funcionando*. La nube sólo puede usarse cuando hay cobertura y aporta precisión o
simplicidad, nunca como único camino.

> ✅ **Hecho (2026-08-10):** ADR 0001 lleva una nota fechada con esta postura — la nube es un
> acelerador opcional, lo local es el fallback garantizado, y la nube como *único* camino sigue
> prohibida.

### 5. Impacto en el plan

- **B2 (hardware):** queda descartado correr Gemma en la RPi Zero 2 W. En el dispositivo sobrevive el
  camino YOLO + Coral TPU.
- **iOS vs. Android deja de ser un pendiente y pasa a ser una decisión bloqueante:** el camino B es
  iOS-only y el C es cross-platform; no se puede elegir stack sin cerrar antes el perfil de usuario.
- Los caminos B y C implican **capturar con la cámara del celular**, lo que compite con el pilar
  hardware (gafas + RPi). Falta definir explícitamente si el dispositivo sigue siendo el capturador
  principal o pasa a ser opcional.
- ✅ Alimentó el [**ADR 0004 — Runtime de inferencia on-device (Gemma vía LiteRT-LM)**](architecture/adr/0004-on-device-inference-runtime.md),
  escrito el 2026-08-11, en estado *Proposed*, a discutir en la próxima reunión.

### 6. Próximos pasos acordados

1. **Probar Gemma en el celular con Edge Gallery** — variar parámetros y hacer pruebas funcionales con
   fotos reales de ómnibus. *(En curso, fuera de la app.)*
2. ✅ **Mock de llamada a modelo en la nube desde la app** — implementado el 2026-08-10 como pantalla
   de desarrollo `dev/vision-bench` (`app/src/services/vision/`). Mide tiempo hasta headers, primer
   byte, primer evento, **primer token (TTFT)** y total, con una corrida de calentamiento descartada
   y reporte de mediana y p90. La salida JSON imita la de Gemma para que los números sean
   comparables. Pendiente: correrlo en la calle y anotar los resultados acá.
3. **Investigar Apple Vision y documentarlo como alternativa** — mini documento con React Native Vision
   Camera + Apple Vision como opción concreta.
4. **Validar el perfil de usuario objetivo: iOS vs. Android** — confirmar con datos si el segmento
   adulto mayor usa mayormente iPhone o Android, antes de cerrar plataforma.
