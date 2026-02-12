import { config } from '../config';

/**
 * Resolves which Gemini API key to use for a given analysis job.
 * 
 * Current behaviour: always returns the platform key.
 * Future: will check userCompanies settings for a custom key first,
 * falling back to the platform key if none is configured.
 */
export async function resolveGeminiApiKey(userCompanyId?: number): Promise<string> {
  // FUTURE: lookup userCompanies.geminiApiKey by userCompanyId here
  // For now, always return platform key
  
  const platformKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!platformKey) {
    throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
  }
  return platformKey;
}
