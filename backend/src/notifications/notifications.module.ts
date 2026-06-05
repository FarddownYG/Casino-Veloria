import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { UserGateway } from './user.gateway';

@Module({
  providers: [NotificationsService, UserGateway],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
