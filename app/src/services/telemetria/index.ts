/**
 * Telemetría de la app: qué pasó, para poder verlo cuando algo falla (tabla `eventos` en Supabase).
 *
 * REGLA DE FRONTERA (ADR 0001): esto sale a internet. **Nunca desde el camino de reconocimiento ni
 * desde el del anuncio** — el linter lo fuerza para `features/recognition/` y `features/audio/`.
 * Registrar un evento es sincrónico y no espera nada, así que no puede atrasar una lectura; ver el
 * porqué completo en `registro.ts`.
 *
 * Barrel puro: única superficie de import (`@/services/telemetria`).
 */
export { registrar, subir, iniciarTelemetria, isTelemetriaConfigurada } from './registro';
export type { EventoTelemetria, LoteTelemetria, TipoEvento } from './tipos';
