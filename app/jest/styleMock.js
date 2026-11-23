/**
 * Stub for CSS imports. `constants/theme.ts` imports `@/global.css` (NativeWind processes it in
 * Metro), but Jest cannot parse CSS. Without this, any test that touches the tokens blows up.
 */
module.exports = {};
