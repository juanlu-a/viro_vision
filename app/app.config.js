/**
 * App variants on top of the same app.json. **Reserved, the pipeline does not use it today.**
 *
 * `APP_VARIANT=beta` produces another app for Apple — bundle `com.virovision.app.beta` (registered
 * in the account), name "ViroVision β", icon with a BETA band. It is useful for having a β and the
 * official one **installed at the same time** (iOS does not install two builds of the same bundle).
 * It was evaluated on 2026-08-30 and dropped: with three devs, switching build from TestFlight is
 * enough, and a second app requires its own App Store Connect listing and its own review. It stays
 * ready in case the need changes; without the variable, it returns app.json untouched.
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
