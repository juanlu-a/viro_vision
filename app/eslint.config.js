// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/**
 * Las fronteras del ADR 0001, forzadas por el linter.
 *
 * El camino cámara → detección/OCR → anuncio tiene que funcionar sin internet y sin depender de
 * experimentos a medio validar. Eso estaba escrito como comentario en cada módulo, y un comentario
 * no frena a nadie: alcanza con que alguien importe el módulo equivocado un martes a la noche.
 *
 * `services/vision/` es instrumentación contra la nube; `services/ondevice/` es el spike de
 * inferencia local (ADR 0004). Ninguno de los dos puede aparecer en el camino de reconocimiento.
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
              'ADR 0001: el benchmark de nube es instrumentación de desarrollo y no puede estar en el camino de reconocimiento, que debe funcionar sin internet.',
          },
          {
            group: ['@/services/ondevice', '@/services/ondevice/*', '**/services/ondevice/*'],
            message:
              'ADR 0001/0004: el runtime local todavía es un spike sin validar. No puede estar en el camino de reconocimiento hasta que se decida lo contrario en un ADR.',
          },
        ],
      },
    ],
  },
};

module.exports = defineConfig([expoConfig, FRONTERA_ADR_0001, { ignores: ['dist/*'] }]);
