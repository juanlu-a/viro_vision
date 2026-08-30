// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/**
 * La frontera de ADR 0001 + ADR 0006, forzada por el linter.
 *
 * El camino cámara → detección/OCR → anuncio tiene que funcionar sin internet. Eso estaba escrito
 * como comentario en cada módulo, y un comentario no frena a nadie: alcanza con que alguien importe
 * el módulo equivocado un martes a la noche.
 *
 * `services/vision/` es la nube: sólo la usa el modo supermercado, desde `features/reader/`. El
 * OCR de `services/ondevice/` ya NO está restringido: desde ADR 0006 es el camino de producto del
 * modo ómnibus (antes era un spike y también estaba acá).
 */
const FRONTERA_ADR_0001 = {
  files: ['src/features/recognition/**', 'src/features/audio/**'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@/services/vision', '@/services/vision/*', '**/services/vision/*'],
            message:
              'ADR 0001 + ADR 0006: la nube sólo se usa en el modo supermercado, desde features/reader. El camino de reconocimiento y el anuncio tienen que funcionar sin internet.',
          },
        ],
      },
    ],
  },
};

module.exports = defineConfig([expoConfig, FRONTERA_ADR_0001, { ignores: ['dist/*'] }]);
