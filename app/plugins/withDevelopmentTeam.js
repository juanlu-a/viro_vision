/**
 * Fija el equipo de firma de iOS en el prebuild.
 *
 * `app/ios/` es un artefacto regenerable (continuous native generation): cada
 * `expo prebuild --clean` lo recrea desde cero y **se pierde el equipo seleccionado a mano en
 * Xcode**. El síntoma es siempre el mismo y no se parece a la causa:
 *
 *     error: Signing for "ViroVision" requires a development team.
 *
 * Con provisioning gratuito (Apple ID personal, sin Developer Program) el equipo es el "Personal
 * Team" del ID, y su identificador es estable. Fijarlo acá hace que el prebuild sea reproducible en
 * vez de dejar un paso manual en Xcode que hay que recordar cada vez.
 *
 * Si alguien clona el repo con otro Apple ID, esto hay que cambiarlo — o sacarlo y volver a
 * seleccionar el equipo a mano. El identificador propio sale de:
 *
 *     security cms -D -i ~/Library/Developer/Xcode/UserData/Provisioning\\ Profiles/<algo>.mobileprovision \
 *       | plutil -extract TeamIdentifier.0 raw -
 */
const { withXcodeProject } = require('expo/config-plugins');

/** Personal Team del Apple ID del equipo. Ver la nota de arriba si cambia el ID. */
const DEVELOPMENT_TEAM = 'VPNXQ8K2P8';

module.exports = function withDevelopmentTeam(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();

    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key].buildSettings;
      // Las entradas de comentario del pbxproj no tienen buildSettings; saltearlas.
      if (!buildSettings) continue;
      // Sólo el target de la app: tocar los Pods no hace falta y puede romper su firma.
      if (buildSettings.PRODUCT_NAME === undefined) continue;

      buildSettings.DEVELOPMENT_TEAM = DEVELOPMENT_TEAM;
      buildSettings.CODE_SIGN_STYLE = 'Automatic';
    }

    return cfg;
  });
};
