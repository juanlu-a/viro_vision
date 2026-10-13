/**
 * Our own key proxy (ADR 0008).
 *
 * ⚠️ `EXPO_PUBLIC_*` is inlined into the bundle at build time: it is not a variable the binary reads
 * at startup, it is a constant compiled into the `.ipa`. This one in particular is a URL and not a
 * secret, so it can travel; the point of the proxy is precisely that the KEYS do not.
 */
export const proxyUrl = process.env.EXPO_PUBLIC_VISION_PROXY_URL ?? '';

/**
 * With the proxy on, the app needs no key at all: the server holds them. It is what makes a build
 * distributable.
 */
export const isProxyConfigured = proxyUrl.length > 0;
