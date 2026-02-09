export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 45000, // 45 seconds (Gemini suggests ~40s for rate limits)
  maxDelayMs: 120000, // 2 minutes max
  timeoutMs: 180000, // 3 minutes timeout per request
};

export function isRateLimitError(response: Response): boolean {
  return response.status === 429;
}

export function isRetryableError(response: Response): boolean {
  return response.status === 429 || response.status === 503;
}

export function parseRetryDelay(errorBody: string): number | null {
  try {
    const parsed = JSON.parse(errorBody);
    const retryInfo = parsed?.error?.details?.find(
      (d: any) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
    );
    if (retryInfo?.retryDelay) {
      const delayStr = retryInfo.retryDelay.replace("s", "");
      return Math.ceil(parseFloat(delayStr) * 1000);
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryOptions: Partial<RetryOptions> = {}
): Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...retryOptions };
  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);
      
      let response: Response;
      try {
        response = await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      if (isRetryableError(response)) {
        const errorBody = await response.text();
        const suggestedDelay = parseRetryDelay(errorBody);
        const delay = Math.min(
          suggestedDelay || opts.baseDelayMs * Math.pow(2, attempt),
          opts.maxDelayMs
        );
        const errorType = response.status === 429 ? 'Rate limited' : 'Model overloaded (503)';

        if (attempt < opts.maxRetries) {
          console.log(
            `[GEMINI_RETRY] ${errorType} (attempt ${attempt + 1}/${opts.maxRetries + 1}). Waiting ${Math.round(delay / 1000)}s before retry...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        } else {
          console.error(
            `[GEMINI_RETRY] ${errorType} after ${opts.maxRetries + 1} attempts. Giving up.`
          );
          throw new Error(`Gemini API ${errorType.toLowerCase()} after ${opts.maxRetries + 1} attempts`);
        }
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Handle timeout (AbortError)
      if (lastError.name === 'AbortError' || lastError.message.includes('aborted')) {
        console.log(
          `[GEMINI_RETRY] Request timed out (attempt ${attempt + 1}/${opts.maxRetries + 1}). Retrying...`
        );
        if (attempt < opts.maxRetries) {
          continue;
        }
        throw new Error(`Gemini API request timed out after ${opts.maxRetries + 1} attempts`);
      }
      
      // If it's not a rate limit or timeout error, don't retry
      if (!lastError.message.includes("rate limit")) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error("Fetch failed after retries");
}
