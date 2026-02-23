import { analyzeUploadedFileWithGemini } from './file-analysis.service';

interface AnalysisJob {
  eventId: number;
  targetCompanyId: number;
  userCompanyId?: number;
  addedAt: Date;
  retryCount: number;
  isRetrigger: boolean;
}

interface QueueStats {
  pending: number;
  activeCompanies: number;
  totalProcessed: number;
  totalFailed: number;
  perCompany: Array<{ targetCompanyId: number; pending: number; processing: boolean }>;
}

const MAX_RETRIES = 2;
const INTER_JOB_DELAY_MS = 200;
const MAX_QUEUE_SIZE_PER_COMPANY = 20;

/**
 * Per-company analysis queue. Each company's uploads are processed sequentially
 * to prevent Gemini rate limiting from burst uploads. Different companies
 * process in parallel so users never wait behind other companies' work.
 *
 * When a company's queue empties, runs a completion check:
 * 1. Checks if all 10 required documents are analysed
 * 2. Re-queues any failed analyses (once only)
 * 3. Auto-triggers expert pipeline only when all 10 are complete
 */
class AnalysisQueue {
  private companyQueues: Map<number, AnalysisJob[]> = new Map();
  private processingCompanies: Set<number> = new Set();
  private activeEventIds: Set<number> = new Set();
  private totalProcessed = 0;
  private totalFailed = 0;

  enqueue(job: { eventId: number; targetCompanyId: number; userCompanyId?: number; isRetrigger?: boolean }): void {
    const companyId = job.targetCompanyId;

    if (!this.companyQueues.has(companyId)) {
      this.companyQueues.set(companyId, []);
    }

    const queue = this.companyQueues.get(companyId)!;

    if (queue.length >= MAX_QUEUE_SIZE_PER_COMPANY) {
      console.error(`[ANALYSIS_QUEUE] Company ${companyId} queue full (${MAX_QUEUE_SIZE_PER_COMPANY} jobs). Dropping job for event ${job.eventId}`);
      return;
    }

    if (this.activeEventIds.has(job.eventId)) {
      console.log(`[ANALYSIS_QUEUE] Event ${job.eventId} is currently being processed, skipping duplicate enqueue`);
      return;
    }

    const exists = queue.some(j => j.eventId === job.eventId);
    if (exists) {
      console.log(`[ANALYSIS_QUEUE] Event ${job.eventId} already in queue for company ${companyId}, skipping duplicate`);
      return;
    }

    const queueJob: AnalysisJob = {
      eventId: job.eventId,
      targetCompanyId: companyId,
      userCompanyId: job.userCompanyId,
      addedAt: new Date(),
      retryCount: 0,
      isRetrigger: job.isRetrigger || false,
    };

    queue.push(queueJob);
    console.log(`[ANALYSIS_QUEUE] Enqueued event ${job.eventId} for company ${companyId}${queueJob.isRetrigger ? ' (retrigger)' : ''} (company queue: ${queue.length}, active companies: ${this.processingCompanies.size})`);

    if (!this.processingCompanies.has(companyId)) {
      this.processNextForCompany(companyId);
    }
  }

  private async processNextForCompany(companyId: number): Promise<void> {
    const queue = this.companyQueues.get(companyId);

    if (!queue || queue.length === 0) {
      this.processingCompanies.delete(companyId);
      this.companyQueues.delete(companyId);
      console.log(`[ANALYSIS_QUEUE] Company ${companyId} queue empty. Running completion check...`);

      await this.runCompletionCheck(companyId);
      return;
    }

    this.processingCompanies.add(companyId);
    const job = queue.shift()!;
    this.activeEventIds.add(job.eventId);

    console.log(`[ANALYSIS_QUEUE] Processing event ${job.eventId} for company ${companyId} (remaining for company: ${queue.length})`);

    try {
      await analyzeUploadedFileWithGemini(job.eventId);
      this.totalProcessed++;
      console.log(`[ANALYSIS_QUEUE] Event ${job.eventId} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ANALYSIS_QUEUE] Event ${job.eventId} failed: ${errorMessage}`);

      if (job.retryCount < MAX_RETRIES) {
        job.retryCount++;
        this.activeEventIds.delete(job.eventId);
        queue.push(job);
        console.log(`[ANALYSIS_QUEUE] Re-queued event ${job.eventId} (retry ${job.retryCount}/${MAX_RETRIES})`);
      } else {
        this.totalFailed++;
        console.error(`[ANALYSIS_QUEUE] Event ${job.eventId} failed after ${MAX_RETRIES} retries, giving up`);
      }
    } finally {
      this.activeEventIds.delete(job.eventId);
    }

    await new Promise(resolve => setTimeout(resolve, INTER_JOB_DELAY_MS));

    this.processNextForCompany(companyId);
  }

  private async runCompletionCheck(companyId: number): Promise<void> {
    try {
      const { runDocumentCompletionCheck } = await import('./file-analysis.service');
      console.log(`[ANALYSIS_QUEUE] Delegating completion check for company ${companyId} to file-analysis service`);
      await runDocumentCompletionCheck(companyId);
    } catch (error) {
      console.error(`[ANALYSIS_QUEUE] Completion check failed for company ${companyId}:`, error);
    }
  }

  async recoverStuckEvents(): Promise<void> {
    try {
      const { documentsRepository } = await import('../repositories/documents.repository');
      const { documentAnalysisRepository } = await import('../repositories/document-analysis.repository');
      const stuckStatuses = ['processing', 'classification_complete', 'pending'];
      const allEvents = await documentsRepository.getAllFileUploadEvents();
      const stuckEvents = allEvents.filter((e: any) => stuckStatuses.includes(e.webhookStatus));

      if (stuckEvents.length === 0) {
        console.log(`[ANALYSIS_QUEUE] Startup recovery: No stuck events found`);
        return;
      }

      console.log(`[ANALYSIS_QUEUE] Startup recovery: Found ${stuckEvents.length} stuck event(s), checking for existing results...`);

      let requeued = 0;
      let alreadyComplete = 0;

      for (const event of stuckEvents) {
        const existingResults = await documentAnalysisRepository.getAnalysisResultsByDocumentId(event.documentId);
        if (existingResults && existingResults.length > 0) {
          console.log(`[ANALYSIS_QUEUE] Event ${event.id} (document ${event.documentId}) already has ${existingResults.length} analysis result(s) — marking complete`);
          await documentsRepository.updateFileUploadEventWebhookStatus(event.id, 'analysis_complete', undefined, new Date());
          alreadyComplete++;
          continue;
        }

        await documentsRepository.updateFileUploadEventWebhookStatus(event.id, 'pending', undefined, undefined);
        this.enqueue({
          eventId: event.id,
          targetCompanyId: event.targetCompanyId,
          isRetrigger: true,
        });
        requeued++;
      }

      console.log(`[ANALYSIS_QUEUE] Startup recovery: ${requeued} re-queued, ${alreadyComplete} already had results (marked complete)`);
    } catch (error) {
      console.error(`[ANALYSIS_QUEUE] Startup recovery failed:`, error);
    }
  }

  getStats(): QueueStats {
    const perCompany: QueueStats['perCompany'] = [];
    this.companyQueues.forEach((queue, companyId) => {
      perCompany.push({
        targetCompanyId: companyId,
        pending: queue.length,
        processing: this.processingCompanies.has(companyId),
      });
    });

    let totalPending = 0;
    this.companyQueues.forEach((queue) => {
      totalPending += queue.length;
    });

    return {
      pending: totalPending,
      activeCompanies: this.processingCompanies.size,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
      perCompany,
    };
  }
}

export const analysisQueue = new AnalysisQueue();
