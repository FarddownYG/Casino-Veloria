import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Job, Queue } from 'bullmq';
import { BankLoanService } from './bank-loan.service';

export const LOANS_QUEUE = 'loans';

/** Processes the daily interest/reminder job for bank loans. */
@Processor(LOANS_QUEUE)
export class LoanInterestProcessor extends WorkerHost {
  private readonly logger = new Logger(LoanInterestProcessor.name);

  constructor(private readonly bank: BankLoanService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === 'daily-interest') {
      const result = await this.bank.runDailyInterest();
      this.logger.log(`Daily interest run: ${result.processed} loan(s)`);
      return result;
    }
    return null;
  }
}

/**
 * Schedules the daily loan-interest run. With Redis (REDIS_ENABLED=true) it uses
 * a repeatable BullMQ job; otherwise it falls back to an in-process @Cron so the
 * interest/reminders still run on a Redis-less host (e.g. Render free).
 */
@Injectable()
export class LoanScheduler implements OnModuleInit {
  private readonly logger = new Logger(LoanScheduler.name);

  constructor(
    @InjectQueue(LOANS_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
    private readonly bank: BankLoanService,
  ) {}

  private get redisEnabled(): boolean {
    return (this.config.get('redis') as { enabled: boolean }).enabled;
  }

  async onModuleInit(): Promise<void> {
    if (!this.redisEnabled) {
      this.logger.log('Redis disabled — loan interest runs via in-process @Cron (09:00 daily)');
      return;
    }
    try {
      await this.queue.add(
        'daily-interest',
        {},
        {
          repeat: { pattern: '0 9 * * *' }, // every day at 09:00
          removeOnComplete: true,
          removeOnFail: 50,
          jobId: 'daily-interest',
        },
      );
      this.logger.log('Scheduled daily loan-interest job (BullMQ)');
    } catch (e) {
      this.logger.warn(`Could not schedule loan job: ${(e as Error).message}`);
    }
  }

  /** In-process fallback when Redis/BullMQ isn't used (avoids double-running). */
  @Cron('0 9 * * *')
  async dailyInterestCron(): Promise<void> {
    if (this.redisEnabled) return; // BullMQ owns the schedule
    try {
      const result = await this.bank.runDailyInterest();
      this.logger.log(`[cron] Daily interest run: ${result.processed} loan(s)`);
    } catch (e) {
      this.logger.error(`[cron] Daily interest failed: ${(e as Error).message}`);
    }
  }
}
