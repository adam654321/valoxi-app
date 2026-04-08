import https from 'https';
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

const WEBSITE_ANALYSIS_SYSTEM_PROMPT = `You are a helpful assistant specialising in analysing information about a company based on a markdown scrape of their website page. All of your output is in British English.

Using only the information provided & without any preamble, provide the following breakdown information, if available, which a potential company buyer may find useful- if information is not available, say this:

1 Name of business eg Plumb Me In Ltd
2 Type of industry eg Manufacturing
3 Type of industry category eg Plumbing services provider
4 Company Description / Summary: a short paragraph summarising what the company does, its target market, and value proposition.
5 Year Established: If available, when the company was founded.
6 Registered Address / Location(s): Where the company operates or is headquartered.
7 Legal Structure: Ltd, LLP, Sole Trader, PLC, etc.`;

const JINA_MAX_CHARS = 50000;

export class WebsiteAnalysisService {
  private async fetchFromJina(websiteUrl: string): Promise<string> {
    const jinaUrl = `https://r.jina.ai/${websiteUrl}`;
    console.log(`[WEBSITE_ANALYSIS] Fetching content via Jina: ${jinaUrl}`);

    return new Promise((resolve, reject) => {
      const req = https.get(jinaUrl, {
        headers: { 'Accept': 'text/plain' },
      }, (resp) => {
        if (resp.statusCode && (resp.statusCode < 200 || resp.statusCode >= 300)) {
          reject(new Error(`Jina.ai request failed with status ${resp.statusCode}`));
          return;
        }
        let raw = '';
        resp.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
        resp.on('end', () => {
          const content = raw.slice(0, JINA_MAX_CHARS);
          console.log(`[WEBSITE_ANALYSIS] Jina returned ${raw.length} chars (using first ${content.length})`);
          resolve(content);
        });
      });

      req.on('error', (err: Error) => reject(err));
      req.setTimeout(30000, () => {
        req.destroy(new Error('Jina.ai request timed out'));
      });
    });
  }

  async analyzeWebsite(websiteUrl: string, tracking?: WebsiteTrackingContext): Promise<AnalysisResponse> {
    const startTime = Date.now();

    try {
      const normalizedUrl = this.normalizeUrl(websiteUrl);
      console.log(`[WEBSITE_ANALYSIS] Analyzing website: ${normalizedUrl}`);

      const pageContent = await this.fetchFromJina(normalizedUrl);

      const response = await geminiClient.generateContent({
        systemInstruction: WEBSITE_ANALYSIS_SYSTEM_PROMPT,
        prompt: pageContent,
        temperature: 0.2,
        service: 'website_analysis',
        userId: tracking?.userId,
        userCompanyId: tracking?.userCompanyId,
        dealId: tracking?.dealId,
      });

      const processingTime = Date.now() - startTime;

      if (!response.text) {
        return { success: false, error: 'No content in Gemini response', processingTime };
      }

      const rawMarkdown = response.text.trim();
      const analysis = this.parseTextResponse(rawMarkdown);

      return { success: true, analysis, rawMarkdown, processingTime };
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

  private parseTextResponse(text: string): WebsiteAnalysisResult {
    const extract = (pattern: RegExp): string | null => {
      const match = text.match(pattern);
      if (!match) return null;
      const value = match[1].trim();
      return value.toLowerCase().includes('not available') || value === '' ? null : value;
    };

    return {
      businessName: extract(/^1[.)]\s*(?:Name of business[:\-]?)?\s*(.+)/im),
      industryType: extract(/^2[.)]\s*(?:Type of industry[:\-]?)?\s*(.+)/im),
      industryCategory: extract(/^3[.)]\s*(?:Type of industry category[:\-]?)?\s*(.+)/im),
      companyDescription: extract(/^4[.)]\s*(?:Company Description\s*\/?\s*Summary[:\-]?)?\s*(.+)/im),
      yearEstablished: extract(/^5[.)]\s*(?:Year Established[:\-]?)?\s*(.+)/im),
      registeredAddress: extract(/^6[.)]\s*(?:Registered Address\s*\/?\s*Location\(?s?\)?[:\-]?)?\s*(.+)/im),
      legalStructure: extract(/^7[.)]\s*(?:Legal Structure[:\-]?)?\s*(.+)/im),
    };
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
