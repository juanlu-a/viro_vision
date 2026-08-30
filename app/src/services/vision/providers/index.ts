import type { VisionProvider, VisionProviderId } from '../types';
import { anthropicProvider } from './anthropic';
import { geminiProvider } from './gemini';

const PROVIDERS: Record<VisionProviderId, VisionProvider> = {
  gemini: geminiProvider,
  anthropic: anthropicProvider,
};

export function getProvider(id: VisionProviderId): VisionProvider {
  return PROVIDERS[id];
}

export { anthropicProvider, geminiProvider };
export { PRODUCTO_SYSTEM_PROMPT, PRODUCTO_USER_PROMPT } from './prompts';
