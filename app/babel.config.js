/**
 * NativeWind necesita su propio preset de Babel para convertir `className` en estilos nativos.
 * Antes no había babel.config.js: alcanzaba con el default de Expo.
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
