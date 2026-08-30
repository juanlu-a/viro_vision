/**
 * Variantes de la app sobre el mismo app.json. **Reservado, hoy no lo usa la pipeline.**
 *
 * `APP_VARIANT=beta` produce otra app para Apple — bundle `com.virovision.app.beta` (registrado
 * en la cuenta), nombre "ViroVision β", ícono con franja BETA. Sirve para tener una β y la oficial
 * **instaladas a la vez** (iOS no instala dos builds del mismo bundle). Se evaluó el 2026-08-30 y se
 * descartó: con tres devs alcanza con cambiar de build desde TestFlight, y una segunda app exige su
 * propia ficha en App Store Connect y su propia revisión. Queda listo por si cambia la necesidad;
 * sin la variable, devuelve app.json intacto.
 */
const IS_BETA = process.env.APP_VARIANT === 'beta';

module.exports = ({ config }) => {
  if (!IS_BETA) return config;
  return {
    ...config,
    name: 'ViroVision β',
    scheme: 'virovision-beta',
    icon: './assets/images/icon-beta.png',
    ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.beta` },
    android: { ...config.android, package: `${config.android.package}.beta` },
  };
};
