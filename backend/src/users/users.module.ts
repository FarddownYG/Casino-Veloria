import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { EconomyModule } from '../economy/economy.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [EconomyModule, NotificationsModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
