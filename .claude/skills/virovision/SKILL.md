---
name: virovision
description: >-
  ViroVision thesis context: an assistive device + mobile platform for people with low or
  no vision that identifies metropolitan bus lines and food items on a supermarket shelf and
  gives real-time auditory feedback, using Computer Vision, ML and OCR. Covers the three
  project pillars (React Native app, Raspberry Pi / IoT hardware, ML/OCR/CV). Use this whenever
  working on any ViroVision code, hardware, ML model, or thesis document.
---

# ViroVision

## Qué es

ViroVision es el proyecto de fin de carrera de **Ingeniería en Telemática** (Facultad de Ingeniería,
Montevideo, Uruguay, 2026) de **Juan Lucas Abreu, Magalí Dellapiazza y Francisco Tauber**, dirigido
por el Ing. MSc. Sebastián García Parra.

Es un **sistema de asistencia para personas ciegas o con baja visión** que reconoce objetos de
interés con visión por computadora, ML e IA y devuelve **retroalimentación auditiva en tiempo real**.
Un dispositivo con cámara, montado en la patilla de unos lentes, capta el entorno; una **aplicación
móvil** emparejada se encarga de la conectividad, el apoyo al procesamiento y la interacción. El
sistema apunta a **dos casos de uso concretos**, identificados como prioritarios en el contexto
uruguayo.

### Casos de uso

1. **Identificación de líneas de ómnibus**: reconocer la línea de un ómnibus metropolitano que se
   acerca (OCR sobre el cartel de número y destino) y anunciarla. Con varios ómnibus a la vista,
   priorizar el más relevante sin sobrecargar al usuario de audio.
2. **Productos de supermercado**: identificar **alimentos** en la góndola y anunciarlos. **Alcance
   ampliado el 2026-09-11**: la canasta básica fue el alcance mientras no se conocía la precisión;
   medido contra el dispositivo real, el modelo identifica el alimento que tenga delante (yerba
   suelta incluida), así que la canasta queda como **conjunto de evaluación** (lo que se mide), nunca
   como límite de lo que se responde. El prompt dice "alimentos y productos de almacén".

### Objetivos opcionales (deseables, fuera del núcleo)

- **Selección con el dedo**: en productos, anunciar sólo el que el usuario señala o toca.
- **OCR de etiquetas**: leer texto complementario (variedad, sabor, presentación).

## Por qué importa

Surge de una encuesta de la UNCU (Unión Nacional de Ciegos del Uruguay, 26 respuestas) y de
entrevistas: el transporte público y las compras en el supermercado son las dos situaciones en que
las personas ciegas o con baja visión más necesitan ayuda de terceros. Las herramientas existentes
(OrCam MyEye, más de USD 4.000; Seeing AI; Google Lookout) son caras, dependen de la nube o no están
adaptadas al sistema de ómnibus local. ViroVision busca una alternativa **accesible, de bajo costo y
adaptada al medio**. Apoyos: Arnaldo Castro (empresa, servidor V100), la UNCU (información), un
posible vínculo con la ANII, y la validación con un usuario real (Luciano).

## Calendario

Iterativo e incremental, ágil (Scrum/Kanban), con Git. El desarrollo apunta a terminar **a mediados
de noviembre de 2026**, con fecha límite el **30 de noviembre de 2026** (unas dos semanas reservadas
para integración final, corrección de errores y pruebas de conjunto).

## Los tres pilares

| Pilar | Carpeta | Resumen |
|--------|--------|---------|
| **Aplicación móvil** | `app/` | React Native (Expo). Enlace BLE (GATT) con el dispositivo, salida de audio elegible (teléfono o dispositivo), configuración y accesibilidad de primera clase. Ver [references/app.md](references/app.md). |
| **Hardware / IoT** | `hardware/` | Dispositivo en la patilla: Raspberry Pi Zero 2 W + Raspberry Pi AI Camera (IMX500) + Waveshare UPS HAT (C), en la carcasa VIA Clara (OpenSCAD). Ver [references/hardware.md](references/hardware.md). |
| **ML / OCR / CV** | `ml/` (puntero) | Pipelines por caso de uso (ADR 0006). Ómnibus: YOLO11n de dos clases dentro del sensor IMX500 (el Coral salió del diseño el 2026-09-07; reentrenado en la V100 con ~500 fotos) → zoom digital → recorte con márgenes → OCR PP-OCRv5 → catálogo STM. Supermercado: LLM con visión en la nube por el proxy propio (ADR 0008); el respaldo local sigue abierto. Conjuntos de evaluación con recall, precisión, accuracy y F1. Ver [references/ml.md](references/ml.md). |

Y referencias transversales, que aplican al trabajo diario más que cualquier otra cosa de este
documento:

| Referencia | Cuándo |
|---|---|
| [references/convenciones.md](references/convenciones.md) | **Antes de escribir código o abrir un PR.** Stack, estructura, patrones de servicio, errores tipados, tests, accesibilidad, el flujo de ramas y commits, y la revisión multi-modelo. |
| [references/decisiones.md](references/decisiones.md) | Antes de tomar una decisión que quizá ya se tomó. Índice de ADRs con su estado y **qué cambió** en cada enmienda. |
| [references/placa-acceso.md](references/placa-acceso.md) | **Antes de tocar la Raspberry Pi**: cómo entrar (BLE con `tools/ap.py`, microSD, redes WiFi guardadas), qué no hacer nunca (unir la Mac al AP de la placa) y las trampas ya pisadas. |
| skill **`virovision-marca`** | Ante cualquier cosa visual: colores, tokens de tema, íconos, tipografía, material de la tesis. |

## Convenciones y restricciones transversales

- **Idioma (ADR 0009, 2026-09-09):** **todo el código en inglés**: identificadores, archivos,
  comentarios, tests, ramas, commits y las fronteras (protocolo BLE, endpoints HTTP de la placa,
  esquema de Supabase). **En español va lo que una persona lee o escucha**: los *valores* de
  `app/src/i18n/es.ts` (las claves son inglesas), el prompt de supermercado (su respuesta se dice en
  voz alta), las etiquetas de modelos del selector y **toda la documentación**: `docs/`, los ADRs,
  esta skill y la tesis.
- **Redacción de la documentación**: tono formal, tercera persona o impersonal ("el equipo", "se
  optó por"), **sin raya larga** (se usan comas, dos puntos o paréntesis), números en formato
  español y toda cifra con su fuente. `docs/tesis/build.py` falla si aparece una raya.
- **La accesibilidad es un requisito duro**, no un agregado. Cada decisión de interfaz se evalúa
  contra el uso por personas ciegas o con baja visión y los lectores de pantalla nativos (VoiceOver,
  TalkBack).
- **Offline-first (requisito duro).** Las **funciones esenciales** (detección, OCR y
  retroalimentación auditiva) DEBEN funcionar **sin internet**. Desde la reunión con el tutor del
  2026-08-10 (ADR 0001, enmendado) la nube se admite como **acelerador opcional**; el reconocimiento
  sólo en la nube, sin respaldo local, sigue prohibido, y los casos críticos en latencia (ómnibus)
  son locales. Perder conectividad puede costar precisión o latencia, nunca el reconocimiento ni el
  audio. No hay un runtime único: desde el **ADR 0006** (2026-08-22) cada caso tiene su pipeline.
  Ómnibus corre entero en la placa, con la detección dentro del sensor IMX500; supermercado va a un
  **LLM con visión en la nube** (decidido el 2026-08-30), con el respaldo local abierto como
  excepción declarada al ADR 0001. El "Gemma vía LiteRT-LM" del ADR 0004 ya no es el camino
  principal. Desde el **ADR 0008** (2026-09-01) las claves de nube viven en el proxy propio, no en
  la app.
- **Los errores no se le dicen al usuario** (ADR 0011): van a la telemetría y el usuario escucha una
  frase fija de `es.ts`.
- **Bajo costo y portátil.** Hardware y procesamiento equilibran precisión contra costo, tamaño,
  consumo y factibilidad.
- **Dos arquitecturas evaluadas:** (a) procesar en el dispositivo y (b) delegar el procesamiento de
  la imagen al teléfono. Para ómnibus se eligió (a) el 2026-09-04 (caso B del diagrama de
  arquitectura); supermercado usa el teléfono como pasarela a la nube.

## Git y contribución

- **Nada de co-autores de IA en los commits.** Nunca se agrega `Co-Authored-By: Claude ...` ni otro
  trailer de autoría de IA a commits o PRs. Los commits se atribuyen sólo a la persona autora.
- **Todo trabajo nuevo arranca en una feature branch nueva, creada antes del primer edit**, desde
  `staging` al día; nunca se commitea en `staging`/`main` ni en la rama de una tarea anterior. Los PRs
  van a `staging` (publica al grupo interno de TestFlight); `main` es producción y sólo recibe PRs
  `staging → main`. Detalle en `references/convenciones.md`.
- **Revisión multi-modelo**: antes de abrir un PR con cambios de peso (código, documentación extensa
  o el modelo 3D de la carcasa) se corre el flujo `tackle-ticket` / `tackle-review` (Opus, Sonnet,
  Haiku y Codex) como revisión de código y búsqueda de fallas. Detalle en
  `references/convenciones.md`.

El resto (formato de commit, nombres de rama, la regla de no apilar PRs, cómo verificar que un merge
no perdió nada) vive en **[references/convenciones.md](references/convenciones.md)**, para que no
haya dos copias que se desincronicen.

## Mapa del repositorio

- `app/`: la aplicación React Native (Expo con dev client).
- `hardware/`: la Raspberry Pi Zero 2 W. `raspi/` es el daemon Python (periférico BLE, cámara,
  modos, ómnibus en vigilancia, AP WiFi, batería, evidencia; ADR 0003); `raspi/boot/` son los
  scripts de arranque de la microSD; `case-via-clara/` es la carcasa en OpenSCAD (en `staging` la
  v0.9; la v0.10 a v0.12 se itera en la rama `feat/case-v0-10-slim`).
- `ml/`: sólo un README que apunta al pipeline de ómnibus (YOLO11n, dataset, OCR, export IMX500), que
  vive en el repo aparte `bus-banner-recognizer` de Magalí y se instala en la placa como dependencia.
- `docs/`: la tesis (`docs/tesis/`), arquitectura, ADRs, mediciones, guías de QA y de operación.
- `documents/`: documentos fuente versionados tal cual (el diagrama de casos de uso a mano).
- `supabase/`: el proxy de claves de nube (ADR 0008), la función de telemetría y la de evidencia.
  **Desplegadas y activas** desde 2026-09-02, 2026-09-09 y 2026-10-12; los builds no llevan ninguna
  clave de proveedor.

## Pendientes abiertos de la tesis

Marcados `PENDIENTE` en `docs/tesis/`; se tratan como trabajo abierto:
- Métricas del detector reentrenado en la V100 (épocas, mAP, evaluación sobre las 117 imágenes).
- Prueba en la calle del modo ómnibus con y sin zoom.
- Respaldo local del modo supermercado.
- Capítulos 9 (conclusiones) y 10 (trabajo futuro), y las pruebas con usuarios.

> Esta skill resume el estado al 2026-10-22. Antes de tratar una decisión como final, verificarla
> contra el repo vivo y la planilla de trabajo:
> https://docs.google.com/spreadsheets/d/19LJSwvqMiiBDWzO6qrsdW_BlYOHt0stegudmx08klwA/edit
