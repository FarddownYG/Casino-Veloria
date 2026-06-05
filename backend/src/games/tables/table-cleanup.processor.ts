import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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

@Injectable()
export class TableCleanupScheduler implements OnModuleInit {
  private readonly logger = new Logger(TableCleanupScheduler.name);

  constructor(@InjectQueue(TABLES_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
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
      this.logger.log('Scheduled empty-table cleanup job');
    } catch (e) {
      this.logger.warn(`Could not schedule cleanup job: ${(e as Error).message}`);
    }
  }
}
