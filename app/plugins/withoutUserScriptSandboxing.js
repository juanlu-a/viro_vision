/**
 * Config plugin: turns ENABLE_USER_SCRIPT_SANDBOXING off in the iOS project.
 *
 * WHY IT IS NEEDED
 * Expo's prebuild generates the target with `ENABLE_USER_SCRIPT_SANDBOXING = YES`. With that on, the
 * "Bundle React Native code and images" phase cannot write `ip.txt` inside the .app — the file with
 * the dev server's IP that the dev client needs to connect to Metro — and the build dies with:
 *
 *   error: Sandbox: bash(NNNNN) deny(1) file-write-data .../ViroVision.app/ip.txt
 *
 * WHY IT IS A PLUGIN AND NOT AN XCODE CHANGE
 * `app/ios/` is a regenerable artefact (continuous native generation): any adjustment made by hand
 * in Xcode is lost on the next `expo prebuild`. `expo-build-properties` does not expose this build
 * setting (checked against the SDK 57 docs), so the only way for the change to survive is to apply
 * it during prebuild, here.
 *
 * It only affects local development builds: script sandboxing is a defence against untrusted build
 * scripts, and here the scripts are React Native's and Expo's.
 */
const { withXcodeProject } = require('expo/config-plugins');

module.exports = function withoutUserScriptSandboxing(config) {
  return withXcodeProject(config, (cfg) => {
    const configurations = cfg.modResults.pbxXCBuildConfigurationSection();

    for (const key of Object.keys(configurations)) {
      // The section interleaves `<uuid>_comment` entries that are strings, not objects.
      const entry = configurations[key];
      if (typeof entry !== 'object' || entry === null) continue;
      if (!entry.buildSettings) continue;

      entry.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
    }

    return cfg;
  });
};
