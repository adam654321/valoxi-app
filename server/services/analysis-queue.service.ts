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
  processing: boolean;
  totalProcessed: number;
  totalFailed: number;
}

const MAX_RETRIES = 2;
const INTER_JOB_DELAY_MS = 3000;
const MAX_QUEUE_SIZE = 100;

class AnalysisQueue {
  private queue: AnalysisJob[] = [];
  private isProcessing = false;
  private totalProcessed = 0;
  private totalFailed = 0;

  /**
   * Add an analysis job to the queue. If the queue is idle, processing starts immediately.
   */
  enqueue(job: { eventId: number; targetCompanyId: number; userCompanyId?: number }): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      console.error(`[ANALYSIS_QUEUE] Queue full (${MAX_QUEUE_SIZE} jobs). Dropping job for event ${job.eventId}`);
      return;
    }

    const exists = this.queue.some(j => j.eventId === job.eventId);
    if (exists) {
      console.log(`[ANALYSIS_QUEUE] Event ${job.eventId} already in queue, skipping duplicate`);
      return;
    }

    const queueJob: AnalysisJob = {
      eventId: job.eventId,
      targetCompanyId: job.targetCompanyId,
      userCompanyId: job.userCompanyId,
      addedAt: new Date(),
      retryCount: 0,
    };

    this.queue.push(queueJob);
    console.log(`[ANALYSIS_QUEUE] Enqueued event ${job.eventId} (queue length: ${this.queue.length})`);

    if (!this.isProcessing) {
      this.processNext();
    }
  }

  /**
   * Process jobs one at a time with a delay between each.
   */
  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      console.log(`[ANALYSIS_QUEUE] Queue empty, idle. Total processed: ${this.totalProcessed}, failed: ${this.totalFailed}`);
      return;
    }

    this.isProcessing = true;
    const job = this.queue.shift()!;

    console.log(`[ANALYSIS_QUEUE] Processing event ${job.eventId} (remaining: ${this.queue.length})`);

    try {
      await analyzeUploadedFileWithGemini(job.eventId);
      this.totalProcessed++;
      console.log(`[ANALYSIS_QUEUE] Event ${job.eventId} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ANALYSIS_QUEUE] Event ${job.eventId} failed: ${errorMessage}`);

      if (job.retryCount < MAX_RETRIES) {
        job.retryCount++;
        this.queue.push(job);
        console.log(`[ANALYSIS_QUEUE] Re-queued event ${job.eventId} (retry ${job.retryCount}/${MAX_RETRIES})`);
      } else {
        this.totalFailed++;
        console.error(`[ANALYSIS_QUEUE] Event ${job.eventId} failed after ${MAX_RETRIES} retries, giving up`);
      }
    }

    await new Promise(resolve => setTimeout(resolve, INTER_JOB_DELAY_MS));

    this.processNext();
  }

  /**
   * Get current queue statistics.
   */
  getStats(): QueueStats {
    return {
      pending: this.queue.length,
      processing: this.isProcessing,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
    };
  }
}

export const analysisQueue = new AnalysisQueue();
