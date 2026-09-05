# ViroVision — Roadmap

Continuation plan across the three pillars. This is the approved working roadmap; update it as work
lands. Current-state snapshot lives in [`PROJECT-STATUS.md`](PROJECT-STATUS.md); chronological history
in [`SESSION-LOG.md`](SESSION-LOG.md).

## Decisions steering the plan
- **Two workstreams in parallel:** Track A (app foundation) + Track B (ML/OCR + hardware groundwork).
- **Own design system** (extend `theme.ts` + accessible primitives), no component library.
- **Recognition integration in the app is deferred** until Track B delivers a custom-trained model or
  a working device — no throwaway pretrained-YOLO demo. The app still defines the plug-in contract.
- **Sin login** — la app abre directo a las pestañas (actualización de ADR 0002). El código de
  Supabase email+password queda archivado, no borrado, por si vuelve como sync opcional.

## Cross-cutting principles
- **Accessibility is the #1 product requirement — "screen-reader first".** Every screen/flow verified
  with real VoiceOver (iOS) + TalkBack (Android) — not assumed (Mascetti et al., see skill).
- **Offline-first** (ADR 0001, enmendado 2026-08-10): el camino cámara→detección/OCR→anuncio debe
  funcionar **sin red**. La nube se admite sólo como **acelerador opcional** en ese camino, nunca
  como único recorrido, con la inferencia local como **fallback garantizado**.
  **Account layer stays separate** (ADR 0002).
- **Minimalist / sober / modern:** few colors, strong contrast, large type, generous spacing, clear
  hierarchy, subtle motion (respect Reduce Motion), haptics for non-visual feedback.
- **Process:** each change = its own branch off up-to-date `main`, CI green, PR, **no PR stacking**,
  no AI co-author trailers.
- **Device features** (BLE, camera) need a **dev-client / EAS build** to test on device.

## Track A — App (foundation → connectivity → recognition integration)

- **A1 · Design system + accessibility foundation** *(next)* — expand `theme.ts` into tokens
  (`app/src/design/`): color (light/dark + high-contrast), typography (Dynamic Type), spacing, radii,
  motion. Add `app/src/a11y/` (`announce()`, focus helpers, `useReduceMotion`). Accessible primitives:
  `Card`, `ListItem`/`List`, `TextField`, `Switch`, `Banner`/`StatusMessage`, `Loading`, `EmptyState`,
  `ScreenHeader` (all with role/label/hint, ≥48dp targets, haptics via `expo-haptics`). Add
  `eslint-plugin-react-native-a11y`.
- **A2 · Permissions + accessible onboarding** *(next, parallel to A1)* — `app/src/features/permissions/`
  + a rationale-first onboarding route. Update `app.json`: Bluetooth (present) + WiFi/local-network
  (iOS `NSLocalNetworkUsageDescription`/`NSBonjourServices`; Android WiFi + `NEARBY_WIFI_DEVICES`) +
  camera (via `expo-camera` when A5 nears). ✅ iOS `bundleIdentifier` / Android `package` fijados en
  `com.virovision.app` (2026-08-10 — ver `dev-build-ios.md`); `expo-image-picker` ya trae
  `NSPhotoLibraryUsageDescription` (elegir la foto a leer).
- **A3 · Navigation + core screens** ✅ *(done — no login)* — iOS bottom tabs (Inicio / Dispositivo /
  Ajustes), app opens directly (no login gate — see ADR 0002 update). Home / Dispositivo / Ajustes
  rebuilt on the design system. (Real Settings model backed by `services/storage` still pending.)
- **A4 · Connectivity — data + image + audio** *(as Track B hardware firms up)* — real
  `react-native-ble-plx` client vs the stub (against `features/device/gatt.ts`); image transport
  (WiFi/local-network) in `services/transport/`; audio routing so TTS plays on the device earphone.
- **A5 · Recognition integration** *(deferred — gated on Track B)* — wire `RecognitionEvent` →
  `announcer.ts` with prioritization; camera capture + on-device runtime if phone-side.

## Track B — ML/OCR + Hardware groundwork *(parallel, in `ml/` + `hardware/`)*

- **B1 · ML / OCR** *(can start now — redefinido por ADR 0006, 2026-08-22)* — **nada se entrena**:
  los modelos vienen preentrenados. El trabajo es (a) armar los **datasets de evaluación** (bondis y
  productos): resultado esperado vs. obtenido → **recall, precision, accuracy, F1** — la forma de
  medir precisión del proyecto; (b) elegir el detector para la TPU (`rfdetr-nano` / `yolo26` /
  YOLO11-nano) y **medirlo sobre la RPi Zero 2 W + Coral** (riesgo técnico abierto); (c) medir
  **Gemma 3 1B con visión** como **fallback local** de supermercado — la decisión de qué corre en
  producción ya está tomada (nube, ADR 0006), lo que falta es cerrar la excepción a ADR 0001.
  Deliverable: el pipeline de bondis exportado + la tabla de métricas.
  > **Supermercado ya tiene su protocolo escrito**: pasos 8 y 9 de `docs/qa-modo-supermercado.md`
  > (la misma foto contra los cinco modelos, anotando `tipo`/`marca`/`detalle` por separado).
  > **El camino de ómnibus quedó en stand by el 2026-09-01**: elegir entre sus dos variantes
  > (modelo parcial o completo en la Raspi) exige tener el hardware para medirlas.
  > La pregunta de alcance de ADR 0004 quedó **cerrada por ADR 0006** con la evidencia del spike:
  > el VLM no reemplaza a detección + OCR (6,4 s contra fracciones de segundo, sin coordenadas).
  > Queda como término de comparación en el informe. Validación con el tutor pendiente.
- **B2 · Hardware** *(blocked on buying components)* — RPi Zero 2 W + Coral TPU + Camera Module 3;
  capture; **detección + recorte del banner en la TPU** (rol de preprocesadora, ADR 0006); **botón
  físico + máquina de estados de modos** (ADR 0007, incluye exponer el modo por GATT); BLE
  peripheral/GATT server matching `gatt.ts`; two channels; enclosure; RTT comparison.
- **B3 · Convergence contract** — model↔app message schema (align `RecognitionEvent`), on-device
  runtime, image transport — captured as ADRs.

## ADRs

**Escritos:** [0001 Offline-first](architecture/adr/0001-offline-first-on-device-inference.md)
(enmendado 2026-08-10 — nube como acelerador opcional) ·
[0002 Backend & auth](architecture/adr/0002-backend-and-auth-supabase.md) ·
[0004 Runtime de inferencia on-device](architecture/adr/0004-on-device-inference-runtime.md)
*(Proposed — actualizado 2026-08-22: el runtime se resuelve por caso de uso)* ·
[0006 Pipelines por caso de uso](architecture/adr/0006-pipelines-por-caso-de-uso.md)
*(Proposed — a validar con tutor)* ·
[0007 Botones físicos y modos de operación](architecture/adr/0007-botones-fisicos-modos-de-operacion.md)
*(Proposed — a validar con tutor)*.

[0003 Enlace placa ↔ teléfono](architecture/adr/0003-enlace-placa-telefono.md)
*(Proposed — el transporte de la foto se decide con la medición de throughput BLE, 2026-09-04)*.

**Por escribir:**
- **ADR 0005 — Design system & accessibility standards** (tokens, Dynamic Type, contrast, motion,
  screen-reader testing as a required step).

## Near-term sequence
1. Track A: **A1** + **A2** (biggest accessibility/UX value, unblocked).
2. Track A: **A3** after A1/A2.
3. Track B: kick off **B1**; write **ADR 0005** alongside A1.
4. In parallel, finish the pending interactive setup (EAS, Supabase, Apple) — see `PROJECT-STATUS.md`.

Recognition wiring in the app (**A5**) waits for B1/B2.

## Verification per phase
- **A1–A3:** launch app (dev client), drive each flow with VoiceOver + TalkBack; check focus order,
  labels/roles/hints, Dynamic Type, contrast, reduce-motion; CI green; login persists offline.
- **A4:** connect to device/mock, receive a `RecognitionEvent`, hear it on the device earphone output.
- **B1:** el pipeline de bondis corre sobre el dataset de evaluación; reportar recall / precision /
  accuracy / F1 + latencia on-device (ADR 0006).
