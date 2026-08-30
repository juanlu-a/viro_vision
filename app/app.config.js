/**
 * Variantes de la app sobre el mismo app.json.
 *
 * `APP_VARIANT=beta` produce **otra app para Apple** — bundle `com.virovision.app.beta`, nombre
 * "ViroVision β", ícono con franja BETA — porque iOS no deja instalar dos builds del mismo bundle
 * a la vez, y el equipo quiere la versión de `staging` y la oficial de `main` conviviendo en el
 * mismo teléfono (decisión del 2026-08-30). Todo lo demás (permisos, plugins, fuentes) se hereda
 * de app.json, que sigue siendo la fuente de verdad de la app oficial.
 *
 * Los scripts de TestFlight leen la misma variable para saber a qué app de App Store Connect
 * hablarle: cambiar el sufijo acá exige cambiarlo también en scripts/testflight-distribute.mjs.
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
