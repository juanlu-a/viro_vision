# Laboratorio del spike de visión local — referencia (rama `spike/laboratorio-vision-local`)

Esta rama es una **foto de `staging` en `ce4fc6f` (2026-08-30)**, justo antes de retirar de la app el
laboratorio del spike de visión local, más este archivo. Existe para que el camino quede a la
vista si hay que volver a medir algo o documentarlo en la tesis. El PR que la acompaña es un
**borrador que no se mergea**; una vez que el retiro llegue a `staging`, su diff mostrará
exactamente el código que se sacó. También está el tag `spike-laboratorio-vision-local-2026-08-30`,
que sobrevive aunque alguien borre la rama o cierre el PR.

Los números y las conclusiones del spike ya viven en [`spike-vision-local.md`](spike-vision-local.md)
y [`pruebas-y-decisiones.md`](pruebas-y-decisiones.md); las decisiones, en
[ADR 0004](architecture/adr/0004-on-device-inference-runtime.md) y
[ADR 0006](architecture/adr/0006-pipelines-por-caso-de-uso.md).

## Qué contiene el laboratorio

| Área | Archivos |
|---|---|
| Pantallas del laboratorio (Inicio) | `app/src/features/ondevice/OnDeviceLab.tsx`, `useOnDeviceSpike.ts` · `app/src/features/benchmark/CloudBenchLab.tsx`, `useVisionBenchmark.ts`, `types.ts` |
| Runtime LiteRT-LM (Gemma) | `app/src/services/ondevice/config.ts`, `probe.ts`, `runner.ts` |
| Gemma multimodal por ExecuTorch | `app/src/services/ondevice/executorchLlm.ts` |
| Benchmark de latencia contra la nube | `app/src/services/vision/benchmark.ts`, `stats.ts`, `stats.test.ts`; prompts y schema de ómnibus (`SYSTEM_PROMPT`, `USER_PROMPT`, `JSON_SHAPE_PROMPT` en `providers/prompts.ts`; `busReadingSchema`, `parseBusReading` en `schema.ts`) |
| Cadenas | secciones `ondevice` y `benchmark` de `app/src/i18n/es.ts` |
| Config | plugin `react-native-litert-lm` en `app/app.json`; variable `EXPO_PUBLIC_ONDEVICE_SPIKE` (`.env.example`, workflows) |

Dependencias exactas del laboratorio (las que se desinstalan al retirarlo):
`react-native-litert-lm@0.6.0`, `react-native-nitro-modules@0.36.5` (peer de litert-lm),
`expo-document-picker@~57.0.1`. `react-native-executorch` y `expo-file-system` **no** son del
laboratorio: el OCR del modo ómnibus los sigue usando.

## Cómo revivirlo

```sh
git fetch origin
git checkout spike/laboratorio-vision-local -- \
  app/src/features/ondevice app/src/features/benchmark \
  app/src/services/ondevice/config.ts app/src/services/ondevice/probe.ts \
  app/src/services/ondevice/runner.ts app/src/services/ondevice/executorchLlm.ts \
  app/src/services/vision/benchmark.ts app/src/services/vision/stats.ts app/src/services/vision/stats.test.ts
cd app && npm i react-native-litert-lm@0.6.0 react-native-nitro-modules@0.36.5 expo-document-picker@~57.0.1
```

Después, a mano: reponer las secciones `ondevice`/`benchmark` en `es.ts`, los prompts y el schema
de ómnibus, el plugin en `app.json`, la variable `EXPO_PUBLIC_ONDEVICE_SPIKE`, los exports de los
barriles `services/ondevice/index.ts` y `services/vision/index.ts`, y `npx expo prebuild --clean`.
