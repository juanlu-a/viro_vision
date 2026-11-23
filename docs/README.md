# ViroVision: documentación

Entregables de la tesis, arquitectura, registros de decisión y guías operativas. Toda la
documentación está en español (ADR 0009); el código, en inglés.

## Contenido

- [`tesis/`](tesis/README.md): el informe de tesis, capítulos 1 a 12. Es la fuente de verdad del
  texto; el Google Doc tiene la carátula y el índice.
- [`architecture/`](architecture/README.md): el diagrama de modos de operación y los tres flujos por
  caso de uso. [`architecture/adr/`](architecture/adr/README.md) tiene los ADRs: 0001 offline-first
  (enmendado), 0002 backend y autenticación, 0003 enlace placa ↔ teléfono, 0004 runtime de inferencia
  on-device (superado por el 0006), 0006 pipelines por caso de uso, 0007 botones físicos y modos,
  0008 proxy propio para las claves de nube, 0009 idioma del código, 0010 tema oscuro único y 0011
  errores sólo en la telemetría.
- [`PROJECT-STATUS.md`](PROJECT-STATUS.md): el estado vigente de cada pilar.
  [`ROADMAP.md`](ROADMAP.md): el plan. [`SESSION-LOG.md`](SESSION-LOG.md): la historia cronológica
  del trabajo, con el porqué de cada cambio.
- [`REUNIONES-TUTOR.md`](REUNIONES-TUTOR.md): registro de las reuniones con el director de tesis.
- [`pruebas-y-decisiones.md`](pruebas-y-decisiones.md): todo lo probado, con sus números y las
  decisiones por caso de uso; borrador histórico de la sección homónima del informe.
- [`mediciones/`](mediciones/README.md): datos crudos y método de cada campaña de medición, un
  archivo por campaña. El análisis y la decisión van al informe; acá quedan los números que los
  respaldan, para que la conclusión se pueda auditar y la medición repetir.
- [`spike-vision-local.md`](spike-vision-local.md): el spike de visión local en el teléfono (nube,
  LiteRT-LM, ExecuTorch, OCR). Histórico: lo superó el ADR 0006; el laboratorio se retiró de la app
  el 2026-08-30 y se conserva en el tag `spike-laboratorio-vision-local-2026-08-30`.
- Guías de prueba de punta a punta: [`qa-modo-supermercado.md`](qa-modo-supermercado.md) (el paso 8
  alimenta el conjunto de evaluación; el paso 9 ya no se puede correr desde la app desde el
  2026-09-08) y [`qa-avisos-de-sistema.md`](qa-avisos-de-sistema.md) (los avisos que da la placa).
- Operación y despliegue: [`supabase.md`](supabase.md) (proxy de visión, telemetría y evidencia),
  [`ci-cd.md`](ci-cd.md), [`dev-build-ios.md`](dev-build-ios.md) (la app en un iPhone físico) y
  [`android-play.md`](android-play.md) (el `.apk` y Google Play, hoy deshabilitado).
- [`brand/`](brand/README.md): el manual de marca.
- [`../documents/`](../documents/): documentos fuente versionados tal cual (el diagrama de los tres
  casos, dibujado a mano).
- Fuera de `docs/`: [`../hardware/`](../hardware/README.md) (la placa, el daemon y la carcasa) y
  [`../ml/`](../ml/README.md) (el puntero al pipeline de visión, que vive en el repositorio
  `bus-banner-recognizer`).

## Entregables de la tesis (del plan del proyecto)

Contexto y problema · Estado del arte · Investigación con usuarios (encuesta de la UNCU y
entrevistas) · Requerimientos · Diseño de la arquitectura · Prototipo del dispositivo físico ·
Sistema de visión por computadora · Sistema de retroalimentación auditiva · Aplicación móvil ·
Integración del sistema completo · Validación del prototipo · Documentación técnica y manual de
usuario · Informe final · Presentación y demostración.

## Fuentes y seguimiento

- Informe de tesis: los capítulos en [`tesis/`](tesis/README.md); la carátula y el índice en el
  Google Doc enlazado desde ese README.
- Planilla de trabajo (desglose de entregables y Gantt):
  https://docs.google.com/spreadsheets/d/19LJSwvqMiiBDWzO6qrsdW_BlYOHt0stegudmx08klwA/edit

## Calendario

El desarrollo apunta a terminar **a mediados de noviembre de 2026**; la fecha límite es el
**30 de noviembre de 2026**.

> El contexto completo del proyecto para los asistentes de programación vive en la skill
> `virovision`: `.claude/skills/virovision/`.
