import { eq } from 'drizzle-orm';
import { db } from '../db';
import { targetCompanies } from '@shared/schema';

interface WebsiteAnalysisResult {
  businessName: string | null;
  industryType: string | null;
  industryCategory: string | null;
  companyDescription: string | null;
  yearEstablished: string | null;
  registeredAddress: string | null;
  legalStructure: string | null;
}

interface AnalysisResponse {
  success: boolean;
  analysis?: WebsiteAnalysisResult;
  rawMarkdown?: string;
  error?: string;
  processingTime?: number;
}

const WEBSITE_ANALYSIS_PROMPT = `You are a helpful assistant specialising in analysing information about a company based on their website. All of your output is in British English.

Analyse the website at the provided URL. Using only the information you can find, provide the following breakdown information which a potential company buyer may find useful. If information is not available, indicate "Not available".

Please provide your response in the following JSON format:
{
  "businessName": "Name of business eg Plumb Me In Ltd",
  "industryType": "Type of industry eg Manufacturing",
  "industryCategory": "Type of industry category eg Plumbing services provider",
  "companyDescription": "A short paragraph summarising what the company does, its target market, and value proposition",
  "yearEstablished": "When the company was founded, if available",
  "registeredAddress": "Where the company operates or is headquartered",
  "legalStructure": "Ltd, LLP, Sole Trader, PLC, etc."
}

Respond ONLY with the JSON object, no additional text or markdown formatting.`;

export class WebsiteAnalysisService {
  async analyzeWebsite(websiteUrl: string): Promise<AnalysisResponse> {
    const startTime = Date.now();

    try {
      const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
      if (!apiKey) {
        return { success: false, error: 'GOOGLE_GEMINI_API_KEY is not configured' };
      }

      const normalizedUrl = this.normalizeUrl(websiteUrl);
      console.log(`[WEBSITE_ANALYSIS] Analyzing website: ${normalizedUrl}`);

      const requestBody = {
        generationConfig: { temperature: 0.2 },
        contents: [{
          parts: [
            { text: `${WEBSITE_ANALYSIS_PROMPT}\n\nWebsite URL to analyse: ${normalizedUrl}` }
          ]
        }]
      };

      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(requestBody)
        }
      );

      const processingTime = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[WEBSITE_ANALYSIS] API error:`, errorText);
        return { success: false, error: `Gemini API error: ${response.status}`, processingTime };
      }

      const data = await response.json();
      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) {
        return { success: false, error: 'No content in Gemini response', processingTime };
      }

      console.log(`[WEBSITE_ANALYSIS] Raw response:`, textContent.substring(0, 500));

      const analysis = this.parseAnalysisResponse(textContent);
      const markdown = this.formatAsMarkdown(analysis);

      return { success: true, analysis, rawMarkdown: markdown, processingTime };
    } catch (error) {
      console.error(`[WEBSITE_ANALYSIS] Error:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', processingTime: Date.now() - startTime };
    }
  }

  private normalizeUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }

  private parseAnalysisResponse(text: string): WebsiteAnalysisResult {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          businessName: parsed.businessName || null,
          industryType: parsed.industryType || null,
          industryCategory: parsed.industryCategory || null,
          companyDescription: parsed.companyDescription || null,
          yearEstablished: parsed.yearEstablished || null,
          registeredAddress: parsed.registeredAddress || null,
          legalStructure: parsed.legalStructure || null
        };
      }
    } catch (e) {
      console.error(`[WEBSITE_ANALYSIS] Failed to parse JSON:`, e);
    }
    return { businessName: null, industryType: null, industryCategory: null, companyDescription: null, yearEstablished: null, registeredAddress: null, legalStructure: null };
  }

  private formatAsMarkdown(analysis: WebsiteAnalysisResult): string {
    return `## Website Analysis

**Business Name:** ${analysis.businessName || 'Not available'}

**Industry Type:** ${analysis.industryType || 'Not available'}

**Industry Category:** ${analysis.industryCategory || 'Not available'}

**Company Description:** ${analysis.companyDescription || 'Not available'}

**Year Established:** ${analysis.yearEstablished || 'Not available'}

**Registered Address:** ${analysis.registeredAddress || 'Not available'}

**Legal Structure:** ${analysis.legalStructure || 'Not available'}`;
  }

  async analyzeAndUpdateCompany(targetCompanyId: number, websiteUrl: string): Promise<AnalysisResponse> {
    const result = await this.analyzeWebsite(websiteUrl);

    if (result.success && result.rawMarkdown) {
      await db.update(targetCompanies)
        .set({ websiteAnalysis: result.rawMarkdown, websiteAnalysisProcessedAt: new Date() })
        .where(eq(targetCompanies.id, targetCompanyId));
      console.log(`[WEBSITE_ANALYSIS] Updated company ${targetCompanyId} with analysis`);
    }

    return result;
  }

  async triggerAnalysisIfNeeded(targetCompanyId: number, websiteUrl: string | null): Promise<void> {
    if (!websiteUrl) return;

    console.log(`[WEBSITE_ANALYSIS] Triggering async analysis for company ${targetCompanyId}`);
    setTimeout(() => {
      this.analyzeAndUpdateCompany(targetCompanyId, websiteUrl).catch(err => {
        console.error(`[WEBSITE_ANALYSIS] Async analysis failed:`, err);
      });
    }, 100);
  }
}

export const websiteAnalysisService = new WebsiteAnalysisService();
