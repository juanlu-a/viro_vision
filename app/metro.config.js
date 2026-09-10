/**
 * NativeWind wraps the Metro config to compile Tailwind's CSS and serve it to native.
 * There used to be no metro.config.js: Expo's default was enough.
 */
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

module.exports = withNativeWind(getDefaultConfig(__dirname), { input: './src/global.css' });
