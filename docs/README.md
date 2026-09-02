# ViroVision — Documentation

Thesis deliverables, architecture and decision records.

## Contents

- [`architecture/`](architecture/README.md) — el diagrama de modos de operación y los tres flujos
  por caso de uso; [`architecture/adr/`](architecture/adr/) tiene los ADRs: 0001
  offline-first (enmendado), 0002 backend & auth, 0004 runtime de inferencia on-device
  (actualizado), 0006 pipelines por caso de uso, 0007 botones físicos y modos, 0008 proxy propio
  para las claves de nube.
- [`qa-modo-supermercado.md`](qa-modo-supermercado.md) — cómo probar el modo supermercado de punta
  a punta. Los pasos 8 y 9 **son** la corrida que alimenta el dataset de evaluación de la tesis.
- [`../documents/`](../documents/) — los documentos fuente que se versionan tal cual (el diagrama
  de los tres casos, dibujado a mano).
- [`supabase.md`](supabase.md) · [`ci-cd.md`](ci-cd.md) — setup del backend y de CI/CD.
- [`REUNIONES-TUTOR.md`](REUNIONES-TUTOR.md) — registro de reuniones con el director de tesis.
- [`dev-build-ios.md`](dev-build-ios.md) — correr la app en un iPhone físico (development build).
- [Spike: visión local en el teléfono](spike-vision-local.md) — resultados medidos de los cuatro caminos (nube, LiteRT-LM, ExecuTorch, OCR), la recomendación y la nota de cierre (el laboratorio se retiró de la app el 2026-08-30; vive en la rama `spike/laboratorio-vision-local`).
- [Pruebas y decisiones](pruebas-y-decisiones.md) — todo lo probado con sus números, pros/contras
  y las decisiones por caso de uso; **borrador de la sección homónima del documento principal de
  la tesis**.
- [`SESSION-LOG.md`](SESSION-LOG.md) — historia cronológica del trabajo.
- [`ROADMAP.md`](ROADMAP.md) · [`PROJECT-STATUS.md`](PROJECT-STATUS.md) — plan y estado actual.

## Thesis deliverables (from the project plan)

Context & problem · State of the art · User research (UNCU survey + interviews) · Requirements ·
Architecture design · Physical device prototype · Computer-vision system · Auditory-feedback
system · Mobile app · Full-system integration · Prototype validation · Technical docs & user manual ·
Final thesis report · Presentation & demo.

## Source & tracking

- Main thesis document (advancement): `Documento principal _ ViroVision.docx`
  (currently kept in the authors' Downloads; add a copy or link here).
- Working spreadsheet (deliverables breakdown + Gantt):
  https://docs.google.com/spreadsheets/d/19LJSwvqMiiBDWzO6qrsdW_BlYOHt0stegudmx08klwA/edit

## Timeline

Development targeted to finish **~mid-November 2026**; hard deadline **30 November 2026**.

> Deep project context for AI assistants lives in the `virovision` skill:
> `.claude/skills/virovision/`.
