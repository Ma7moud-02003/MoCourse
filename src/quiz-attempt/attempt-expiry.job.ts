import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { QuizAttemptService } from './quiz-attempt.service';

/**
 * Closes attempts whose deadline passed without a submit, even if the student never returns.
 * Runs inside the API process on a timer (no extra dependency, no queue).
 * - every ATTEMPT_EXPIRY_SWEEP_SECONDS (default 60, minimum 10)
 * - at most BATCH attempts per sweep; if more are due, the next sweep continues
 * - a sweep never overlaps the previous one in the same process
 * - off when NODE_ENV=test or ATTEMPT_EXPIRY_JOB=off
 */
@Injectable()
export class AttemptExpiryJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttemptExpiryJob.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  static readonly BATCH = 100;

  constructor(private attempts: QuizAttemptService) {}

  static intervalMs(raw = process.env.ATTEMPT_EXPIRY_SWEEP_SECONDS): number {
    const n = Number(raw);
    return (Number.isFinite(n) && n >= 10 ? n : 60) * 1000;
  }

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.ATTEMPT_EXPIRY_JOB === 'off') return;
    this.timer = setInterval(() => void this.sweep(), AttemptExpiryJob.intervalMs());
    this.timer.unref();
    void this.sweep(); // catches up after a restart
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep() {
    if (this.running) return null;
    this.running = true;
    try {
      const r = await this.attempts.closeExpiredAttempts(AttemptExpiryJob.BATCH);
      if (r.found) this.logger.log(`expired attempts: found ${r.found}, closed ${r.closed}, failed ${r.failed}`);
      return r;
    } catch (e) {
      this.logger.error(`expiry sweep failed: ${(e as Error).message}`);
      return null;
    } finally {
      this.running = false;
    }
  }
}
