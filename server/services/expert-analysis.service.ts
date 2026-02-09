import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  expertAnalysisResults,
  targetCompanies,
  documents,
  documentAnalysisResults,
  type ExpertAnalysisResult,
  type TargetCompany,
} from '@shared/schema';
import { GeminiExpertService } from './gemini-expert-service';
import { buildStage0DataQualityPrompt } from '../prompts/stage0-data-quality-prompt';
import { buildStage1ScreeningPrompt } from '../prompts/stage1-screening-prompt';
import { buildFinancialExpertPrompt } from '../prompts/stage2-financial-expert-prompt';
import { buildOperationalExpertPrompt } from '../prompts/stage2-operational-expert-prompt';
import { buildRiskExpertPrompt } from '../prompts/stage2-risk-expert-prompt';
import { buildQualityOfEarningsPrompt } from '../prompts/stage2-qoe-expert-prompt';
import { buildSectorExpertPrompt } from '../prompts/stage2-sector-expert-prompt';
import { buildValuationExpertPrompt } from '../prompts/stage2-valuation-expert-prompt';
import { buildDealStructurePrompt } from '../prompts/stage2-deal-structure-prompt';
import { buildSynthesisPrompt } from '../prompts/stage3-synthesis-prompt';

const EXPERT_TYPES = [
  'data_quality',
  'screening',
  'financial',
  'operational',
  'risk',
  'qoe',
  'sector',
  'valuation',
  'deal_structure',
  'synthesis',
] as const;

type ExpertType = (typeof EXPERT_TYPES)[number];

const LAYER1_EXPERTS: ExpertType[] = ['financial', 'operational', 'risk'];

const EXPERT_DEPENDENCIES: Record<string, ExpertType[]> = {
  screening: ['data_quality'],
  qoe: ['financial', 'operational'],
  sector: ['financial'],
  valuation: ['financial', 'qoe', 'sector', 'risk', 'operational'],
  deal_structure: ['valuation', 'risk', 'operational', 'qoe'],
  synthesis: ['financial', 'operational', 'risk', 'qoe', 'sector', 'valuation', 'deal_structure'],
};

export class ExpertAnalysisService {
  private gemini: GeminiExpertService;

  constructor() {
    this.gemini = new GeminiExpertService();
  }

  private async getTargetCompany(companyId: number): Promise<TargetCompany> {
    const [company] = await db
      .select()
      .from(targetCompanies)
      .where(eq(targetCompanies.id, companyId));
    if (!company) {
      throw new Error(`Target company ${companyId} not found`);
    }
    return company;
  }

  private async getExtractedData(companyId: number): Promise<Record<string, unknown>> {
    const analysisTypes = [
      'company_accounts',
      'asset_register',
      'sales_ledger',
      'staff_matrix',
      'profit_and_loss',
      'balance_sheet',
    ];

    const results: Record<string, unknown[]> = {};

    for (const docType of analysisTypes) {
      const rows = await db
        .select({
          analysisData: documentAnalysisResults.analysisData,
        })
        .from(documentAnalysisResults)
        .innerJoin(documents, eq(documentAnalysisResults.documentId, documents.id))
        .where(
          and(
            eq(documents.targetCompanyId, companyId),
            eq(documentAnalysisResults.documentType, docType)
          )
        );
      results[docType] = rows.map((r) => r.analysisData).filter(Boolean);
    }

    return results;
  }

  private async getExpertResult(
    companyId: number,
    expertType: string
  ): Promise<ExpertAnalysisResult | null> {
    const [result] = await db
      .select()
      .from(expertAnalysisResults)
      .where(
        and(
          eq(expertAnalysisResults.targetCompanyId, companyId),
          eq(expertAnalysisResults.expertType, expertType)
        )
      )
      .orderBy(desc(expertAnalysisResults.createdAt))
      .limit(1);
    return result || null;
  }

  private async createExpertRecord(
    companyId: number,
    expertType: string,
    dependsOn: string[] = [],
    triggeredBy?: number
  ): Promise<ExpertAnalysisResult> {
    const [record] = await db
      .insert(expertAnalysisResults)
      .values({
        targetCompanyId: companyId,
        expertType,
        status: 'pending',
        dependsOn: dependsOn.length > 0 ? dependsOn : null,
        triggeredBy: triggeredBy ?? null,
      })
      .returning();
    return record;
  }

  private async updateExpertRecord(
    recordId: number,
    data: Partial<{
      status: string;
      analysisData: unknown;
      analysisMarkdown: string;
      score: number;
      confidence: string;
      processingTime: number;
      usageMetadata: unknown;
    }>
  ): Promise<void> {
    await db
      .update(expertAnalysisResults)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(expertAnalysisResults.id, recordId));
  }

  private async runExpert(
    record: ExpertAnalysisResult,
    prompt: string,
    expertType: string
  ): Promise<void> {
    await this.updateExpertRecord(record.id, { status: 'processing' });

    const startTime = Date.now();
    try {
      const result = await this.gemini.generateExpertAnalysis(expertType, prompt);
      const processingTime = Date.now() - startTime;

      const analysisData = result.params as Record<string, unknown>;
      const score =
        typeof analysisData.score === 'number' ? analysisData.score : null;
      const confidence =
        typeof analysisData.confidence === 'string'
          ? analysisData.confidence
          : null;
      const overallScore =
        typeof analysisData.overall_completeness_score === 'number'
          ? analysisData.overall_completeness_score
          : null;

      await this.updateExpertRecord(record.id, {
        status: 'success',
        analysisData: result.params,
        score: score ?? overallScore ?? undefined,
        confidence: confidence ?? (analysisData.confidence_for_analysis as string) ?? undefined,
        processingTime,
        usageMetadata: result.usage,
      });

      console.log(
        `[EXPERT_ORCHESTRATOR] ${expertType} completed for company ${record.targetCompanyId} ` +
          `in ${processingTime}ms, score=${score ?? overallScore}`
      );
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(
        `[EXPERT_ORCHESTRATOR] ${expertType} failed for company ${record.targetCompanyId}:`,
        error
      );
      await this.updateExpertRecord(record.id, {
        status: 'failed',
        processingTime,
        analysisData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async triggerNewStage1Pipeline(
    companyId: number,
    triggeredBy?: number
  ): Promise<{ dataQualityRecord: ExpertAnalysisResult; screeningRecord?: ExpertAnalysisResult }> {
    console.log(`[EXPERT_ORCHESTRATOR] Starting Stage 1 pipeline for company ${companyId}`);

    const company = await this.getTargetCompany(companyId);
    const extractedData = await this.getExtractedData(companyId);

    const dqRecord = await this.createExpertRecord(companyId, 'data_quality', [], triggeredBy);

    const dqPrompt =
      buildStage0DataQualityPrompt(company.companyName) +
      '\n\nDATA:\n' +
      JSON.stringify(extractedData, null, 2);

    await this.runExpert(dqRecord, dqPrompt, 'data_quality');

    const updatedDq = await this.getExpertResult(companyId, 'data_quality');
    if (!updatedDq || updatedDq.status !== 'success') {
      console.log(`[EXPERT_ORCHESTRATOR] Data quality failed, skipping screening`);
      return { dataQualityRecord: updatedDq || dqRecord };
    }

    const dqData = updatedDq.analysisData as Record<string, unknown> | null;
    const qualityScore =
      (dqData?.overall_completeness_score as number) ?? 0;
    const qualityConfidence =
      (dqData?.confidence_for_analysis as string) ?? 'low';

    console.log(
      `[EXPERT_ORCHESTRATOR] Data quality score: ${qualityScore}, confidence: ${qualityConfidence}`
    );

    if (qualityScore <= 40) {
      console.log(
        `[EXPERT_ORCHESTRATOR] Quality score ${qualityScore} <= 40, skipping screening`
      );
      return { dataQualityRecord: updatedDq };
    }

    const screeningRecord = await this.createExpertRecord(
      companyId,
      'screening',
      ['data_quality'],
      triggeredBy
    );

    const { systemPrompt, userPrompt } = buildStage1ScreeningPrompt(
      company.companyName,
      company.industry || 'Unknown',
      qualityScore,
      qualityConfidence
    );

    const screeningPrompt =
      systemPrompt +
      '\n\n' +
      userPrompt +
      '\n\nDATA:\n' +
      JSON.stringify(extractedData, null, 2);

    await this.runExpert(screeningRecord, screeningPrompt, 'screening');

    const updatedScreening = await this.getExpertResult(companyId, 'screening');
    return {
      dataQualityRecord: updatedDq,
      screeningRecord: updatedScreening || screeningRecord,
    };
  }

  async triggerExpertPipeline(
    companyId: number,
    triggeredBy?: number
  ): Promise<ExpertAnalysisResult[]> {
    console.log(`[EXPERT_ORCHESTRATOR] Starting Expert pipeline for company ${companyId}`);

    const company = await this.getTargetCompany(companyId);

    const expertTypes: ExpertType[] = [
      'financial',
      'operational',
      'risk',
      'qoe',
      'sector',
      'valuation',
      'deal_structure',
      'synthesis',
    ];

    const records: ExpertAnalysisResult[] = [];
    for (const expert of expertTypes) {
      const deps = EXPERT_DEPENDENCIES[expert] || [];
      const record = await this.createExpertRecord(
        companyId,
        expert,
        deps,
        triggeredBy
      );
      records.push(record);
    }

    console.log(
      `[EXPERT_ORCHESTRATOR] Created ${records.length} pending expert records, starting Layer 1`
    );

    const extractedData = await this.getExtractedData(companyId);
    const sector = company.industry || 'Unknown';

    const layer1Promises = LAYER1_EXPERTS.map(async (expertType) => {
      const record = records.find((r) => r.expertType === expertType)!;
      const prompt = this.buildLayer1Prompt(
        expertType,
        company.companyName,
        sector,
        extractedData
      );
      await this.runExpert(record, prompt, expertType);
    });

    await Promise.all(layer1Promises);

    await this.processNextSteps(companyId);

    return records;
  }

  async processNextSteps(companyId: number): Promise<void> {
    console.log(`[EXPERT_ORCHESTRATOR] Checking next steps for company ${companyId}`);

    const company = await this.getTargetCompany(companyId);
    const extractedData = await this.getExtractedData(companyId);
    const sector = company.industry || 'Unknown';

    const getStatus = async (type: string): Promise<string> => {
      const result = await this.getExpertResult(companyId, type);
      return result?.status || 'not_found';
    };

    const [
      financialStatus,
      operationalStatus,
      riskStatus,
      qoeStatus,
      sectorStatus,
      valuationStatus,
      dealStructureStatus,
    ] = await Promise.all([
      getStatus('financial'),
      getStatus('operational'),
      getStatus('risk'),
      getStatus('qoe'),
      getStatus('sector'),
      getStatus('valuation'),
      getStatus('deal_structure'),
    ]);

    console.log(
      `[EXPERT_ORCHESTRATOR] Status: financial=${financialStatus} operational=${operationalStatus} ` +
        `risk=${riskStatus} qoe=${qoeStatus} sector=${sectorStatus} ` +
        `valuation=${valuationStatus} deal_structure=${dealStructureStatus}`
    );

    if (financialStatus === 'success' && sectorStatus === 'pending') {
      console.log(`[EXPERT_ORCHESTRATOR] Starting Sector expert (Financial complete)`);
      const financialResult = await this.getExpertResult(companyId, 'financial');
      const sectorRecord = await this.getExpertResult(companyId, 'sector');

      if (sectorRecord && financialResult) {
        const sectorPrompt = this.buildSectorPrompt(company, extractedData);
        await this.runExpert(sectorRecord, sectorPrompt, 'sector');
        return this.processNextSteps(companyId);
      }
    }

    if (
      financialStatus === 'success' &&
      operationalStatus === 'success' &&
      qoeStatus === 'pending'
    ) {
      console.log(`[EXPERT_ORCHESTRATOR] Starting QoE expert`);
      const financialResult = await this.getExpertResult(companyId, 'financial');
      const operationalResult = await this.getExpertResult(companyId, 'operational');
      const qoeRecord = await this.getExpertResult(companyId, 'qoe');

      if (qoeRecord && financialResult && operationalResult) {
        const prompt = buildQualityOfEarningsPrompt(
          company.companyName,
          sector,
          JSON.stringify(financialResult.analysisData),
          JSON.stringify(operationalResult.analysisData)
        ) +
          '\n\nDATA:\n' +
          JSON.stringify(extractedData, null, 2);

        await this.runExpert(qoeRecord, prompt, 'qoe');
        return this.processNextSteps(companyId);
      }
    }

    if (
      qoeStatus === 'success' &&
      financialStatus === 'success' &&
      sectorStatus === 'success' &&
      riskStatus === 'success' &&
      operationalStatus === 'success' &&
      valuationStatus === 'pending'
    ) {
      console.log(`[EXPERT_ORCHESTRATOR] Starting Valuation expert`);
      const [financialResult, qoeResult, sectorResult, riskResult, operationalResult] =
        await Promise.all([
          this.getExpertResult(companyId, 'financial'),
          this.getExpertResult(companyId, 'qoe'),
          this.getExpertResult(companyId, 'sector'),
          this.getExpertResult(companyId, 'risk'),
          this.getExpertResult(companyId, 'operational'),
        ]);

      const valuationRecord = await this.getExpertResult(companyId, 'valuation');

      if (
        valuationRecord &&
        financialResult &&
        qoeResult &&
        sectorResult &&
        riskResult &&
        operationalResult
      ) {
        const prompt = buildValuationExpertPrompt(
          company.companyName,
          sector,
          JSON.stringify(financialResult.analysisData),
          JSON.stringify(qoeResult.analysisData),
          JSON.stringify(sectorResult.analysisData),
          JSON.stringify(riskResult.analysisData),
          JSON.stringify(operationalResult.analysisData)
        );

        await this.runExpert(valuationRecord, prompt, 'valuation');
        return this.processNextSteps(companyId);
      }
    }

    if (
      valuationStatus === 'success' &&
      riskStatus === 'success' &&
      operationalStatus === 'success' &&
      qoeStatus === 'success' &&
      dealStructureStatus === 'pending'
    ) {
      console.log(`[EXPERT_ORCHESTRATOR] Starting Deal Structure expert`);
      const [valuationResult, riskResult, operationalResult, qoeResult] =
        await Promise.all([
          this.getExpertResult(companyId, 'valuation'),
          this.getExpertResult(companyId, 'risk'),
          this.getExpertResult(companyId, 'operational'),
          this.getExpertResult(companyId, 'qoe'),
        ]);

      const dealRecord = await this.getExpertResult(companyId, 'deal_structure');

      if (dealRecord && valuationResult && riskResult && operationalResult && qoeResult) {
        const prompt = buildDealStructurePrompt(
          company.companyName,
          sector,
          JSON.stringify(valuationResult.analysisData),
          JSON.stringify(riskResult.analysisData),
          JSON.stringify(operationalResult.analysisData),
          JSON.stringify(qoeResult.analysisData)
        );

        await this.runExpert(dealRecord, prompt, 'deal_structure');
        return this.processNextSteps(companyId);
      }
    }

    const allExpertTypes: ExpertType[] = [
      'financial',
      'operational',
      'risk',
      'qoe',
      'sector',
      'valuation',
      'deal_structure',
    ];
    const allStatuses = await Promise.all(
      allExpertTypes.map((t) => getStatus(t))
    );
    const allSuccess = allStatuses.every((s) => s === 'success');
    const synthesisStatus = await getStatus('synthesis');

    if (allSuccess && synthesisStatus === 'pending') {
      console.log(`[EXPERT_ORCHESTRATOR] All experts complete, starting Synthesis`);
      const [
        financialResult,
        operationalResult,
        riskResult,
        qoeResult,
        sectorResult,
        valuationResult,
        dealStructureResult,
      ] = await Promise.all(
        allExpertTypes.map((t) => this.getExpertResult(companyId, t))
      );

      const synthesisRecord = await this.getExpertResult(companyId, 'synthesis');

      if (
        synthesisRecord &&
        financialResult &&
        operationalResult &&
        riskResult &&
        qoeResult &&
        sectorResult &&
        valuationResult &&
        dealStructureResult
      ) {
        const prompt = buildSynthesisPrompt(company.companyName, sector, {
          financial: JSON.stringify(financialResult.analysisData),
          operational: JSON.stringify(operationalResult.analysisData),
          risk: JSON.stringify(riskResult.analysisData),
          qoe: JSON.stringify(qoeResult.analysisData),
          sector: JSON.stringify(sectorResult.analysisData),
          valuation: JSON.stringify(valuationResult.analysisData),
          dealStructure: JSON.stringify(dealStructureResult.analysisData),
        });

        await this.runExpert(synthesisRecord, prompt, 'synthesis');
      }
    }

    console.log(`[EXPERT_ORCHESTRATOR] No more steps to process for company ${companyId}`);
  }

  private buildLayer1Prompt(
    expertType: ExpertType,
    companyName: string,
    sector: string,
    extractedData: Record<string, unknown>
  ): string {
    let basePrompt: string;

    switch (expertType) {
      case 'financial':
        basePrompt = buildFinancialExpertPrompt(companyName, sector);
        break;
      case 'operational':
        basePrompt = buildOperationalExpertPrompt(companyName, sector);
        break;
      case 'risk':
        basePrompt = buildRiskExpertPrompt(companyName, sector);
        break;
      default:
        throw new Error(`Unknown Layer 1 expert type: ${expertType}`);
    }

    return basePrompt + '\n\nDATA:\n' + JSON.stringify(extractedData, null, 2);
  }

  private buildSectorPrompt(
    company: TargetCompany,
    extractedData: Record<string, unknown>
  ): string {
    let latestRevenue: number | null = null;
    let latestEbitda: number | null = null;

    if (company.annualRevenue) {
      latestRevenue = parseFloat(String(company.annualRevenue));
    }

    const headcount = company.employeeCount || null;

    return buildSectorExpertPrompt(
      company.companyName,
      company.industry || 'Unknown',
      company.subSector || null,
      latestRevenue,
      latestEbitda,
      headcount
    );
  }

  async getExpertResults(companyId: number): Promise<ExpertAnalysisResult[]> {
    return db
      .select()
      .from(expertAnalysisResults)
      .where(eq(expertAnalysisResults.targetCompanyId, companyId))
      .orderBy(desc(expertAnalysisResults.createdAt));
  }

  async getExpertResultByType(
    companyId: number,
    expertType: string
  ): Promise<ExpertAnalysisResult | null> {
    return this.getExpertResult(companyId, expertType);
  }
}

export const expertAnalysisService = new ExpertAnalysisService();
