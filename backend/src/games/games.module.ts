import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EconomyModule } from '../economy/economy.module';
import { RouletteService } from './roulette/roulette.service';
import { RouletteGateway } from './roulette/roulette.gateway';
import { RouletteController } from './roulette/roulette.controller';
import { TablesService } from './tables/tables.service';
import { TablesController } from './tables/tables.controller';
import {
  TableCleanupProcessor,
  TableCleanupScheduler,
  TABLES_QUEUE,
} from './tables/table-cleanup.processor';
import { BlackjackService } from './blackjack/blackjack.service';
import { BlackjackGateway } from './blackjack/blackjack.gateway';
import { PokerService } from './poker/poker.service';
import { PokerGateway } from './poker/poker.gateway';

@Module({
  imports: [EconomyModule, BullModule.registerQueue({ name: TABLES_QUEUE })],
  controllers: [RouletteController, TablesController],
  providers: [
    RouletteService,
    RouletteGateway,
    TablesService,
    TableCleanupProcessor,
    TableCleanupScheduler,
    BlackjackService,
    BlackjackGateway,
    PokerService,
    PokerGateway,
  ],
  exports: [RouletteService, TablesService],
})
export class GamesModule {}
