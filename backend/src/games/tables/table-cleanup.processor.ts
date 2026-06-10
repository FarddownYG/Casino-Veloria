import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Job, Queue } from 'bullmq';
import { TablesService } from './tables.service';

export const TABLES_QUEUE = 'tables';

@Processor(TABLES_QUEUE)
export class TableCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(TableCleanupProcessor.name);

  constructor(private readonly tables: TablesService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === 'cleanup-empty') {
      const result = await this.tables.closeEmptyTables();
      if (result.closed > 0) this.logger.log(`Closed ${result.closed} empty table(s)`);
      return result;
    }
    return null;
  }
}

/**
 * Schedules the empty-table cleanup. With Redis (REDIS_ENABLED=true) it uses a
 * repeatable BullMQ job; otherwise it falls back to an in-process @Cron so empty
 * tables still auto-close on a Redis-less host.
 */
@Injectable()
export class TableCleanupScheduler implements OnModuleInit {
  private readonly logger = new Logger(TableCleanupScheduler.name);

  constructor(
    @InjectQueue(TABLES_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
    private readonly tables: TablesService,
  ) {}

  private get redisEnabled(): boolean {
    return (this.config.get('redis') as { enabled: boolean }).enabled;
  }

  async onModuleInit(): Promise<void> {
    if (!this.redisEnabled) {
      this.logger.log('Redis disabled — empty-table cleanup runs via in-process @Cron (every minute)');
      return;
    }
    try {
      await this.queue.add(
        'cleanup-empty',
        {},
        {
          repeat: { every: 60_000 }, // every minute
          removeOnComplete: true,
          removeOnFail: 20,
          jobId: 'cleanup-empty',
        },
      );
      this.logger.log('Scheduled empty-table cleanup job (BullMQ)');
    } catch (e) {
      this.logger.warn(`Could not schedule cleanup job: ${(e as Error).message}`);
    }
  }

  /** In-process fallback when Redis/BullMQ isn't used (avoids double-running). */
  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupCron(): Promise<void> {
    if (this.redisEnabled) return; // BullMQ owns the schedule
    try {
      const result = await this.tables.closeEmptyTables();
      if (result.closed > 0) this.logger.log(`[cron] Closed ${result.closed} empty table(s)`);
    } catch (e) {
      this.logger.error(`[cron] Table cleanup failed: ${(e as Error).message}`);
    }
  }
}
