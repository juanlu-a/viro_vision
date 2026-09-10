/**
 * Where the `telemetry` function's URL comes from.
 *
 * Two sources, in this order: our own variable when it is set, and otherwise **deriving it from the
 * vision proxy's**, which points at another function of the same Supabase project.
 *
 * The second one was rescued from the `feat/telemetria-supabase` branch (2026-09-07) and it is worth
 * keeping for one concrete operational reason: without it, a build that has the proxy configured but
 * not the new secret ships **with no telemetry at all** and nobody finds out until something needs
 * diagnosing. The two URLs always live in the same project, so asking for them separately is asking
 * twice for the same datum and letting them drift apart.
 *
 * Pure module: the derivation is tested without network and without environment.
 */

/**
 * `…/functions/v1/vision` → `…/functions/v1/telemetry`.
 *
 * Returns `null` when the URL does not end in `/vision`, instead of trying to guess: a
 * force-assembled URL would 404 on every batch and the queue would fill with retries against an
 * endpoint that does not exist. Better off and known than on and broken.
 */
export function telemetryUrlFrom(proxyUrl: string | undefined | null): string | null {
  if (!proxyUrl) return null;
  const withoutTrailingSlash = proxyUrl.replace(/\/+$/, '');
  // The scheme is stripped BEFORE comparing: `https://vision` also "ends in /vision" —because of the
  // double slash— and without this it derived `https:/telemetry`, a broken URL that would 404 on
  // every batch.
  const withoutScheme = withoutTrailingSlash.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  return withoutScheme.endsWith('/vision')
    ? `${withoutTrailingSlash.slice(0, -'/vision'.length)}/telemetry`
    : null;
}

/**
 * The effective URL. Both parameters come in as arguments and are not read from `process.env` in
 * here, so the test measures the code and not the environment it runs in (the lesson of the
 * TestFlight failure of 2026-09-02).
 */
export function resolveTelemetryUrl(
  own: string | undefined | null,
  proxy: string | undefined | null
): string {
  if (own) return own;
  return telemetryUrlFrom(proxy) ?? '';
}
