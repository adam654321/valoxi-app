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
import { GeminiExpertService, GeminiParseFailureError } from './gemini-expert-service';
import { captureAnalysisSnapshot } from './metrics-snapshot.service';
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

  async retryExpert(companyId: number, expertType: string, triggeredBy?: number): Promise<ExpertAnalysisResult> {
    console.log(`[EXPERT_ORCHESTRATOR] Retrying ${expertType} for company ${companyId}`);

    const existing = await this.getExpertResult(companyId, expertType);
    if (!existing) {
      throw new Error(`No existing ${expertType} record found for company ${companyId}`);
    }
    if (existing.status === 'processing') {
      throw new Error(`${expertType} is already running for company ${companyId}`);
    }

    await this.updateExpertRecord(existing.id, {
      status: 'pending',
      analysisData: null as any,
      score: undefined,
      confidence: undefined,
      processingTime: undefined,
    });

    const company = await this.getTargetCompany(companyId);
    const extractedData = await this.getExtractedData(companyId);
    const sector = company.industry || 'Unknown';
    const tracking = { userId: triggeredBy, userCompanyId: company.userCompanyId, dealId: companyId };

    const resetRecord = await this.getExpertResult(companyId, expertType);
    if (!resetRecord) throw new Error('Failed to retrieve reset record');

    if (['financial', 'operational', 'risk'].includes(expertType)) {
      const prompt = this.buildLayer1Prompt(expertType as ExpertType, company.companyName, sector, extractedData);
      await this.runExpert(resetRecord, prompt, expertType, tracking);
    } else if (expertType === 'sector') {
      const prompt = this.buildSectorPrompt(company, extractedData);
      await this.runExpert(resetRecord, prompt, expertType, tracking);
    } else if (expertType === 'qoe') {
      const financialResult = await this.getExpertResult(companyId, 'financial');
      const operationalResult = await this.getExpertResult(companyId, 'operational');
      const prompt = buildQualityOfEarningsPrompt(
        company.companyName, sector,
        financialResult?.analysisData ? JSON.stringify(financialResult.analysisData) : '{"error": "Financial analysis not available"}',
        operationalResult?.analysisData ? JSON.stringify(operationalResult.analysisData) : '{"error": "Operational analysis not available"}'
      ) + '\n\nDATA:\n' + JSON.stringify(extractedData, null, 2);
      await this.runExpert(resetRecord, prompt, expertType, tracking);
    } else if (expertType === 'valuation') {
      const [fin, qoe, sec, risk, ops] = await Promise.all([
        this.getExpertResult(companyId, 'financial'),
        this.getExpertResult(companyId, 'qoe'),
        this.getExpertResult(companyId, 'sector'),
        this.getExpertResult(companyId, 'risk'),
        this.getExpertResult(companyId, 'operational'),
      ]);
      const prompt = buildValuationExpertPrompt(
        company.companyName, sector,
        fin?.analysisData ? JSON.stringify(fin.analysisData) : '{"error": "Not available"}',
        qoe?.analysisData ? JSON.stringify(qoe.analysisData) : '{"error": "Not available"}',
        sec?.analysisData ? JSON.stringify(sec.analysisData) : '{"error": "Not available"}',
        risk?.analysisData ? JSON.stringify(risk.analysisData) : '{"error": "Not available"}',
        ops?.analysisData ? JSON.stringify(ops.analysisData) : '{"error": "Not available"}'
      );
      await this.runExpert(resetRecord, prompt, expertType, tracking);
    } else if (expertType === 'deal_structure') {
      const [val, risk, ops, qoe] = await Promise.all([
        this.getExpertResult(companyId, 'valuation'),
        this.getExpertResult(companyId, 'risk'),
        this.getExpertResult(companyId, 'operational'),
        this.getExpertResult(companyId, 'qoe'),
      ]);
      const prompt = buildDealStructurePrompt(
        company.companyName, sector,
        val?.analysisData ? JSON.stringify(val.analysisData) : '{"error": "Not available"}',
        risk?.analysisData ? JSON.stringify(risk.analysisData) : '{"error": "Not available"}',
        ops?.analysisData ? JSON.stringify(ops.analysisData) : '{"error": "Not available"}',
        qoe?.analysisData ? JSON.stringify(qoe.analysisData) : '{"error": "Not available"}'
      );
      await this.runExpert(resetRecord, prompt, expertType, tracking);
    } else if (expertType === 'synthesis') {
      const expertTypes: ExpertType[] = ['financial', 'operational', 'risk', 'qoe', 'sector', 'valuation', 'deal_structure'];
      const allResults = await Promise.all(
        expertTypes.map((t) => this.getExpertResult(companyId, t))
      );
      const getDataOrFallback = (r: any, name: string) =>
        r?.analysisData && r.status === 'success' ? JSON.stringify(r.analysisData) : `{"error": "${name} not available"}`;
      const prompt = buildSynthesisPrompt(company.companyName, sector, {
        financial: getDataOrFallback(allResults[0], 'Financial'),
        operational: getDataOrFallback(allResults[1], 'Operational'),
        risk: getDataOrFallback(allResults[2], 'Risk'),
        qoe: getDataOrFallback(allResults[3], 'QoE'),
        sector: getDataOrFallback(allResults[4], 'Sector'),
        valuation: getDataOrFallback(allResults[5], 'Valuation'),
        dealStructure: getDataOrFallback(allResults[6], 'Deal Structure'),
      });
      await this.runExpert(resetRecord, prompt, expertType, tracking);
    } else if (expertType === 'data_quality') {
      const dqPrompt = buildStage0DataQualityPrompt(company.companyName) +
        '\n\nDATA:\n' + JSON.stringify(extractedData, null, 2);
      await this.runExpert(resetRecord, dqPrompt, expertType, tracking);
    } else if (expertType === 'screening') {
      const dqResult = await this.getExpertResult(companyId, 'data_quality');
      const dqData = dqResult?.analysisData as Record<string, unknown> | null;
      const qualityScore = (dqData?.overall_completeness_score as number) ?? 0;
      const qualityConfidence = (dqData?.confidence_for_analysis as string) ?? 'unknown';
      const { systemPrompt, userPrompt } = buildStage1ScreeningPrompt(
        company.companyName, sector, qualityScore, qualityConfidence
      );
      const prompt = systemPrompt + '\n\n' + userPrompt +
        '\n\nDATA:\n' + JSON.stringify(extractedData, null, 2);
      await this.runExpert(resetRecord, prompt, expertType, tracking);
    }

    await this.processNextSteps(companyId);

    const finalResult = await this.getExpertResult(companyId, expertType);
    return finalResult || resetRecord;
  }

  async cancelAnalysis(companyId: number): Promise<number> {
    const result = await db
      .update(expertAnalysisResults)
      .set({
        status: 'failed',
        analysisData: { error: 'Cancelled by user' },
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(expertAnalysisResults.targetCompanyId, companyId),
          eq(expertAnalysisResults.status, 'pending')
        )
      );

    const result2 = await db
      .update(expertAnalysisResults)
      .set({
        status: 'failed',
        analysisData: { error: 'Cancelled by user' },
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(expertAnalysisResults.targetCompanyId, companyId),
          eq(expertAnalysisResults.status, 'processing')
        )
      );

    console.log(`[EXPERT_ORCHESTRATOR] Cancelled all pending/processing analyses for company ${companyId}`);
    return 0;
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
    expertType: string,
    tracking?: { userId?: number; userCompanyId?: number; dealId?: number }
  ): Promise<void> {
    await this.updateExpertRecord(record.id, { status: 'processing' });

    const startTime = Date.now();
    try {
      const result = await this.gemini.generateExpertAnalysis(expertType, prompt, undefined, tracking);
      const processingTime = Date.now() - startTime;

      const rawData = result.params as Record<string, unknown>;
      const analysisData = Array.isArray(rawData) ? rawData[0] as Record<string, unknown> : rawData;
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
        analysisData,
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

      const RAW_RESPONSE_CAP_BYTES = 100_000;

      if (error instanceof GeminiParseFailureError) {
        const rawText = error.rawText.length > RAW_RESPONSE_CAP_BYTES
          ? error.rawText.slice(0, RAW_RESPONSE_CAP_BYTES) + '...[truncated]'
          : error.rawText;

        await this.updateExpertRecord(record.id, {
          status: 'failed',
          processingTime,
          usageMetadata: error.usage,
          analysisData: {
            error: error.message,
            failure_type: 'parse_failure',
            raw_response: rawText,
            raw_response_length: error.rawText.length,
          },
        });
      } else {
        await this.updateExpertRecord(record.id, {
          status: 'failed',
          processingTime,
          analysisData: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  }

  async triggerNewStage1Pipeline(
    companyId: number,
    triggeredBy?: number
  ): Promise<{ dataQualityRecord: ExpertAnalysisResult; screeningRecord?: ExpertAnalysisResult }> {
    console.log(`[EXPERT_ORCHESTRATOR] Starting Stage 1 pipeline for company ${companyId}`);

    const company = await this.getTargetCompany(companyId);
    const tracking = { userId: triggeredBy, userCompanyId: company.userCompanyId, dealId: companyId };

    const { track } = await import('./funnel.service');
    track(company.userCompanyId, triggeredBy ?? null, 'analysis.triggered', { targetCompanyId: companyId });

    const extractedData = await this.getExtractedData(companyId);

    const dqRecord = await this.createExpertRecord(companyId, 'data_quality', [], triggeredBy);

    const dqPrompt =
      buildStage0DataQualityPrompt(company.companyName) +
      '\n\nDATA:\n' +
      JSON.stringify(extractedData, null, 2);

    await this.runExpert(dqRecord, dqPrompt, 'data_quality', tracking);

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

    await this.runExpert(screeningRecord, screeningPrompt, 'screening', tracking);

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
    const tracking = { userId: triggeredBy, userCompanyId: company.userCompanyId, dealId: companyId };

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
      await this.runExpert(record, prompt, expertType, tracking);
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

    const [anyRecord] = await db
      .select({ triggeredBy: expertAnalysisResults.triggeredBy })
      .from(expertAnalysisResults)
      .where(eq(expertAnalysisResults.targetCompanyId, companyId))
      .limit(1);
    const tracking = {
      userId: anyRecord?.triggeredBy ?? undefined,
      userCompanyId: company.userCompanyId,
      dealId: companyId,
    };

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

    const isDone = (s: string) => s === 'success' || s === 'failed';
    const hasData = (s: string) => s === 'success';

    if ((hasData(financialStatus) || isDone(financialStatus)) && sectorStatus === 'pending') {
      if (hasData(financialStatus)) {
        console.log(`[EXPERT_ORCHESTRATOR] Starting Sector expert (Financial complete)`);
        const financialResult = await this.getExpertResult(companyId, 'financial');
        const sectorRecord = await this.getExpertResult(companyId, 'sector');

        if (sectorRecord && financialResult) {
          const sectorPrompt = this.buildSectorPrompt(company, extractedData);
          await this.runExpert(sectorRecord, sectorPrompt, 'sector', tracking);
          return this.processNextSteps(companyId);
        }
      } else {
        console.log(`[EXPERT_ORCHESTRATOR] Starting Sector expert without financial data (financial failed)`);
        const sectorRecord = await this.getExpertResult(companyId, 'sector');
        if (sectorRecord) {
          const sectorPrompt = this.buildSectorPrompt(company, extractedData);
          await this.runExpert(sectorRecord, sectorPrompt, 'sector', tracking);
          return this.processNextSteps(companyId);
        }
      }
    }

    if (
      isDone(financialStatus) &&
      isDone(operationalStatus) &&
      qoeStatus === 'pending'
    ) {
      console.log(`[EXPERT_ORCHESTRATOR] Starting QoE expert`);
      const financialResult = await this.getExpertResult(companyId, 'financial');
      const operationalResult = await this.getExpertResult(companyId, 'operational');
      const qoeRecord = await this.getExpertResult(companyId, 'qoe');

      if (qoeRecord) {
        const prompt = buildQualityOfEarningsPrompt(
          company.companyName,
          sector,
          financialResult?.analysisData ? JSON.stringify(financialResult.analysisData) : '{"error": "Financial analysis not available"}',
          operationalResult?.analysisData ? JSON.stringify(operationalResult.analysisData) : '{"error": "Operational analysis not available"}'
        ) +
          '\n\nDATA:\n' +
          JSON.stringify(extractedData, null, 2);

        await this.runExpert(qoeRecord, prompt, 'qoe', tracking);
        return this.processNextSteps(companyId);
      }
    }

    if (
      isDone(qoeStatus) &&
      isDone(financialStatus) &&
      isDone(sectorStatus) &&
      isDone(riskStatus) &&
      isDone(operationalStatus) &&
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

      if (valuationRecord) {
        const prompt = buildValuationExpertPrompt(
          company.companyName,
          sector,
          financialResult?.analysisData ? JSON.stringify(financialResult.analysisData) : '{"error": "Financial analysis not available"}',
          qoeResult?.analysisData ? JSON.stringify(qoeResult.analysisData) : '{"error": "QoE analysis not available"}',
          sectorResult?.analysisData ? JSON.stringify(sectorResult.analysisData) : '{"error": "Sector analysis not available"}',
          riskResult?.analysisData ? JSON.stringify(riskResult.analysisData) : '{"error": "Risk analysis not available"}',
          operationalResult?.analysisData ? JSON.stringify(operationalResult.analysisData) : '{"error": "Operational analysis not available"}'
        );

        await this.runExpert(valuationRecord, prompt, 'valuation', tracking);
        return this.processNextSteps(companyId);
      }
    }

    if (
      isDone(valuationStatus) &&
      isDone(riskStatus) &&
      isDone(operationalStatus) &&
      isDone(qoeStatus) &&
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

      if (dealRecord) {
        const prompt = buildDealStructurePrompt(
          company.companyName,
          sector,
          valuationResult?.analysisData ? JSON.stringify(valuationResult.analysisData) : '{"error": "Valuation analysis not available"}',
          riskResult?.analysisData ? JSON.stringify(riskResult.analysisData) : '{"error": "Risk analysis not available"}',
          operationalResult?.analysisData ? JSON.stringify(operationalResult.analysisData) : '{"error": "Operational analysis not available"}',
          qoeResult?.analysisData ? JSON.stringify(qoeResult.analysisData) : '{"error": "QoE analysis not available"}'
        );

        await this.runExpert(dealRecord, prompt, 'deal_structure', tracking);
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
    const allDone = allStatuses.every((s) => s === 'success' || s === 'failed');
    const allSuccess = allStatuses.every((s) => s === 'success');
    const synthesisStatus = await getStatus('synthesis');

    if (allDone && synthesisStatus === 'pending') {
      const failedExperts = allExpertTypes.filter((t, i) => allStatuses[i] === 'failed');
      if (failedExperts.length > 0) {
        console.log(`[EXPERT_ORCHESTRATOR] Some experts failed (${failedExperts.join(', ')}), proceeding with synthesis using available data`);
      }
      console.log(`[EXPERT_ORCHESTRATOR] All experts done, starting Synthesis`);
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

      const getDataOrFallback = (result: any, name: string) =>
        result?.analysisData && result.status === 'success'
          ? JSON.stringify(result.analysisData)
          : `{"error": "${name} analysis failed or not available"}`;

      if (synthesisRecord) {
        const prompt = buildSynthesisPrompt(company.companyName, sector, {
          financial: getDataOrFallback(financialResult, 'Financial'),
          operational: getDataOrFallback(operationalResult, 'Operational'),
          risk: getDataOrFallback(riskResult, 'Risk'),
          qoe: getDataOrFallback(qoeResult, 'QoE'),
          sector: getDataOrFallback(sectorResult, 'Sector'),
          valuation: getDataOrFallback(valuationResult, 'Valuation'),
          dealStructure: getDataOrFallback(dealStructureResult, 'Deal Structure'),
        });

        const synthesisStartTime = Date.now();
        await this.runExpert(synthesisRecord, prompt, 'synthesis', tracking);
        const synthesisDurationMs = Date.now() - synthesisStartTime;

        captureAnalysisSnapshot(companyId, company.userCompanyId).catch(err =>
          console.error('[METRICS_SNAPSHOT] Silent failure on analysis completion:', err)
        );

        const { track } = await import('./funnel.service');
        track(company.userCompanyId, null, 'analysis.completed', { targetCompanyId: companyId, durationMs: synthesisDurationMs });
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
