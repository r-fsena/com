import type { TenantAIConfig } from '@/types/crm';

/** Server policy: disabled providers never fall through to another external model. */
export function externalAIAllowed(config?: Pick<TenantAIConfig, 'provider'>): boolean {
  if (process.env.AI_EXTERNAL_ENABLED !== 'true' || config?.provider === 'LOCAL_ONLY') return false;
  if (process.env.GEMINI_ENABLED !== 'true' && (!config?.provider || ['GEMINI', 'PLATFORM_DEFAULT'].includes(config.provider))) return false;
  return true;
}
export function remoteAIConfigured(config: TenantAIConfig): boolean {
  return externalAIAllowed(config) && !!(config.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.AWS_BEDROCK_MODEL_ID);
}
