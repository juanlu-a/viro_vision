/**
 * NativeWind envuelve la config de Metro para compilar el CSS de Tailwind y servirlo a nativo.
 * Antes no había metro.config.js: alcanzaba con el default de Expo.
 */
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

module.exports = withNativeWind(getDefaultConfig(__dirname), { input: './src/global.css' });
