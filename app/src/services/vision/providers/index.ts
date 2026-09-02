import { GROQ_CHAT_URL, OPENAI_CHAT_URL } from '../config';
import type { VisionProvider, VisionProviderId } from '../types';
import { anthropicProvider } from './anthropic';
import { geminiProvider } from './gemini';
import { crearProveedorOpenAiCompatible } from './openaiCompatible';

/**
 * OpenAI y Groq son el MISMO módulo con distinta URL: el dialecto es idéntico y escribir dos
 * proveedores casi iguales sólo crea dos lugares donde arreglar el mismo bug.
 */
export const openaiProvider = crearProveedorOpenAiCompatible({
  id: 'openai',
  label: 'OpenAI',
  url: OPENAI_CHAT_URL,
});

export const groqProvider = crearProveedorOpenAiCompatible({
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
export { crearProveedorOpenAiCompatible } from './openaiCompatible';
export { PRODUCTO_SYSTEM_PROMPT, PRODUCTO_USER_PROMPT } from './prompts';
