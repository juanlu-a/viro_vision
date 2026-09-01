# ViroVision — contexto de sesión

App de asistencia para personas ciegas o con baja visión (tesis, Montevideo 2026): identifica
líneas de ómnibus y productos de supermercado y lo dice en voz alta. Tres pilares: `app/`
(React Native/Expo), `hardware/` (RPi + Coral TPU), `ml/` (detección/OCR/datasets).

**Lo primero al abrir una sesión en este proyecto, siempre: invocá la skill `virovision`**
(SKILL.md + `references/convenciones.md`): ahí viven el contexto completo, las decisiones (ADRs) y las convenciones. Para cualquier cosa
visual, la skill `virovision-marca`. Esto no es opcional: la base tiene reglas que no se deducen
del código.

Reglas duras que aplican desde el primer minuto:

- **Todo trabajo nuevo arranca creando una feature branch desde `origin/staging` al día, ANTES del
  primer edit.** Los PRs van a `staging` (rama por defecto; cada merge publica a los testers
  internos de TestFlight). `main` es producción: sólo recibe PRs `staging → main` (= release,
  publica al link público). Nunca commitees directo en `staging` ni en `main`.
- **Nada de trailers de co-autoría de IA** en commits ni PRs.
- Conventional Commits con scope, asunto en español; identificadores en inglés, comentarios y
  cadenas en español; toda cadena visible va en `app/src/i18n/es.ts`.
- **La accesibilidad es EL criterio de diseño**, no una capa: la voz es la interfaz. Offline-first:
  el modo ómnibus (OCR local) tiene que funcionar sin internet (ADR 0001/0006).
- Verificación mínima antes de un PR: `cd app && npm run lint && npm run typecheck && npm test`.
- **Al cerrar cada sesión o ticket, actualizá la knowledgebase**: `docs/SESSION-LOG.md` siempre
  (qué se hizo y por qué; los pendientes al final); `docs/PROJECT-STATUS.md` si cambió el estado
  vigente; la skill `virovision` si cambió cómo se trabaja; un ADR si hubo una decisión. La tabla
  completa vive en `references/convenciones.md` ("Qué documento actualizar").
