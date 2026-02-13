import { analyzeUploadedFileWithGemini } from './file-analysis.service';

interface AnalysisJob {
  eventId: number;
  targetCompanyId: number;
  userCompanyId?: number;
  addedAt: Date;
  retryCount: number;
}

interface QueueStats {
  pending: number;
  activeCompanies: number;
  totalProcessed: number;
  totalFailed: number;
  perCompany: Array<{ targetCompanyId: number; pending: number; processing: boolean }>;
}

const MAX_RETRIES = 2;
const INTER_JOB_DELAY_MS = 500;
const MAX_QUEUE_SIZE_PER_COMPANY = 20;

/**
 * Per-company analysis queue. Each company's uploads are processed sequentially
 * to prevent Gemini rate limiting from burst uploads. Different companies
 * process in parallel so users never wait behind other companies' work.
 */
class AnalysisQueue {
  private companyQueues: Map<number, AnalysisJob[]> = new Map();
  private processingCompanies: Set<number> = new Set();
  private totalProcessed = 0;
  private totalFailed = 0;

  /**
   * Add an analysis job to the queue for its target company.
   * If no jobs are currently processing for that company, starts immediately.
   */
  enqueue(job: { eventId: number; targetCompanyId: number; userCompanyId?: number }): void {
    const companyId = job.targetCompanyId;
    
    if (!this.companyQueues.has(companyId)) {
      this.companyQueues.set(companyId, []);
    }

    const queue = this.companyQueues.get(companyId)!;

    if (queue.length >= MAX_QUEUE_SIZE_PER_COMPANY) {
      console.error(`[ANALYSIS_QUEUE] Company ${companyId} queue full (${MAX_QUEUE_SIZE_PER_COMPANY} jobs). Dropping job for event ${job.eventId}`);
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
    };

    queue.push(queueJob);
    console.log(`[ANALYSIS_QUEUE] Enqueued event ${job.eventId} for company ${companyId} (company queue: ${queue.length}, active companies: ${this.processingCompanies.size})`);

    if (!this.processingCompanies.has(companyId)) {
      this.processNextForCompany(companyId);
    }
  }

  /**
   * Process jobs sequentially for a single company.
   * Runs independently per company so different companies process in parallel.
   */
  private async processNextForCompany(companyId: number): Promise<void> {
    const queue = this.companyQueues.get(companyId);

    if (!queue || queue.length === 0) {
      this.processingCompanies.delete(companyId);
      this.companyQueues.delete(companyId);
      console.log(`[ANALYSIS_QUEUE] Company ${companyId} queue empty, idle. Active companies: ${this.processingCompanies.size}`);
      return;
    }

    this.processingCompanies.add(companyId);
    const job = queue.shift()!;

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
        queue.push(job);
        console.log(`[ANALYSIS_QUEUE] Re-queued event ${job.eventId} (retry ${job.retryCount}/${MAX_RETRIES})`);
      } else {
        this.totalFailed++;
        console.error(`[ANALYSIS_QUEUE] Event ${job.eventId} failed after ${MAX_RETRIES} retries, giving up`);
      }
    }

    // Short delay between jobs for the same company
    await new Promise(resolve => setTimeout(resolve, INTER_JOB_DELAY_MS));

    // Process next job for this company
    this.processNextForCompany(companyId);
  }

  /**
   * Get current queue statistics.
   */
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
