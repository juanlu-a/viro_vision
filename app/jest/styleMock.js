/**
 * Stub para imports de CSS. `constants/theme.ts` importa `@/global.css` (NativeWind lo procesa en
 * Metro), pero Jest no sabe parsear CSS. Sin esto, cualquier test que toque los tokens revienta.
 */
module.exports = {};
