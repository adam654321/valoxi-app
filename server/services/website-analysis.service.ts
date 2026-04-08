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

      const rawText = response.text.trim();
      const analysis = this.parseTextResponse(rawText);
      const rawMarkdown = this.formatAsMarkdown(analysis);

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
    const normalize = (value: string): string | null => {
      const cleaned = value.trim().replace(/\*\*/g, '').replace(/\s+/g, ' ');
      if (!cleaned) return null;
      // Only treat as unavailable if the whole value IS "not available" (not if it's mentioned in passing)
      const isUnavailable = /^(?:not available|not provided|information not available|n\/a|none|unknown)\.?$/i.test(cleaned);
      return isUnavailable ? null : cleaned;
    };

    const stripLabel = (content: string): string => content
      .replace(/^(?:Name of business|Type of industry category|Type of industry|Company Description\s*\/?\s*Summary|Year Established|Registered Address\s*\/?\s*Location\(?s?\)?|Legal Structure)\s*[:\-]?\s*/i, '')
      .replace(/^\*\*[^*]+\*\*\s*[:\-]?\s*/, '')
      .trim();

    const segments: Record<number, string> = {};

    // Split on any of: "1 ", "1. ", "1) ", "**1.", "**1 " — possibly after line start
    const parts = text.split(/(?=(?:^|\n)\s*\*{0,2}[1-7][.)]\s)/);
    for (const part of parts) {
      // Match number at the very start of the segment, stripping optional markdown bold
      const match = part.trim().match(/^\*{0,2}([1-7])[.)]\s*\*{0,2}\s*([\s\S]*)/);
      if (match) {
        const num = parseInt(match[1]);
        const content = stripLabel(match[2]);
        segments[num] = content;
      }
    }

    // Fallback: try named-label extraction if number splitting missed fields
    if (Object.keys(segments).length === 0) {
      const labelPatterns: Array<[number, RegExp]> = [
        [1, /(?:Name of business|Business Name)[^:\n]*[:\-]\s*(.+)/i],
        [2, /(?:Type of industry(?! category)|Industry Type)[^:\n]*[:\-]\s*(.+)/i],
        [3, /(?:Type of industry category|Industry Category)[^:\n]*[:\-]\s*(.+)/i],
        [4, /(?:Company Description|Summary)[^:\n]*[:\-]\s*([\s\S]+?)(?=\n\s*\d[.) ]|$)/i],
        [5, /(?:Year Established|Founded)[^:\n]*[:\-]\s*(.+)/i],
        [6, /(?:Registered Address|Registered Office|Location)[^:\n]*[:\-]\s*(.+)/i],
        [7, /(?:Legal Structure)[^:\n]*[:\-]\s*(.+)/i],
      ];
      for (const [num, pattern] of labelPatterns) {
        const m = text.match(pattern);
        if (m) segments[num] = m[1].trim();
      }
    }

    return {
      businessName: normalize(segments[1] || ''),
      industryType: normalize(segments[2] || ''),
      industryCategory: normalize(segments[3] || ''),
      companyDescription: normalize(segments[4] || ''),
      yearEstablished: normalize(segments[5] || ''),
      registeredAddress: normalize(segments[6] || ''),
      legalStructure: normalize(segments[7] || ''),
    };
  }

  private formatAsMarkdown(analysis: WebsiteAnalysisResult): string {
    const line = (label: string, value: string | null) =>
      `**${label}:** ${value || 'Not available'}`;

    return [
      '## Website Analysis',
      '',
      line('Business Name', analysis.businessName),
      '',
      line('Industry Type', analysis.industryType),
      '',
      line('Industry Category', analysis.industryCategory),
      '',
      line('Company Description', analysis.companyDescription),
      '',
      line('Year Established', analysis.yearEstablished),
      '',
      line('Registered Address', analysis.registeredAddress),
      '',
      line('Legal Structure', analysis.legalStructure),
    ].join('\n');
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
