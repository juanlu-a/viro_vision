// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/**
 * The ADR 0001 + ADR 0006 boundary, enforced by the linter.
 *
 * The camera → detection/OCR → announcement path has to work without internet. That used to be
 * written as a comment in each module, and a comment stops nobody: it is enough for someone to
 * import the wrong module on a Tuesday night.
 *
 * `services/vision/` is the cloud: only supermarket mode uses it, from `features/reader/`. The OCR
 * in `services/ondevice/` is NOT restricted any more: since ADR 0006 it is bus mode's product path
 * (it used to be a spike and was listed here too).
 */
const ADR_0001_BOUNDARY = {
  files: ['src/features/recognition/**', 'src/features/audio/**'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@/services/vision', '@/services/vision/*', '**/services/vision/*'],
            message:
              'ADR 0001 + ADR 0006: the cloud is only used in supermarket mode, from features/reader. The recognition path and the announcement have to work without internet.',
          },
          {
            // Telemetry (ADR 0008) is network. An event recorded from here would put a network call
            // on the path ADR 0001 protects — and diagnostics cannot cost the user the voice they do
            // need. It is recorded from features/reader and features/device.
            group: ['@/services/telemetry', '@/services/telemetry/*', '**/services/telemetry/*'],
            message:
              'ADR 0001 + ADR 0008: telemetry is network. Recognition and the announcement have to work without internet; record from features/reader or features/device.',
          },
          {
            // For the same reason as above: the announcement has to play WITHOUT internet. Speech
            // synthesis to a file goes out through the proxy (ADR 0008) and is therefore called from
            // features/reader, after the announcement and without blocking it — never from inside
            // `announce()`.
            group: ['@/services/cloud', '@/services/cloud/*', '**/services/cloud/*'],
            message:
              'ADR 0001 + ADR 0008: the announcement has to work without internet. Whatever goes out to the cloud is called from features/reader, after announcing.',
          },
        ],
      },
    ],
  },
};

module.exports = defineConfig([expoConfig, ADR_0001_BOUNDARY, { ignores: ['dist/*'] }]);
