/**
 * Config plugin: apaga ENABLE_USER_SCRIPT_SANDBOXING en el proyecto iOS.
 *
 * POR QUÉ HACE FALTA
 * El prebuild de Expo genera el target con `ENABLE_USER_SCRIPT_SANDBOXING = YES`. Con eso activo,
 * la fase "Bundle React Native code and images" no puede escribir `ip.txt` dentro del .app —
 * el archivo con la IP del dev server que el dev client necesita para conectarse a Metro — y el
 * build muere con:
 *
 *   error: Sandbox: bash(NNNNN) deny(1) file-write-data .../ViroVision.app/ip.txt
 *
 * POR QUÉ ES UN PLUGIN Y NO UN CAMBIO EN XCODE
 * `app/ios/` es un artefacto regenerable (continuous native generation): cualquier ajuste hecho a
 * mano en Xcode se pierde en el próximo `expo prebuild`. `expo-build-properties` no expone esta
 * build setting (revisado contra los docs de SDK 57), así que la única forma de que el cambio
 * sobreviva es aplicarlo en el prebuild, acá.
 *
 * Sólo afecta builds locales de desarrollo: el sandboxing de scripts es una defensa contra scripts
 * de build no confiables, y acá los scripts son los de React Native y Expo.
 */
const { withXcodeProject } = require('expo/config-plugins');

module.exports = function withoutUserScriptSandboxing(config) {
  return withXcodeProject(config, (cfg) => {
    const configurations = cfg.modResults.pbxXCBuildConfigurationSection();

    for (const key of Object.keys(configurations)) {
      // La sección intercala entradas `<uuid>_comment` que son strings, no objetos.
      const entry = configurations[key];
      if (typeof entry !== 'object' || entry === null) continue;
      if (!entry.buildSettings) continue;

      entry.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
    }

    return cfg;
  });
};
