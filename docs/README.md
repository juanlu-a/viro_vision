# ViroVision — Documentation

Thesis deliverables, architecture and decision records.

## Contents

- `architecture/` — diagramas de arquitectura y flujo de datos *(a poblar)*;
  [`architecture/adr/`](architecture/adr/) tiene los ADRs: 0001 offline-first (enmendado),
  0002 backend & auth, 0004 runtime de inferencia on-device.
- [`supabase.md`](supabase.md) · [`ci-cd.md`](ci-cd.md) — setup del backend y de CI/CD.
- [`REUNIONES-TUTOR.md`](REUNIONES-TUTOR.md) — registro de reuniones con el director de tesis.
- [`dev-build-ios.md`](dev-build-ios.md) — correr la app en un iPhone físico (development build).
- [Spike: visión local en el teléfono](spike-vision-local.md) — resultados medidos de los cuatro caminos (nube, LiteRT-LM, ExecuTorch, OCR) y la recomendación.
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
