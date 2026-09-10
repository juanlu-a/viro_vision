import { GROQ_CHAT_URL, OPENAI_CHAT_URL } from '../config';
import type { VisionProvider, VisionProviderId } from '../types';
import { anthropicProvider } from './anthropic';
import { geminiProvider } from './gemini';
import { createOpenAiCompatibleProvider } from './openaiCompatible';

/**
 * OpenAI and Groq are the SAME module with a different URL: the dialect is identical and writing
 * two near-identical providers only creates two places to fix the same bug.
 */
export const openaiProvider = createOpenAiCompatibleProvider({
  id: 'openai',
  label: 'OpenAI',
  url: OPENAI_CHAT_URL,
});

export const groqProvider = createOpenAiCompatibleProvider({
  id: 'groq',
  label: 'Groq',
  url: GROQ_CHAT_URL,
});

const PROVIDERS: Record<VisionProviderId, VisionProvider> = {
  gemini: geminiProvider,
  anthropic: anthropicProvider,
  openai: openaiProvider,
  groq: groqProvider,
};

export function getProvider(id: VisionProviderId): VisionProvider {
  return PROVIDERS[id];
}

export { anthropicProvider, geminiProvider };
export { createOpenAiCompatibleProvider } from './openaiCompatible';
export { PRODUCT_SYSTEM_PROMPT, PRODUCT_USER_PROMPT } from './prompts';
