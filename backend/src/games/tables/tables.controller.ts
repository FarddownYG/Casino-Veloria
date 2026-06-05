import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { GameType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/tables.dto';

@Controller('games/tables')
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  @Get()
  list(@Query('type') type?: GameType) {
    return this.tables.list(type);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.tables.get(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateTableDto) {
    return this.tables.create(userId, dto);
  }
}
