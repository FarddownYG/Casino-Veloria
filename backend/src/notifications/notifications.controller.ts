import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser('userId') userId: string,
    @Query('cursor') cursor?: string,
  ) {
    const [items, unread] = await Promise.all([
      this.notifications.list(userId, 30, cursor),
      this.notifications.unreadCount(userId),
    ]);
    return { items, unread };
  }

  @Post(':id/read')
  markRead(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.notifications.markRead(userId, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser('userId') userId: string) {
    return this.notifications.markAllRead(userId);
  }
}
