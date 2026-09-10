/**
 * Pins the iOS signing team during prebuild.
 *
 * `app/ios/` is a regenerable artefact (continuous native generation): every
 * `expo prebuild --clean` recreates it from scratch and **the team selected by hand in Xcode is
 * lost**. The symptom is always the same and looks nothing like the cause:
 *
 *     error: Signing for "ViroVision" requires a development team.
 *
 * The team is the project's Apple ID one, enrolled in the Apple Developer Program since 2026-08
 * (before that, the same ID's free "Personal Team" — the identifier is preserved). Pinning it here
 * makes the prebuild reproducible instead of leaving a manual Xcode step to remember every time.
 * EAS Build does not go through here: it signs with its own credentials.
 *
 * If someone clones the repo with another Apple ID, this has to change — or be removed and the team
 * selected by hand again. Your own identifier comes from:
 *
 *     security cms -D -i ~/Library/Developer/Xcode/UserData/Provisioning\\ Profiles/<algo>.mobileprovision \
 *       | plutil -extract TeamIdentifier.0 raw -
 */
const { withXcodeProject } = require('expo/config-plugins');

/** The project's Apple ID team (Developer Program). See the note above if the ID changes. */
const DEVELOPMENT_TEAM = 'VPNXQ8K2P8';

module.exports = function withDevelopmentTeam(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();

    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key].buildSettings;
      // The pbxproj's comment entries have no buildSettings; skip them.
      if (!buildSettings) continue;
      // The app target only: touching the Pods is unnecessary and can break their signing.
      if (buildSettings.PRODUCT_NAME === undefined) continue;

      buildSettings.DEVELOPMENT_TEAM = DEVELOPMENT_TEAM;
      if (process.env.IOS_SIGNING_PROFILE) {
        // MANUAL signing, in CI only (the workflow exports IOS_SIGNING_PROFILE after installing the
        // certificate and the profile). It goes in the pbxproj and only on the app target, not on
        // xcodebuild's command line: passed globally it would reach the Pods, whose resource bundles
        // cannot be signed with the app's profile. Reason for manual signing: the unsigned archive
        // exported without the project's entitlements (2026-09-06, docs/dev-build-ios.md).
        buildSettings.CODE_SIGN_STYLE = 'Manual';
        // Without the `[sdk=iphoneos*]` variant: the pbxproj parser expo uses rejects that key.
        buildSettings.CODE_SIGN_IDENTITY = '"Apple Distribution"';
        buildSettings.PROVISIONING_PROFILE_SPECIFIER = `"${process.env.IOS_SIGNING_PROFILE}"`;
      } else {
        buildSettings.CODE_SIGN_STYLE = 'Automatic';
      }
    }

    return cfg;
  });
};
