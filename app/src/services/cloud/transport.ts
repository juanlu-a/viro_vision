/**
 * Where the vision request goes out: straight to the provider, or through our own proxy (ADR 0008).
 *
 * BOUNDARY RULE (ADR 0001 + ADR 0006): this is part of the supermarket path and **must not be
 * called from the bus path**, which runs locally on the TPU and the OCR. A proxy in the middle adds
 * a network hop to a path ADR 0001 requires to work without internet.
 *
 * A TENSION WORTH NAMING, so nobody reads it as a violation: the boundary rule in
 * `services/supabase/client.ts` forbids **the online account** on the recognition path. This uses
 * Supabase's *infrastructure*, not the account: there is no session, no user, no table. It is an
 * HTTP function that happens to be hosted at the same provider. The rule stands exactly as written.
 *
 * Pure module: it decides a URL and an envelope, it does not touch the network. See transport.test.ts.
 */
import { proxyUrl as defaultProxyUrl } from './config';
import type { CloudProviderId, CloudRequest } from './types';

/**
 * Rewrites the request towards the proxy, or lets it through when no proxy is configured.
 *
 * The provider's headers **are dropped**: they are the ones carrying the key, and the whole point of
 * the proxy is that the key never leaves the server. The proxy rebuilds them from its secrets — which
 * is also why it rebuilds `anthropic-version`, which is part of which API we talk to and not of what
 * we ask the model.
 *
 * The URL does travel, and the proxy validates it against the declared provider's host allowlist. It
 * goes from here and not from a server-side table so that the path keeps being chosen by the
 * provider module —which is the one that knows whether its API is `/v1/messages` or
 * `/v1/chat/completions`— and adding a model does not force a redeploy of the function.
 */
export function resolveTransport(
  request: CloudRequest,
  provider: CloudProviderId,
  proxyUrl: string = defaultProxyUrl,
): CloudRequest {
  if (proxyUrl === '') return request;

  return {
    url: proxyUrl,
    headers: { 'content-type': 'application/json' },
    body: { provider, url: request.url, body: request.body },
  };
}
