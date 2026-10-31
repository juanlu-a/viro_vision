# ViroVision: hoja de ruta

Plan de continuación de los tres pilares, al 2026-10-22. Se actualiza a medida que el trabajo
avanza. El estado vigente vive en [`PROJECT-STATUS.md`](PROJECT-STATUS.md) y la historia cronológica
en [`SESSION-LOG.md`](SESSION-LOG.md).

## Decisiones que guían el plan

- **Los modos los dispara el botón de la placa** (ADR 0007): 1 click es ómnibus, 2 clicks es
  supermercado, el click largo vuelve a reposo. La app es el centro de configuración y de audio, no
  el disparador.
- **Ómnibus corre entero en la placa** (ADR 0006, caso B, elegido el 2026-09-04): detector YOLO11n
  de dos clases dentro del sensor IMX500, recorte del cartel con márgenes, zoom digital del ISP, OCR
  PP-OCRv5 por ONNX y cruce contra el catálogo de líneas del STM. No necesita red.
- **Supermercado va por la nube** (ADR 0006, 2026-08-30) a través del proxy propio (ADR 0008). El
  respaldo local sigue abierto y es la excepción declarada al ADR 0001.
- **Diseño propio** sobre `theme.ts`, sin biblioteca de componentes; **un solo tema oscuro**
  (ADR 0010).
- **Sin login**: la app abre directo a las pestañas (actualización del ADR 0002). El código de
  Supabase con email y contraseña queda archivado, no borrado.

## Principios transversales

- **La accesibilidad es el primer requisito**: cada pantalla y cada flujo se verifican con VoiceOver
  (iOS) y TalkBack (Android) reales, no se suponen.
- **Offline-first** (ADR 0001, enmendado 2026-08-10): el camino cámara → detección/OCR → anuncio
  funciona sin red. La nube se admite sólo como acelerador opcional, nunca como único recorrido.
- **Los errores no se le dicen al usuario** (ADR 0011): van a la telemetría; el usuario escucha una
  frase fija de `es.ts`.
- **Proceso**: cada cambio en su rama desde `staging` al día, CI verde, PR a `staging`, sin apilar
  PRs y sin trailers de co-autoría de IA. `main` sólo recibe PRs de release desde `staging`.

## Lo hecho (resumen)

- **App**: pestañas Inicio / Dispositivo / Ajustes; cliente BLE real con cola de operaciones GATT;
  foto del supermercado por el AP WiFi de la placa; salida de audio elegible (teléfono o dispositivo)
  para todos los sonidos y una sola voz por vez; batería de la placa; fotos del modo ómnibus en Inicio
  (temporal, ver abajo); telemetría con errores tipados.
- **Placa** (Zero 2 W + AI Camera IMX500 + UPS HAT (C)): daemon con periférico BLE, botón calibrado,
  AP siempre prendido, modo ómnibus en vigilancia, anuncios pregrabados, batería por INA219, arranque
  que anuncia a los 16,2 s, journal persistente, evidencia.
- **Visión**: detector de dos clases reentrenado en la V100 (~500 fotos), PP-OCRv5 en la placa,
  catálogo que completa y filtra, márgenes del cartel 18/6/6, zoom digital hasta 2x.
- **Carcasa** VIA Clara: v0.9 en `staging`; v0.10 a v0.12 en la rama `feat/case-v0-10-slim`, con dos
  impresiones de prueba.

## Lo que falta, en orden

1. **Prueba en la calle del modo ómnibus**, con y sin zoom (`--no-bus-zoom`): medir a qué distancia
   se anuncia la línea. Si el cuello resulta ser el detector, que de lejos no encuentra el cartel,
   encarar la fase 2 del zoom: mover también la zona de entrada del detector
   (`set_inference_roi_abs`).
2. **Métricas del detector reentrenado** en la V100: épocas, mAP y la evaluación sobre las 117
   imágenes. Hoy no constan en ningún repositorio.
3. **Carcasa**: medir con calibre lo marcado `MEASURE`, imprimir la v0.12, confirmar que la llave se
   alcanza con los lentes puestos e integrar la rama a `staging`.
4. **Audio en la placa**: el PWM es provisional; falta cerrar el transductor de conducción ósea.
5. **Pruebas con usuarios** (UNCU y el usuario de validación) y la corrida de evaluación del
   supermercado sobre el conjunto de la canasta básica.
6. **ADR 0005** (design system y accesibilidad), pendiente de escritura.
7. **Informe**: capítulos 9 (conclusiones) y 10 (trabajo futuro), y los `PENDIENTE` que quedan en
   el resto.
8. **Antes de la entrega**: sacar lo que es sólo de desarrollo (sección siguiente).

## Antes de la versión final (entrega del 30/11): sacar lo que es sólo de desarrollo

Herramientas que se usan mientras se ajusta el sistema y **no van en la versión que se entrega**:

- [ ] **Evidencia del modo ómnibus** (2026-10-12): la placa guarda el cuadro de cada ómnibus y el
  recorte de cada lectura del OCR, la app los baja y los sube a Supabase junto a la telemetría.
  Son fotos de la calle, con gente. Decisión del equipo: queda mientras se prueba y se saca para la
  versión final. Qué sacar:
  - Placa: `hardware/raspi/virovision/evidence.py`, la ruta `/evidence/` de `http_server.py`, las
    banderas `--evidence-dir`/`--no-evidence` y el `evidence=` de `__main__.py`, los ganchos en
    `bus.py`, `tests/test_evidence.py` y la sección del README. Borrar `/home/virovision/evidence`.
  - App: `src/services/evidence/`, `onEvidence` en `services/ble/`, el `evidenceAddress` de
    `DeviceProvider.tsx`, los tipos `bus.evidence*` de la telemetría y el grupo en `eslint.config.js`.
    Y la pantalla (2026-10-13): `features/device/BusShots.tsx`, su uso en `app/(tabs)/index.tsx` y
    las claves `busShot*` de `i18n/es.ts`.
  - Supabase: la función `evidence` (y su bloque en `config.toml`), y vaciar y borrar el bucket
    `evidence` con una migración nueva.

## ADRs

Índice completo en [`architecture/adr/`](architecture/adr/README.md). **Por escribir**: el ADR 0005
(design system y estándares de accesibilidad: tokens, Dynamic Type, contraste, movimiento y la prueba
con lector de pantalla como paso obligatorio).

## Verificación

- **App**: cada flujo con VoiceOver y TalkBack (orden de foco, etiquetas, roles, Dynamic Type,
  contraste); `npm run lint && npm run typecheck && npm test` verde.
- **Placa**: `pytest` en `hardware/raspi/`; cada cambio del modo ómnibus se prueba en la placa contra
  un video y, después, en la calle.
- **Visión**: el pipeline de ómnibus sobre las 117 imágenes de evaluación (`bus-banner evaluate`), con
  recall, precisión, accuracy y F1, más la latencia en la placa (ADR 0006).
