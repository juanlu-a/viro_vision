/**
 * La máquina de modos de operación de ADR 0007, en su versión app.
 *
 * El diagrama canónico vive en `docs/architecture/README.md`; esta función lo transcribe y el
 * firmware del dispositivo implementará la misma máquina sobre el botón físico. La app modela los
 * gestos del botón (click, doble click, click largo) en lugar de "cambiar de pestaña de modo"
 * porque cuando exista hardware el modo lo fija el botón y la app sólo lo refleja — si la app
 * tuviera transiciones propias que el botón no tiene, las dos superficies divergirían.
 *
 * Nota deliberada del diagrama: NO hay salto directo entre modos. De un modo sólo se vuelve a
 * esperando (click largo); cualquier otro gesto deja el estado donde está.
 */

export const MODOS = ['esperando', 'omnibus', 'supermercado'] as const;
export type Modo = (typeof MODOS)[number];

export const GESTOS = ['click', 'dobleClick', 'clickLargo'] as const;
export type Gesto = (typeof GESTOS)[number];

export function transicionar(modo: Modo, gesto: Gesto): Modo {
  if (gesto === 'clickLargo') return 'esperando';
  if (modo === 'esperando' && gesto === 'click') return 'omnibus';
  if (modo === 'esperando' && gesto === 'dobleClick') return 'supermercado';
  return modo;
}
