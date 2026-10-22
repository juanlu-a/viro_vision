# Registros de decisión de arquitectura (ADRs)

Cada ADR registra una decisión significativa: su contexto, la decisión y sus consecuencias. Formato:
Markdown breve, numerado `NNNN-titulo.md`, con estado Proposed, Accepted o Superseded. Un ADR no se
reescribe: los cambios se agregan como secciones "Actualización AAAA-MM-DD" al final.

| # | Título | Estado |
|---|-------|--------|
| [0001](0001-offline-first-on-device-inference.md) | Offline-first: inferencia autónoma en el dispositivo | Accepted (enmendado 2026-08-10: nube como acelerador opcional; actualizado 2026-10-22: sin Coral, supermercado por nube) |
| [0002](0002-backend-and-auth-supabase.md) | Backend y autenticación: Supabase como capa de cuenta | Accepted (actualizado 2026-07-18: sólo email; 2026-07-20: la app se publica sin login) |
| [0003](0003-enlace-placa-telefono.md) | Enlace placa ↔ teléfono: BLE como plano de control, la foto por WiFi | Proposed, a validar con el tutor (medido 2026-09-05: BLE 4,5 s, WiFi 0,3 s; 2026-09-13: la placa deja de emparejarse; 2026-09-17/18: cola GATT y una voz por vez; 2026-09-20: conexión rápida; 2026-10-22: hardware real, audio PWM y arranque en 16 s) |
| [0004](0004-on-device-inference-runtime.md) | Runtime de inferencia on-device (Gemma vía LiteRT-LM) | Proposed, superado en lo central por el 0006 (2026-08-22) |
| [0006](0006-pipelines-por-caso-de-uso.md) | Pipelines por caso de uso: ómnibus en la placa (detector en el sensor IMX500), supermercado con un LLM en la nube | Proposed, a validar con el tutor (2026-09-01: modelos elegidos por latencia; 2026-09-07: detector propio en el IMX500, sin Coral; 2026-09-11: el alcance son alimentos; 2026-10-19: zoom digital; 2026-10-22: márgenes del cartel, V100 y catálogo) |
| [0007](0007-botones-fisicos-modos-de-operacion.md) | Botón físico y modos de operación del dispositivo | Proposed, a validar con el tutor (2026-09-13: tiempos calibrados; 2026-10-22: hardware hecho, un click en ómnibus repite el último anuncio) |
| [0008](0008-proxy-propio-para-claves-de-nube.md) | Un proxy propio para las claves de los modelos de nube | Accepted |
| [0009](0009-idioma-del-codigo.md) | El código en inglés, la app y la tesis en español | Accepted |
| [0010](0010-modo-oscuro-unico.md) | Un solo tema (oscuro) y una sola línea de estado del dispositivo | Accepted |
| [0011](0011-errores-solo-en-telemetria.md) | Los errores van a la telemetría, nunca al usuario | Accepted |

### Por escribir (decisiones ya tomadas, todavía sin ADR)

- **0005**: design system y estándares de accesibilidad.
- Plataforma de hardware: **Raspberry Pi Zero 2 W + AI Camera (IMX500) + Waveshare UPS HAT (C)** (el
  Coral y la Camera Module 3 salieron el 2026-09-07 y el 2026-09-05).
- Framework móvil: **React Native (Expo)** frente a Flutter o nativo.
