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
export { SYSTEM_PROMPT, USER_PROMPT } from './prompts';
