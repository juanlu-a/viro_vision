---
name: virovision
description: >-
  ViroVision thesis context — an assistive device + mobile platform for people with low or
  no vision that identifies metropolitan bus lines and basic-basket supermarket products and
  gives real-time auditory feedback, using Computer Vision, ML and OCR. Covers the three
  project pillars (React Native app, Raspberry Pi / IoT hardware, ML/OCR/CV). Use this whenever
  working on any ViroVision code, hardware, ML model, or thesis document.
---

# ViroVision

## What it is

ViroVision is a final-career (thesis) project at the **Facultad de Ingeniería, Ingeniería en
Telemática** (Montevideo, Uruguay, 2026), by **Juan Lucas Abreu, Magalí Dellapiazza and
Francisco Tauber**, directed by Ing. MSc. Sebastián García Parra.

It is an **assistive system for people with low or no vision** that recognizes objects of
interest with Computer Vision / ML / AI and returns **real-time auditory feedback**. A
camera device mounted on the temple of a pair of glasses captures the environment; a paired
**mobile app** handles connectivity, processing support and interaction. The system targets
**two concrete use cases** identified as priorities in the Uruguayan context.

### Use cases
1. **Bus-line identification** — recognize the line of an approaching metropolitan bus (OCR on
   the bus's number/name display) and announce it. When several buses are present, prioritize
   the most relevant one (by position/proximity) without auditory overload.
2. **Supermarket products** — identify basic-basket products on the shelf and announce them.

### Optional goals (nice-to-have, not core scope)
- **Fingertip pointing selection** — for products, only announce the item the user is pointing
  at / touching with their index finger.
- **Product-label OCR** — read complementary label text (variety, flavor, presentation).

## Why it matters
Grounded in a UNCU (Unión Nacional de Ciegos del Uruguay) survey (26 respondents) + interviews:
public transport and supermarket shopping are the two situations where blind/low-vision people
most need third-party help. Existing tools (OrCam MyEye > USD 4,000, Seeing AI, Google Lookout)
are costly, cloud-dependent, or not adapted to the local bus system. ViroVision aims for an
**accessible, low-cost, locally-adapted** alternative. Project backers: Arnaldo Castro (company),
UNCU (info), potential ANII link, and validation with a real user (Luciano).

## Timeline
Iterative/incremental, agile (Scrum/Kanban), Git for version control. Development targeted to
finish **~mid-November 2026**, with a hard deadline of **30 November 2026** (≈2 weeks reserved for
final integration, bug-fixing and joint testing).

## The three pillars

| Pillar | Folder | Summary |
|--------|--------|---------|
| **Mobile app** | `app/` | React Native (Expo). BLE (GATT) data/control link to the device, routing TTS audio to the device's earphone, config, and first-class accessibility. See [references/app.md](references/app.md). |
| **Hardware / IoT** | `hardware/` | Glasses-mounted camera device: Raspberry Pi Zero 2 W + Coral TPU + Camera Module 3. See [references/hardware.md](references/hardware.md). |
| **ML / OCR / CV** | `ml/` | Per-use-case pipelines (ADR 0006): buses = pretrained detection on the Coral TPU → banner crop → OCR; supermarket = vision LLM (local small vs. cloud, pending). Evaluation datasets with recall/precision/accuracy/F1. See [references/ml.md](references/ml.md). |

Y tres referencias transversales, que aplican al trabajo diario más que cualquier otra cosa de este
documento:

| Referencia | Cuándo |
|---|---|
| [references/convenciones.md](references/convenciones.md) | **Antes de escribir código o abrir un PR.** Stack, estructura, patrones de servicio, errores tipados, tests, accesibilidad, y el flujo de ramas/commits. |
| [references/decisiones.md](references/decisiones.md) | Antes de tomar una decisión que quizá ya se tomó. Índice de ADRs con su estado y **qué cambió** en cada enmienda. |
| skill **`virovision-marca`** | Ante cualquier cosa visual: colores, tokens de tema, íconos, tipografía, material de la tesis. |

## Cross-cutting conventions & constraints
- **Language:** the project and its documentation are in **Spanish**. Prefer Spanish for
  user-facing strings, thesis docs and comments where the surrounding context is Spanish.
- **Accessibility is a hard requirement**, not a nice-to-have. Every UI decision is evaluated
  against blind/low-vision usability and native screen readers (VoiceOver / TalkBack).
- **Offline-first / self-contained (hard requirement).** The **essential features** — object
  detection, OCR and auditory feedback — MUST work **without internet**. The recognition model is
  **bundled in the app / on the device and runs locally** (on-device inference) — that local path is
  the **guaranteed fallback**. Since the 2026-08-10 tutor meeting (ADR 0001, amended) the **cloud is
  allowed as an optional accelerator** on the recognition path: a runtime *model gateway* may route
  an inference to the cloud when there is coverage and it buys accuracy. **Cloud-only recognition,
  with no local fallback, stays forbidden**, and latency-critical cases (bus lines) stay local by
  default. Losing connectivity may cost accuracy or latency, never the recognition or the audio.
  This is still a core differentiator vs. cloud-dependent tools (Seeing AI, Lookout, OrCam).
  There is no single on-device runtime: since **ADR 0006** (2026-08-22) each use case has its own
  pipeline — buses = local detection (Coral TPU) → banner crop → OCR; supermarket = vision LLM
  (local small model or cloud, pending). ADR 0004's "Gemma via LiteRT-LM" is no longer the primary
  path. In the "offload to phone" architecture the model runs **locally on the phone**, not on a
  server.
- **Low cost, portable.** Hardware and processing choices balance accuracy against cost, size, power
  and feasibility. The device must be cheap and easy to carry.
- **Two evaluated architectures:** (a) process on-device (standalone), and (b) offload image
  processing to the phone over Wi-Fi/BLE. The RPi Zero 2 W was chosen partly because it lets the
  team **implement and compare both**.

## Git / contribution conventions

- **Do NOT add an AI co-author to commits.** Never append `Co-Authored-By: Claude ...` (or any
  AI-authorship trailer) to commit messages or PR descriptions. Commits are attributed to the human
  author only.
- **Every new piece of work starts on a fresh feature branch, created before the first edit**,
  from an up-to-date `main` — never commit on `main` or on a previous task's branch. Details in
  `references/convenciones.md`.

El resto —formato de commit, nombres de rama, la regla de no apilar PRs, cómo verificar que un
merge no perdió nada— vive en **[references/convenciones.md](references/convenciones.md)**, para que
no haya dos copias que se desincronicen.

## Repository map
- `app/` — React Native mobile app (scaffolded with Expo + dev client).
- `hardware/` — RPi Zero 2 W firmware/scripts, BLE peripheral, 3D casing models.
- `ml/` — YOLO11 training, OCR, datasets, edge export (TFLite).
- `docs/` — thesis deliverables, architecture, ADRs.

## Open / pending items (flagged `PENDIENTE` in the source thesis document)
These are explicitly incomplete in the thesis and should be treated as open research:
- **Edge AI / Google Gemma** analysis (architecture, edge variants, viability on chosen hardware,
  vs. MobileNet / EfficientDet / YOLO-nano).
- **State of the art** for: OCR on public-transport signage / LED displays; supermarket product
  recognition; real-time object detection on edge hardware.
- **Communication protocols** comparison (BLE vs. others; RTT/latency analysis was started).

> This skill is a snapshot of the thesis document as of mid-2026. Verify against the live repo and
> the working spreadsheet before treating any decision as final:
> https://docs.google.com/spreadsheets/d/19LJSwvqMiiBDWzO6qrsdW_BlYOHt0stegudmx08klwA/edit
