/**
 * NativeWind needs its own Babel preset to turn `className` into native styles.
 * There used to be no babel.config.js: Expo's default was enough.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
