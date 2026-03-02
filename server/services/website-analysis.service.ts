import { eq } from 'drizzle-orm';
import { db } from '../db';
import { targetCompanies } from '@shared/schema';
import { geminiClient } from './gemini-client';

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

export interface WebsiteTrackingContext {
  userId?: number;
  userCompanyId?: number;
  dealId?: number;
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
  async analyzeWebsite(websiteUrl: string, tracking?: WebsiteTrackingContext): Promise<AnalysisResponse> {
    const startTime = Date.now();

    try {
      const normalizedUrl = this.normalizeUrl(websiteUrl);
      console.log(`[WEBSITE_ANALYSIS] Analyzing website: ${normalizedUrl}`);

      const prompt = `${WEBSITE_ANALYSIS_PROMPT}\n\nWebsite URL to analyse: ${normalizedUrl}`;

      const response = await geminiClient.generateContent({
        prompt,
        temperature: 0.2,
        responseMimeType: 'application/json',
        service: 'website_analysis',
        userId: tracking?.userId,
        userCompanyId: tracking?.userCompanyId,
        dealId: tracking?.dealId,
      });

      const processingTime = Date.now() - startTime;

      if (!response.text) {
        return { success: false, error: 'No content in Gemini response', processingTime };
      }

      console.log(`[WEBSITE_ANALYSIS] Raw response:`, response.text.substring(0, 500));

      const analysis = response.json
        ? this.extractAnalysisFields(response.json)
        : this.parseAnalysisResponse(response.text);
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

  private extractAnalysisFields(parsed: any): WebsiteAnalysisResult {
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

  private parseAnalysisResponse(text: string): WebsiteAnalysisResult {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return this.extractAnalysisFields(JSON.parse(jsonMatch[0]));
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

  async analyzeAndUpdateCompany(targetCompanyId: number, websiteUrl: string, tracking?: WebsiteTrackingContext): Promise<AnalysisResponse> {
    const result = await this.analyzeWebsite(websiteUrl, tracking);

    if (result.success && result.rawMarkdown) {
      await db.update(targetCompanies)
        .set({ websiteAnalysis: result.rawMarkdown, websiteAnalysisProcessedAt: new Date() })
        .where(eq(targetCompanies.id, targetCompanyId));
      console.log(`[WEBSITE_ANALYSIS] Updated company ${targetCompanyId} with analysis`);
    }

    return result;
  }

  async triggerAnalysisIfNeeded(targetCompanyId: number, websiteUrl: string | null, tracking?: WebsiteTrackingContext): Promise<void> {
    if (!websiteUrl) return;

    console.log(`[WEBSITE_ANALYSIS] Triggering async analysis for company ${targetCompanyId}`);
    setTimeout(() => {
      this.analyzeAndUpdateCompany(targetCompanyId, websiteUrl, tracking).catch(err => {
        console.error(`[WEBSITE_ANALYSIS] Async analysis failed:`, err);
      });
    }, 100);
  }
}

export const websiteAnalysisService = new WebsiteAnalysisService();
