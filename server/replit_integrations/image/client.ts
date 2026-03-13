/**
 * DISABLED — Replit AI Integrations image client removed.
 * All Gemini API calls must go through server/services/gemini-client.ts
 * using GOOGLE_GEMINI_API_KEY. Do not re-enable this file or add
 * AI_INTEGRATIONS_GEMINI_API_KEY / AI_INTEGRATIONS_GEMINI_BASE_URL
 * to this project.
 */

export function generateImage(_prompt: string): Promise<string> {
  throw new Error(
    'generateImage is disabled. All AI calls must use server/services/gemini-client.ts'
  );
}

export const ai = null;
